/* ==========================================================================
   NeuroPets — its own main section (pet:*). Begun as "Pixel Pet"; Cam renamed
   it NeuroPet, then NeuroPets, on 2026-10-03 (names only: views, files and the
   save keep "pet").

   Cam (2026-10-03, Notes → Vault → "Pixel Pet Feature"): a Tamagotchi-style
   pet that grows into an idle game. "Start really simple. With all the basic
   funcitons of a tamagotchi style pet, then slowly layer on features in a
   logical order." Slice 1 is that pet: choose an egg, name it, and look
   after it — food, fun, energy, clean, health — in real time.

   The rules are petcore.js and the pictures petart.js. Since 2026-10-03 the game is its own app (neuropets.py,
   ui/pet/index.html + game.js -- the sidebar, top bar and toasts): this file
   draws the pages. The game is the only thing that saves the pet (pet.py):
   every change comes through act() here.
   ========================================================================== */
(function () {
  "use strict";
  const SS = window.SS = window.SS || {};
  const Core = window.PetCore, Art = window.PetArt;

  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  const call = (name, args, what) => SS.Store.call(name, args || [], what || "NeuroPets");
  // messages: a toast from the game's shell (game.js), not a line on the page
  const toast = (m, bad) => { if (m && SS.toast) SS.toast(m, bad); };
  // ---- one shared 1-second ticker (2026-10-10, audit M-3 / SE-5): instead of a timer per page, a page hands it a job by
  //      name; a job that returns false is done, and handing the same name again replaces it (no name: stops it).
  const ticks = new Map();
  function everySecond(key, fn) { if (fn) ticks.set(key, fn); else ticks.delete(key); }
  setInterval(() => {
    for (const [key, fn] of [...ticks]) {
      let r; try { r = fn(); } catch (e) { r = false; console.error("tick " + key, e); }
      if (r === false && ticks.get(key) === fn) ticks.delete(key);   // (unless it re-registered itself, e.g. by drawing the page)
    }
  }, 1000);

  // Two games: "main" is Cam's; "dev" is Developer -> NeuroPet, a sandbox copy with
  // its own save.
  const states = {main: null, dev: null};    // as saved (not advanced)
  let slot = "main";
  let hostEl = null;
  let view = "pet:home";
  let look = {skin: 0, hair: 0, outfit: 0, body: "m"};   // the character maker's picks
  let status = "";
  let pick = "starter";     // the egg looked at on the chooser
  let effect = null;         // {item, until} -- food, a heart, soap, a pill over the pet
  let chewUntil = 0;
  let queue = Promise.resolve();

  async function load(which) {
    const sl = which || slot;
    const s = await call("pet_load", [sl], "Loading your pet");
    states[sl] = s && !s.error ? s : Core.empty();
    if (sl === "dev" && !states.dev.dev) states.dev.dev = {on: true};
    if (sl === slot) loadModPics();
    return states[sl];
  }
  async function saveSlot(sl, st) { return call("pet_save", [st, sl], "Saving your pet"); }

  /** Every change to the pet. One at a time. */
  /** How a boss fight is played -- "auto" or "manual" -- remembered on this computer. */
  function bossMode(set) {
    try {
      if (set) localStorage.setItem("np:bossMode", set);
      return localStorage.getItem("np:bossMode") === "manual" ? "manual" : "auto";
    } catch (e) { return set || "auto"; }
  }
  function act(action, opts, which) {
    const sl = which || slot;
    const run = async () => {
      await load(sl);
      const r = Core.act(states[sl], action, opts || {}, Date.now());
      if (!r.ok) return {error: r.error};
      const saved = await saveSlot(sl, r.state);
      if (saved && saved.error) return {error: saved.error};
      states[sl] = r.state;
      if (sl === slot) show(action, opts);
      if (sl === slot) toast(r.msg);
      if (hostEl && hostEl.isConnected && sl === slot) { status = r.msg; render(); }
      return {ok: true, msg: r.msg, got: r.got};
    };
    const p = queue.then(run, run);
    queue = p.catch(() => {});
    return p;
  }

  // ---- checkpoints (2026-10-11, audit OPT-1): every redraw works the save forward from when it was last written, so a
  //      save left gathering or hunting for hours cost up to 0.4 s per redraw. Write the worked-forward game back when a
  //      save is opened, every few minutes, and when the window comes back into view -- the same path as any action
  //      (fresh from disk, advanced, saved, through the one queue).
  const CHECKPOINT_MS = 3 * 60 * 1000;
  let lastCheckpoint = 0;
  function checkpoint(which) {
    const sl = which || slot;
    const run = async () => {
      await load(sl);
      const s0 = states[sl];
      if (!s0 || !s0.player) return;
      const a = Core.advance(s0, Date.now());
      const saved = await saveSlot(sl, a);
      if (!saved || !saved.error) { states[sl] = a; lastCheckpoint = Date.now(); }
    };
    const p = queue.then(run, run);
    queue = p.catch(() => {});
    return p;
  }
  setInterval(() => { if (hostEl && Date.now() - lastCheckpoint >= CHECKPOINT_MS) checkpoint(); }, 30 * 1000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden && hostEl && Date.now() - lastCheckpoint > 30 * 1000) checkpoint().then(() => render()); });

  function show(action, opts) {
    const now = Date.now();
    const item = action === "feed" ? ((opts && opts.food) || "kibble")
      : action === "play" || action === "pet" ? "heart"
      : action === "clean" ? "soap" : action === "medicine" ? "pill" : null;
    // painted stand-ins for the old pixel-only kibble and pill (2026-10-11); soap waits for its own icon (art audit)
    if (item) effect = {item: {kibble: "treat", pill: "tonic"}[item] || item, until: now + 1800};
    if (action === "feed") chewUntil = now + 1600;
  }

  // one snapshot a moment (2026-10-10, audit M-3 / SE-6): the clocks, the nav and the top bar all ask for the game every
  // second; within 200 ms, and until the save changes, they share one -- and the views made from it (memo below)
  let snap = null;
  function current() {
    const now = Date.now(), base = states[slot] || null;
    if (snap && snap.base === base && snap.slot === slot && now >= snap.now && now - snap.now < 200) return snap.c;
    const s = Core.advance(base || Core.empty(), now);
    const c = {s, v: Core.view(s, now), now};
    snap = {base, slot, now, c};
    return c;
  }
  const memos = new WeakMap();
  /** A view of a snapshot's state, made once for it: memo("playerView", s, now). Don't change what it gives back. */
  function memo(name, s, now) {
    let m = memos.get(s);
    if (!m) memos.set(s, m = {});
    const k = name + "@" + now;
    return k in m ? m[k] : (m[k] = Core[name](s, now));
  }

  // ---- the room: the pet wandering, drawn on a canvas ------------------------------
  const room = {x: 0.5, dir: 1, pauseUntil: 0, tick: 0, timer: 0};
  const SCALE = 8, PET = 16 * SCALE;

  function startRoom(canvas) {
    clearInterval(room.timer);
    room.timer = setInterval(() => {
      if (!canvas.isConnected) { clearInterval(room.timer); return; }
      room.tick++;
      wander();
      paint(canvas);
      const cv = current().v;
      if (room.tick % (cv.stage === "egg" || cv.away ? 8 : 40) === 0) refreshNumbers();   // clocks every second
    }, 125);
    paint(canvas);
  }

  function walks(v) {
    return v.has && v.stage !== "egg" && !v.asleep && !v.sick && v.mood !== "sad" && v.mood !== "hungry";
  }

  function wander() {
    const {v, now} = current();
    if (!walks(v) || now < room.pauseUntil || now < chewUntil) return;
    room.x += room.dir * 0.006;
    if (room.x > 0.85 || room.x < 0.15) { room.dir = -room.dir; room.x = Math.max(0.15, Math.min(0.85, room.x)); }
    if (Math.random() < 0.012) room.pauseUntil = now + 1200 + Math.random() * 2500;
    else if (Math.random() < 0.01) room.dir = -room.dir;
  }

  function paint(canvas) {
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height, floor = H - 40;
    const {v, now} = current();
    ctx.clearRect(0, 0, W, H);
    // the painted room (2026-10-10, Cam's "Pets Room"): the backdrop, and what you've placed in it painted too
    const bg = petImage("art/petroom.webp");
    if (bg) { ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high"; ctx.drawImage(bg, 0, 0, W, H); }
    else { ctx.fillStyle = "rgba(255,255,255,0.05)"; ctx.fillRect(0, floor, W, H - floor); }
    if (!v.has) return;
    const placed = (id, x, w, h) => { const im = window.PET_ICONS && window.PET_ICONS[id] && petImage(`art/icons/${id}.webp`); if (im) ctx.drawImage(im, x, floor - h + 6, w, h); return !!im; };
    if (v.room) {
      const r = v.room, painted = (!r.rug || placed(r.rug === true ? "rug" : r.rug, W / 2 - 90, 180, 70)) & (!r.bed || placed("petbed", W * 0.03, 110, 90)) & (!r.toybox || placed("toybox", W * 0.97 - 100, 100, 90));
      if (!painted) Art.drawRoom(ctx, W, floor, 8, v.room);
    }
    // poops along the floor, where they always are
    const poopPic = window.PET_ICONS && window.PET_ICONS.poop && petImage("art/icons/poop.webp");   // painted (2026-10-10)
    Art.POOP_SPOTS.slice(0, v.poops).forEach((px) => {
      if (poopPic) return ctx.drawImage(poopPic, Math.round(W * px) - 18, floor - 34, 36, 36);
      const it = Art.item("poop");
      Art.draw(ctx, it.rows, it.pal, Math.round(W * px) - 16, floor - 24 + 4, 4, false);
    });
    const cx = Math.round(W * room.x);
    if (v.stage === "egg") {
      const wob = room.tick % 8 < 4 ? -SCALE / 2 : SCALE / 2, eggPic = paintedEgg(v.egg), eim = eggPic && petImage(eggPic);
      if (eim) { ctx.save(); ctx.imageSmoothingEnabled = true; ctx.drawImage(eim, W / 2 - 55 + (room.tick % 16 < 8 ? wob : 0), floor - 128, 110, 120); ctx.restore(); return; }
      const egg = Art.item("egg", v.egg);
      Art.draw(ctx, egg.rows, egg.pal, W / 2 - 5 * SCALE + (room.tick % 16 < 8 ? wob : 0), floor - 12 * SCALE, SCALE, false);
      return;
    }
    const blink = room.tick % 40 === 0;
    const chew = now < chewUntil && room.tick % 4 < 2;
    const bob = walks(v) && now >= room.pauseUntil && room.tick % 4 < 2 ? -SCALE / 2 : 0;
    if (v.away) {                          // out on an expedition: an empty room, and a note
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.font = "bold 20px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`Off exploring the ${v.away.areaName}…`, W / 2, floor - 60);
      ctx.textAlign = "left";
      return;
    }
    const pic = paintedPet(v.species, v.colour, v.asleep ? "sleep" : "side", v.skin), im = pic && petImage(pic);
    if (im) {                                                        // the painted pet: by its size; facing the way it walks
      const sz = Core.sizeOf(v.species), tall = (sz === "small" ? 120 : sz === "large" ? 190 : 155) * (v.asleep ? 0.75 : 1);
      const k = Math.min(tall / im.naturalHeight, (W * 0.42) / im.naturalWidth), w = im.naturalWidth * k, h = im.naturalHeight * k;
      ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
      if (room.dir < 0 && !v.asleep) { ctx.translate(cx * 2, 0); ctx.scale(-1, 1); }
      ctx.drawImage(im, cx - w / 2, floor - h + bob + 4, w, h);
      ctx.restore();
    } else {
      const rows = Art.frame(v.species, v.mood === "injured" ? "sad" : v.mood, blink, chew);
      Art.draw(ctx, rows, Art.palette(v.species, v.colour, modSkin(v.species, v.colour, v.skin)), cx - PET / 2, floor - PET + bob, SCALE, room.dir < 0);
    }
    if (v.asleep) {
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.font = "bold 22px monospace";
      const z = Math.floor(room.tick / 6) % 3;
      ctx.fillText("z", cx + PET / 2 - 6 + z * 10, floor - PET + 10 - z * 14);
    }
    if (effect && now < effect.until) {                              // food, soap, a heart, a pill over the pet: painted when it can be (2026-10-11)
      const ep = window.PET_ICONS && window.PET_ICONS[effect.item] && petImage(`art/icons/${effect.item}.webp`), ey = floor - PET - 44 - (effect.until - now) / 120;
      if (ep) { ctx.save(); ctx.imageSmoothingEnabled = true; ctx.drawImage(ep, cx - 24, ey - 8, 48, 48); ctx.restore(); }
      else { const it = Art.itemArt(effect.item) || Art.item(effect.item); if (it) Art.draw(ctx, it.rows, it.pal, cx - 16, ey, 5, false); }
    }
  }

  // ---- the page ---------------------------------------------------------------------
  function bar(k, val) {
    const low = val < 25 ? " low" : "";
    return `<div class="pp-stat${low}"><span class="pp-stat-name">${esc(Core.STAT_NAMES[k])}</span>
      <span class="pp-bar"><span style="width:${val}%"></span></span><span class="pp-stat-n">${val}</span></div>`;
  }

  const clock = (secs) => {
    const h = Math.floor(secs / 3600), m = Math.floor(secs / 60) % 60;
    return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}:${String(secs % 60).padStart(2, "0")}`;
  };
  const hatchTime = (ms) => ms >= Core.HOUR ? `${ms / Core.HOUR} hour${ms === Core.HOUR ? "" : "s"}` : `${ms / Core.MIN} minutes`;

  function describe(v) {
    if (v.stage === "egg") return `${v.eggName} · hatches in ${clock(Math.max(0, v.hatchIn))}`;
    const age = v.ageDays ? `${v.ageDays} day${v.ageDays === 1 ? "" : "s"} old` : `${v.ageHours} hour${v.ageHours === 1 ? "" : "s"} old`;
    const exp = v.away ? `exploring the ${v.away.areaName}` : v.expeditionReady ? "ready for expeditions"
      : `expeditions in ${v.daysToExpeditions} day${v.daysToExpeditions === 1 ? "" : "s"}`;
    return `${v.kind} (${v.rarity}) · ${v.stage} · ${age} · ${exp}`;
  }

  /** The chances table for an egg: what might hatch, never what will. */
  function oddsTable(type) {
    const dex = (states[slot] && states[slot].dex) || {};
    return `<table class="pp-odds"><tbody>${Core.odds(type).map((o) =>
      `<tr><td>${o.rarity === "Special" && !dex[o.pet] ? "???" : esc(o.name)}</td><td><span class="pp-rarity r-${esc(o.rarity.toLowerCase())}">${esc(o.rarity)}</span></td>
       <td class="pp-chance">${o.chance}%</td></tr>`).join("")}</tbody></table>`;
  }

  function refreshNumbers() {
    if (!hostEl || !hostEl.isConnected) return;
    const {v} = current();
    const box = hostEl.querySelector("#pp-stats");
    if (box && v.has) box.innerHTML = Core.STATS.map((k) => bar(k, v.stats[k])).join("");
    const need = hostEl.querySelector("#pp-need");
    if (need) need.textContent = v.need || "";
    const sub = hostEl.querySelector("#pp-sub");
    if (sub && v.has) sub.textContent = describe(v);
    if (v.has && v.stage !== "egg" && hostEl.querySelector("#pp-egg-wait")) { status = ""; render(); }   // it hatched
    const away = hostEl.querySelector("#pp-away-clock");
    if (away && v.away) away.textContent = `Back in ${clock(v.away.backIn)} · ${Math.round(v.away.chance * 100)}% chance of success`;
    if (away && !v.away) { status = ""; render(); }                                                      // it's back
  }

  const icons = {};
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
  // ---- Amunet's tutorial (2026-10-11): a pop-up over every page, bottom left; it waits for things done in the game ----
  const tutorStarted = new Set();
  let tutorMin = false, tutorSkill = "", tutorPoint = [];
  // the red box over the next click: the first of the step's places on screen, pulsing; it follows the page as you move
  const pointScrolled = new WeakSet();
  function drawPointer() {
    let ring = document.querySelector(".np-tutor-ring");
    let el = null;
    for (const sel of tutorPoint) {
      let below = null;
      for (const cand of document.querySelectorAll(sel)) {
        if (cand.closest(".np-tutor")) continue;
        const r = cand.getBoundingClientRect();
        if (r.width > 2 && r.height > 2 && getComputedStyle(cand).visibility !== "hidden") {
          if (r.bottom > 0 && r.top < innerHeight) { el = cand; break; }
          if (!below && cand.closest("#np-host")) below = cand;
        }
      }
      // on the page but scrolled out of sight (the tutors under the Guild hall's picture, B3 2026-10-19): bring it into
      // view once, rather than falling back to the Map button
      if (!el && below) { if (!pointScrolled.has(below)) { pointScrolled.add(below); below.scrollIntoView({block: "center", behavior: "smooth"}); } el = below; }
      if (el) break;
    }
    // a window open over the page, and the next click isn't in it: point at its ✕ first (I2, 2026-10-16, Cam: "have the
    // flashing indicator point to the x to close the window first")
    const wins = tutorPoint.length ? [...document.querySelectorAll(".pp-modal, .pp-picker")].filter((w) => !w.closest(".np-tutor") && w.getBoundingClientRect().width > 2) : [];
    const top = wins[wins.length - 1];
    if (top && !(el && top.contains(el))) el = top.querySelector(".pp-shop-x, .pp-picker-x, [aria-label='Close']") || el;
    const tut = document.querySelector(".np-tutor");
    if (!el) { if (ring) ring.remove(); if (tut) tut.classList.remove("right"); return; }
    // she never sits on the place she's pointing at: over it, she steps to the other side of the screen
    if (tut) {
      const a = el.getBoundingClientRect(), side = tut.classList.contains("right");
      const b = tut.getBoundingClientRect(), hits = a.right > b.left && a.left < b.right && a.bottom > b.top && a.top < b.bottom;
      if (hits) tut.classList.toggle("right", !side);
    }
    if (!ring) { ring = document.createElement("div"); ring.className = "np-tutor-ring"; document.body.appendChild(ring); }
    const r = el.getBoundingClientRect(), pad = 6;
    Object.assign(ring.style, {left: (r.left - pad) + "px", top: (r.top - pad) + "px", width: (r.width + pad * 2) + "px", height: (r.height + pad * 2) + "px"});
  }
  setInterval(() => { try { drawPointer(); } catch (e) { /* never in the way */ } }, 150);
  try { tutorMin = localStorage.getItem("np-tutor-min") === "1"; } catch (e) { /* no storage */ }
  function tutorGo(go) {
    if (!go) return;
    if (go === "sheet:combat") { sheetTab = "combat"; closeSec(); goTo("pet:skills"); return; }   // the Character sheet's Combat tab (class tutorials)
    if (go.startsWith("region:")) { worldRegion = go.slice(7); seaChart = false; closeSec(); goTo("pet:world"); }
    else { closeSec(); goTo(go); }
  }
  function drawTutorial() {
    const {s, now} = current(), tv = Core.tutorialView(s, now);
    if (tv.canStart && !tutorStarted.has(slot)) { tutorStarted.add(slot); act("tutorial", {op: "start"}); return; }
    let box = document.querySelector(".np-tutor");
    document.body.classList.toggle("np-tutor-on", !!tv.on && !tutorMin);   // room at the page's foot, so nothing hides under it
    if (!tv.on) { tutorPoint = []; if (box) box.remove(); return; }
    const sig = [slot, tv.act || "", tv.step, tv.met, tutorMin, tutorSkill].join("|");
    tutorPoint = tv.met || tutorMin ? [] : tv.point;
    if (box && box.dataset.sig === sig) return;
    if (!box) { box = document.createElement("div"); box.className = "np-tutor"; document.body.appendChild(box); }
    box.dataset.sig = sig;
    const g = tv.guide, gear = Object.keys(g.gear).map((sl) => ({slot: sl, item: {id: g.gear[sl]}}));
    const ta = tv.act || "tutorial";                                   // Amunet's, or a class tutor's (2026-10-17)
    // a painted tutor: the full-height portrait (art/people, tools/cut_portraits.py), big -- Cam: "make the character image
    // bigger. It is to small" (2026-10-17); else the card icon
    const big = g.look && g.look.pic && window.PEOPLE_PICS && window.PEOPLE_PICS[g.look.pic];
    const pic = big ? `<img class="np-tutor-pic painted big" alt="" src="art/people/${esc(g.look.pic)}.webp">`
      : g.look && g.look.pic ? `<img class="np-tutor-pic painted" alt="" src="${avatarURL(g.look, 128)}">` : youHTML(g.look, "a", gear, "np-tutor-pic");
    box.classList.toggle("min", tutorMin);
    if (tutorMin) {
      box.innerHTML = `<button class="np-tutor-bubble" title="${esc(g.name)} -- open the tutorial">${pic}${tv.met && tv.goal ? `<span class="np-tutor-dot">!</span>` : ""}</button>`;
      box.querySelector(".np-tutor-bubble").addEventListener("click", () => { tutorMin = false; try { localStorage.setItem("np-tutor-min", "0"); } catch (e) { /* */ } drawTutorial(); });
      return;
    }
    const bodyRow = tv.body ? `<div class="np-tutor-body">${[["m", "A boy", "body-m-a"], ["f", "A girl", "body-f-a"]].map(([b, n, pic]) =>
        `<button class="np-tutor-pick" data-tbody="${b}"><img alt="" src="art/player/${pic}.webp"><b>${n}</b></button>`).join("")}</div>` : "";
    const nameRow = tv.name ? `<div class="np-tutor-name">
        <input class="input" id="np-tutor-name" maxlength="24" placeholder="Your name" aria-label="Your name">
        <button class="btn btn-primary" id="np-tutor-me">That's me</button></div>` : "";
    const finale = tv.finale && !tv.skills ? `<div class="np-tutor-gifts">${tv.gifts.map((x) => `<span class="pp-need-chip"><img alt="" src="${itemIcon(x.id, 20)}">${x.n} × ${esc(x.name)}</span>`).join("")}</div>
        <button class="btn btn-primary" id="np-tutor-finish">Thank you, ${esc(g.name)}!</button>`
      : tv.finale ? `<div class="np-tutor-gifts">${tv.gifts.map((x) => `<span class="pp-need-chip"><img alt="" src="${itemIcon(x.id, 20)}">${x.n} × ${esc(x.name)}</span>`).join("")}</div>
        <select class="input" id="np-tutor-skill"><option value="">Choose a skill to bring to level 10…</option>
          ${tv.skills.map((k) => `<option value="${k.id}" ${tutorSkill === k.id ? "selected" : ""}>${esc(k.name)} (level ${k.level})</option>`).join("")}</select>
        <button class="btn btn-primary" id="np-tutor-finish" ${tutorSkill ? "" : "disabled"}>Thank you, ${esc(g.name)}!</button>` : "";
    box.innerHTML = `
      <div class="np-tutor-card" role="dialog" aria-label="Tutorial">
        ${pic}
        <div class="np-tutor-main">
          <div class="np-tutor-head"><b>${esc(g.name)}</b> <span class="stamp">${esc(g.title)} · ${tv.step + 1}/${tv.of}</span>
            <button class="np-tutor-x" title="Tuck the tutorial away" aria-label="Minimise">–</button></div>
          ${tv.say.map((p) => `<p>${esc(p)}</p>`).join("")}
          ${tv.goal ? `<div class="np-tutor-goal${tv.met ? " met" : ""}">${tv.met ? "✓" : "☐"} ${esc(tv.goal)}</div>` : ""}
          ${bodyRow}${nameRow}${finale}
          <div class="np-tutor-btns">
            ${tv.go ? `<button class="btn btn-sm" id="np-tutor-go">Take me there</button>` : ""}
            ${!tv.name && !tv.body && !tv.finale ? `<button class="btn btn-sm ${!tv.goal || tv.met ? "btn-primary" : ""}" id="np-tutor-next" ${!tv.goal || tv.met ? "" : "disabled"}>${tv.met && tv.goal ? "Well done -- next" : "Next"}</button>` : ""}
            ${tv.goal && !tv.met ? `<button class="btn btn-sm btn-quiet" id="np-tutor-skipstep">Skip this step</button>` : ""}
            <button class="btn btn-sm btn-quiet np-tutor-skip" id="np-tutor-skip">${ta === "classtut" ? "Skip the lesson" : "Skip tutorial"}</button>
          </div>
        </div>
      </div>`;
    const say = (r) => { if (r && r.error) toast(r.error, true); };
    const on = (sel, fn) => { const el = box.querySelector(sel); if (el) el.addEventListener("click", fn); };
    on(".np-tutor-x", () => { tutorMin = true; try { localStorage.setItem("np-tutor-min", "1"); } catch (e) { /* */ } drawTutorial(); });
    on("#np-tutor-go", () => tutorGo(tv.go));
    on("#np-tutor-next", async () => say(await act(ta, {op: "next"})));
    on("#np-tutor-skipstep", async () => say(await act(ta, {op: "skipstep"})));
    on("#np-tutor-skip", async () => { if (box.dataset.sure !== "1") { box.dataset.sure = "1"; box.querySelector("#np-tutor-skip").textContent = "Skip it -- sure?"; return; }
      say(await act(ta, {op: "skip"})); });
    box.querySelectorAll("[data-tbody]").forEach((b) => b.addEventListener("click", async () => say(await act("tutorial", {op: "body", body: b.dataset.tbody}))));
    const me = async () => {
      const r = await act("player", {name: box.querySelector("#np-tutor-name").value, look: {body: tv.chosen || "m"}});
      if (r && r.error) return say(r);
      say(await act("tutorial", {op: "next"}));
    };
    on("#np-tutor-me", me);
    const ni = box.querySelector("#np-tutor-name");
    if (ni) { ni.addEventListener("keydown", (e) => { if (e.key === "Enter") me(); }); setTimeout(() => ni.focus(), 50); }
    const sk = box.querySelector("#np-tutor-skill");
    if (sk) sk.addEventListener("change", () => { tutorSkill = sk.value; drawTutorial(); });
    on("#np-tutor-finish", async () => { const r = await act(ta, {op: "finish", skill: tutorSkill}); say(r); if (r && r.ok) toast("Your gifts are in your bag."); });
  }
  setInterval(() => { try { if (hostEl) drawTutorial(); } catch (e) { /* the tutorial never stops the game */ } }, 1000);
  // PT32 s1 (2026-10-19, Cam: "We need it to default at the estate screen please, or when in hell i should completely die and
  // see a game over screen. The game at the moment stays on the battle screen."): a fall while you watch leaves the fight --
  // you wake on the Estate; in Hell, the Game over page. (A fall seen first on opening the game just shows where you are.)
  let fallSeen = "";
  everySecond("fallwatch", () => {
    if (!hostEl) return;
    const {s, now} = current(), pv = Core.playerView(s, now), f = s.lastFall;
    const key = slot + ":" + (pv.dead ? "dead:" + pv.dead.at : f ? f.at : 0);
    if (!fallSeen.startsWith(slot + ":") || key === fallSeen) { fallSeen = key; return; }
    fallSeen = key;
    if (pv.dead) return render();
    if (f && now - f.at < 10 * 60000) { toast(`You fell to ${f.by} at the ${f.where} and woke by the fire at home.`, true); goTo("pet:estate"); }
  });

  let sheetFrom = "";
  function render() {
    if (!hostEl) return;
    const host = hostEl, page = view;
    setTimeout(() => { try { drawTutorial(); } catch (e) { console.error("tutorial", e); } }, 0);
    setTimeout(() => { try { kitRender(); } catch (e) { console.error("kit", e); } }, 0);   // the side panel (Modernize/Reduce Nav)
    try { cheerCheck(current().s); } catch (e) { /* a celebration never stops the page */ }
    try { unlockCheck(current().s); } catch (e) { /* nor an Unlocks pop-up */ }
    if (SS.petRendered) SS.petRendered(page);
    if (page === "dev:tools") return slot === "dev" ? renderDev(host) : renderHome(host);
    if (page === "dev:places") return slot === "dev" ? renderPlaces(host) : renderHome(host);
    { const c = current(), pv = Core.playerView(c.s, c.now);
      if (pv.dead && page !== "pet:saves" && page !== "pet:modder") return renderGameOver(host, pv); }         // the game is over: nothing else until you start again
    // the Character sheet (2026-10-15): Equipment is its Gear tab; arriving from elsewhere opens You (or Gear)
    if (page === "pet:gear" || page === "pet:skills") {
      if (sheetFrom !== page) { sheetFrom = page; sheetTab = page === "pet:gear" ? "gear" : "you"; }
      return renderSkills(host);
    }
    sheetFrom = "";
    if (page === "pet:hunt") return renderHunt(host);
    if (page === "pet:breed") return renderBreed(host);
    if (page === "pet:farm") return renderFarm(host);
    if (page === "pet:hatchery") return renderHatchery(host);
    if (page.startsWith("pet:") && Core.GATHERING.includes(page.slice(4))) return renderGather(host, page.slice(4));
    if (page === "pet:spellbook") return renderSpellbook(host);
    if (page === "pet:guild") return renderGuild(host);
    if (page === "pet:market") return renderMarket(host);                     // the Marketplace (2026-10-17)
    if (page === "pet:pen") return renderPen(host);                           // the Beast Pen (Battle Re-work Part 11a)                       // the Guild hall (Battle Re-work Part 9)
    if (page === "pet:enchants") return renderEnchants(host);
    if (page === "pet:village") return renderVillage(host, "village");
    if (page === "pet:workshop") return renderHouse(host);
    if (HUBS[page]) return renderHub(host, page);
    if (page === "pet:outskirts") return renderOutskirts(host);
    if (page === "pet:expeditions") return renderExpeditions(host);
    if (page === "pet:pets") return renderPets(host);
    if (page === "pet:dex") return renderDex(host);
    if (page === "pet:graveyard") return renderGraveyard(host);
    if (page === "pet:ranch") return renderRanch(host);
    if (page === "pet:camp") return renderCamp(host);
    if (page === "pet:bestiary") return renderBestiary(host);
    if (page === "pet:herbarium") return renderHerbarium(host);
    if (page === "pet:world") return renderWorld(host);
    if (page === "pet:dash") return renderHub(host, "pet:house");    // Today lives at Home now (2026-10-08)
    if (page === "pet:saves") return renderSaves(host);
    if (page === "pet:settings") return renderSettings(host);
    if (page === "pet:shipyard") return renderShipyard(host);
    if (page === "pet:pyramid") return renderPyramid(host);
    if (page === "pet:islandestate") return renderIslandEstate(host);
    if (page === "pet:modder") return renderModder(host);
    return renderHome(host);
  }

  function renderHome(host) {
    const {s, v} = current();
    if (!v.has) {                                                      // eggs are taken at the Hatchery now (I6)
      host.innerHTML = `<div class="pp-page"><div class="pp-group"><div class="pp-label">No pet yet</div>
        
        <div class="pp-row"><button class="btn btn-primary" id="pp-to-hatchery">Go to the Hatchery</button></div></div></div>`;
      host.querySelector("#pp-to-hatchery").addEventListener("click", () => goTo("pet:hatchery"));
      return;
    }
    // kibble is always there; everything else is what's in the bag
    const foods = [{id: "kibble", name: Core.FOODS.kibble.name, count: null}]
      .concat(Core.bagList(s).filter((b) => b.food)).map((f) =>
      `<button class="btn pp-act pp-food" data-act="feed" data-food="${f.id}" title="Feed ${esc(f.name)}">
         <img alt="" src="${itemIcon(f.id, 24)}"> ${esc(f.name)}${f.count == null ? "" : ` <span class="pp-count">${f.count}</span>`}</button>`).join("");
    const egg = v.stage === "egg";
    // a hatchling can be grown up at once: the charm and the elixir (2026-10-09; the cake is food)
    const grow = v.stage !== "hatchling" ? "" : Core.bagList(s).filter((b) => Core.ITEMS[b.id].ageUp && !b.food).map((f) =>
      `<button class="btn pp-act pp-food" data-act="use" data-item="${f.id}" title="${esc(f.does)}">
         <img alt="" src="${itemIcon(f.id, 24)}"> ${esc(f.name)} <span class="pp-count">${f.count}</span></button>`).join("");
    // potions for the pet (2026-10-10, Cam: "Potions should be accessible on companion pet page like food but seperate")
    const potions = Core.bagList(s).filter((b) => b.kind === "potion" && !Core.ITEMS[b.id].ageUp).map((f) =>
      `<button class="btn pp-act pp-food" data-act="use" data-item="${f.id}" title="${esc(f.does || "")}">
         <img alt="" src="${itemIcon(f.id, 24)}"> ${esc(f.name)} <span class="pp-count">${f.count}</span></button>`).join("");
    const pk = Core.packOf(s);
    const levelLine = egg ? "" : `${pk.kinds ? `<p class="stamp pp-pack">A ${pk.size} pet: carries ${pk.kinds} bag slots and +${pk.stack} a stack while it's with you.</p>` : ""}<div class="pp-petlevel"><span>Level ${v.level}</span>
      <span class="pp-bar"><span style="width:${Math.round(v.levelProgress * 100)}%"></span></span>
      ${v.injuredFor ? `<span class="pp-hurt">Hurt — resting ${v.injuredFor} min</span>` : ""}</div>`;
    const awayBox = v.away ? `<div class="pp-reveal"><div><b>${esc(v.name)} is on an expedition to the ${esc(v.away.areaName)}</b></div>
      <div class="stamp" id="pp-away-clock">Back in ${clock(v.away.backIn)} · ${Math.round(v.away.chance * 100)}% chance of success</div>
      <div><button class="btn btn-sm" id="pp-recall">Call back early</button></div></div>` : "";
    host.innerHTML = `
      <div class="pp-page">
        <div class="pp-layout">
          <div class="pp-stage">
            <canvas id="pp-room" width="640" height="300" title="${egg ? "" : "Give " + esc(v.name) + " some fuss"}"></canvas>
            <div class="pp-need" id="pp-need">${esc(v.need)}</div>
          </div>
          <div class="pp-side">
            ${hatcheryNote(Core.hatcheryView(s, Date.now()), Core.bagList(s).filter((b) => b.kind === "egg"))}
            ${levelLine}${awayBox}
            ${egg ? `<div class="pp-group" id="pp-egg-wait"><div class="pp-label">What might hatch</div>${oddsTable(v.egg)}
              <p class="stamp">It's a surprise until it hatches.</p></div>` : `
            ${v.named ? "" : `<div class="pp-reveal">
              <div><b>It's a ${esc(v.kind)}!</b> <span class="pp-rarity r-${esc(v.rarity.toLowerCase())}">${esc(v.rarity)}</span></div>
              <div class="pp-name"><input class="input" id="pp-name" maxlength="24" placeholder="Give it a name" aria-label="Give it a name">
                <button class="btn btn-primary" id="pp-name-save">Name it</button></div></div>`}
            ${v.away ? "" : `<div class="pp-stats" id="pp-stats">${Core.STATS.map((k) => bar(k, v.stats[k])).join("")}</div>
            <div class="pp-group"><div class="pp-label">Feed</div><div class="pp-row">${foods}</div></div>
            <div class="pp-group"><div class="pp-label">Potions</div><div class="pp-row">${potions || `<span class="stamp">No pet potions in your bag — brew them at the apothecary.</span>`}</div></div>
            ${grow ? `<div class="pp-group"><div class="pp-label">Grow up</div><div class="pp-row">${grow}</div></div>` : ""}
            <div class="pp-group"><div class="pp-label">Care</div><div class="pp-row">
              <button class="btn pp-act" data-act="play">Play</button>
              <button class="btn pp-act" data-act="${v.asleep ? "wake" : "rest"}">${v.asleep ? "Wake up" : "Rest"}</button>
              <button class="btn pp-act" data-act="clean">Clean</button>
              ${v.canMedicine ? `<button class="btn pp-act" data-act="medicine">Medicine</button>` : ""}
            </div></div>`}`}
            <p class="pp-status" id="pp-status">${esc(status)}</p>
            <div class="pp-group"><div class="pp-label">Diary</div>
              <ul class="pp-log">${(s.log || []).slice(0, 6).map((e) =>
                `<li><span>${esc(new Date(e.t).toLocaleString([], {weekday: "short", hour: "2-digit", minute: "2-digit"}))}</span> ${esc(e.text)}</li>`).join("")}</ul>
            </div>
            <button class="btn btn-quiet btn-sm pp-release" id="pp-release">Start over…</button>
          </div>
        </div>
      </div>`;
    const canvas = host.querySelector("#pp-room");
    canvas.addEventListener("click", () => { if (!egg) act("pet"); });
    host.querySelectorAll(".pp-act").forEach((b) => b.addEventListener("click", async () => {
      const r = await act(b.dataset.act, b.dataset.item ? {item: b.dataset.item} : {food: b.dataset.food});
      if (r && r.error) { status = r.error; toast(r.error, true); const el = host.querySelector("#pp-status"); if (el) el.textContent = status; }
    }));
    host.querySelector("#pp-release").addEventListener("click", async () => {
      const what = egg ? "this egg" : v.named ? v.name : `your ${v.kind.toLowerCase()}`;
      if (await askYes(`Say goodbye to ${what} and choose a new egg? This can't be undone.`)) act("release");
    });
    wireHatcheryNote(host);
    const recall = host.querySelector("#pp-recall");
    if (recall) recall.addEventListener("click", () => act("recall"));
    const nameBox = host.querySelector("#pp-name");
    if (nameBox) {
      const save = async () => {
        const r = await act("name", {name: nameBox.value});
        if (r && r.error) { status = r.error; toast(r.error, true); host.querySelector("#pp-status").textContent = status; }
      };
      host.querySelector("#pp-name-save").addEventListener("click", save);
      nameBox.addEventListener("keydown", (e) => { if (e.key === "Enter") save(); });
    }
    startRoom(canvas);
  }

  function haveEgg(k) { const st = states[slot] || {}; return Core.EGGS[k].take ? 0 : ((st.bag || {})[k + "egg"] || 0); }
  function canTake(k) { const st = states[slot] || {}; return Core.EGGS[k].take || !!(st.dev && st.dev.allEggs) || haveEgg(k) > 0; }
  function renderChooser(host) {
    const e = Core.EGGS[pick];
    host.innerHTML = `
      <div class="pp-page">
        <div class="pp-head"><div>
          <h2 class="page-h">NeuroPets</h2>
          
        </div></div>
        <div class="pp-eggs">${Core.EGG_ORDER.map((k) => {
          const x = Core.EGGS[k], n = haveEgg(k);
          return `<button class="pp-egg${k === pick ? " on" : ""}${canTake(k) ? "" : " locked"}" data-egg="${k}">
            <canvas width="80" height="96"></canvas>
            <span>${esc(x.name)}</span>
            <small>${canTake(k) ? "Hatches in " + hatchTime(x.hatch) + (n ? ` · you have ${n}` : "") : "Found in " + esc(x.found)}</small>
          </button>`;
        }).join("")}</div>
        <div class="pp-egg-info">
          <div class="pp-label">${esc(e.name)} · hatches in ${hatchTime(e.hatch)} · what might hatch</div>
          ${oddsTable(pick)}
          ${canTake(pick) ? `<button class="btn btn-primary" id="pp-take">${e.take ? "Take" : "Hatch"} the ${esc(e.name.toLowerCase())}</button>`
                   : `<p class="stamp">You'll find these in ${esc(e.found)}.</p>`}
        </div>
        <p class="pp-status" id="pp-status">${esc(status)}</p>
      </div>`;
    host.querySelectorAll(".pp-egg").forEach((b) => {
      const pe = paintedEgg(b.dataset.egg), cv = b.querySelector("canvas");
      if (pe) { const im = document.createElement("img"); im.src = pe; im.alt = ""; im.className = "pp-egg-pic"; cv.replaceWith(im); }
      else { const egg = Art.item("egg", b.dataset.egg); Art.draw(cv.getContext("2d"), egg.rows, egg.pal, 0, 0, 8, false); }
      b.addEventListener("click", () => { pick = b.dataset.egg; renderChooser(host); });
    });
    const take = host.querySelector("#pp-take");
    if (take) take.addEventListener("click", async () => {
      const r = await act("hatch", {egg: pick, roll: Math.random()});
      if (r && r.error) { status = r.error; toast(r.error, true); host.querySelector("#pp-status").textContent = status; }
    });
  }

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

  // ---- the item sheet (2026-10-07): what a thing does, where it comes from, what it's for, and what you can
  //      do with it -- from the bag, or any ingredient chip ----------------------------------------------
  // at the bank: its window is open, or you're in a store room (I8, 2026-10-19, Cam: "shouldnt be able to put something in the
  // bank from anywhere") -- the bank's buttons are only offered there
  const atBank = () => !!document.querySelector(".pp-store-modal") || view === "pet:storeroom" || view === "pet:islandestate";
  function showItem(id) {
    const {s, v, now} = current();
    const info = Core.itemInfo(s, id);
    if (!info) return;
    document.querySelectorAll(".pp-item-sheet").forEach((x) => x.remove());
    const pv = Core.playerView(s, now), it = Core.bagList(s).find((x) => x.id === id);
    const act1 = it ? bagAction(it, pv, v.has && v.stage !== "egg", v) : "";
    const box = document.createElement("div");
    box.className = "pp-modal pp-item-sheet";
    box.innerHTML = `<div class="pp-modal-card pp-sheet" role="dialog" aria-label="${esc(info.name)}">
        <button class="btn btn-quiet btn-sm pp-shop-x" aria-label="Close">✕</button>
        <div class="pp-sheet-head gem-${Math.min(info.gem, 7)}"><img alt="" src="${itemIcon(id, 64)}">
          <div><b>${esc(info.name)}</b><div class="stamp"><span class="pp-gem">◆ ${info.gem}</span> · in your bag: ${info.have.toLocaleString()}${info.stored ? ` · stored at home: ${info.stored.toLocaleString()}` : ""}${info.sellable ? ` · Marlow pays about ${eachTxt(info.price)}` : ""}</div>
            ${info.does ? `<div class="pp-sheet-does">${esc(info.does)}</div>` : ""}</div></div>
        <p class="pp-status" id="pp-sheet-status"></p>
        ${act1 || info.have || (info.stored && atBank()) ? `<div class="pp-sheet-acts">${act1}
          ${info.have && id !== "unidherb" && atBank() ? `<button class="btn btn-sm" data-sheet="store">Put in the bank</button>` : ""}
          ${info.stored && atBank() ? `<button class="btn btn-sm" data-sheet="withdraw">Take from the bank</button>` : ""}
          ${info.have && info.sellable ? `<button class="btn btn-sm btn-quiet" data-sheet="sell">Sell at Marlow's ›</button>` : ""}
          ${info.have ? `<button class="btn btn-sm btn-quiet pp-drop" data-sheet="drop" title="Throw it away, or recycle it">Drop…</button>` : ""}</div>` : ""}
        <div class="pp-sheet-cols">
          <section><h4>Where it comes from</h4>${info.from.length ? `<ul>${info.from.map((t) => `<li>${esc(t)}</li>`).join("")}${info.moreFrom ? `<li class="stamp">…and ${info.moreFrom} more</li>` : ""}</ul>` : `<p class="stamp">Nowhere you know of yet.</p>`}</section>
          <section><h4>What it's for</h4>${info.uses.length ? `<ul>${info.uses.map((t) => `<li>${esc(t)}</li>`).join("")}${info.moreUses ? `<li class="stamp">…and ${info.moreUses} more</li>` : ""}</ul>` : `<p class="stamp">Selling, mostly.</p>`}</section>
        </div>
      </div>`;
    document.body.appendChild(box);
    const close = () => { box.remove(); };
    box.addEventListener("click", (e) => { if (e.target === box) close(); });
    box.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
    box.querySelector(".pp-shop-x").addEventListener("click", close);
    box.querySelector(".pp-shop-x").focus();
    const said = (r) => { if (r && r.error) { box.querySelector("#pp-sheet-status").textContent = r.error; toast(r.error, true); } else { close(); } };
    box.querySelectorAll(".pp-bag-act").forEach((b) => b.addEventListener("click", async () => {
      const a = b.dataset.act;
      if (a === "open" || a === "readbook" || a === "usewith") { close(); return doBagAct(a, id); }
      said(await doBagAct(a, id));
    }));
    box.querySelectorAll("[data-sheet]").forEach((b) => b.addEventListener("click", async () => {
      const a = b.dataset.sheet;
      if (a === "sell") { close(); return goTo("shop:merchant"); }
      if (a === "drop") { close(); return dropAsk(id, info.have); }        // V7: the amount picker, Recycle offered first
      said(await act(a, {item: id, n: "all"}));
    }));
  }
  // any [data-iteminfo] opens its sheet (the bag's cards, ingredient chips) -- but not its own buttons
  document.addEventListener("click", (e) => {
    const el = e.target.closest && e.target.closest("[data-iteminfo]");
    if (!el || e.target.closest("button")) return;
    showItem(el.dataset.iteminfo);
  });
  document.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.matches && e.target.matches(".pp-item[data-iteminfo]")) { e.preventDefault(); showItem(e.target.dataset.iteminfo); }
  });
  // "Use with..." (V2, the UX lead's condition: "a clear 'Use with...' step that lights up only the items that combine")
  let bagUse = "";
  /** Into "Use with" -- only when something in the bag (or your knife) goes with it; else just say why (I5 x1, 2026-10-19). */
  function startUse(id) {
    const {s} = current(), partners = Core.fieldPartners(s, id), benches = benchesUsing(id);
    if (!partners.length) {
      if (benches.length) { benchFrom = id; goTo("pet:workshop"); return false; }   // (Q6 q4: the benches that use it light up)
      toast(Core.fieldWhy(s, id)[0] || "Nothing in your bag goes with that yet.", true); return false;
    }
    bagUse = id; return true;
  }
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && bagUse && !document.querySelector(".pp-modal")) { bagUse = ""; render(); } });

  // ---- the village (slice 3) ------------------------------------------------------------
  // Cam (2026-10-03): "Have the village screen prsented as cards, so then when i click on a card it
  // pops up with the respective menu. So only when i click on Bram will it pop up with brams
  // crafting menu."
  let openShop = "", shopQuery = "", shopQueryFor = "";
  // where each of your making skills is done
  const SKILL_SHOP = Object.fromEntries(Core.SKILL_REG.filter((k) => k.bench).map((k) => [k.id, k.bench]));   // a making skill's bench
  const coinTxt = (n) => `🪙 ${Number(n).toLocaleString()}`;
  // a price under a coin reads as so much per 100 (2026-10-10, audit MATH-5: "17 old boots for 1 coin" looked broken)
  const eachTxt = (n) => n > 0 && n < 1 ? `${coinTxt(Math.round(n * 100 * 100) / 100)} per 100` : `${coinTxt(n)} each`;
  function shopIcon(w, size) { return w.icon ? itemIcon(w.icon, size) : avatarURL(w.look, size); }
  function shopRecipesHTML(w) {
    return w.recipes.slice().sort((a, b) => a.level - b.level).map((r) => `
      <div class="pp-recipe${r.can ? "" : " short"}" data-find="${esc([r.name, r.does || "", ...r.needs.map((n) => n.name)].join(" ").toLowerCase())}">
        <img alt="" src="${itemIcon(r.make, 32)}">
        <div class="pp-recipe-main">
          <div><b>${r.n > 1 ? r.n + " × " : ""}${esc(r.name)}</b>${r.have ? ` <span class="pp-count">${r.have}</span>` : ""}
            <span class="stamp">${r.roomLock ? ` · <b class="pp-lock">${esc(r.roomLock.replace(" (build it at home)", ""))}</b>` : !r.open ? ` · <b class="pp-lock">needs level ${r.level}</b>` : ""}${r.xp ? ` · +${r.xp} xp` : ""}</span></div>
          <div class="stamp">${esc(r.does)}</div>
          <div class="pp-needs">${r.needs.map((n) => `<span class="pp-need-chip${n.have >= n.need ? "" : " lack"}" title="${esc(n.name)}${n.stored ? ` (${n.stored.toLocaleString()} of them in the bank)` : ""} -- click for where to get it" data-iteminfo="${n.id}">
            <img alt="" src="${itemIcon(n.id, 16)}">${n.have}/${n.need}</span>`).join("")}
            ${r.fee ? `<span class="pp-need-chip${w.coins >= r.fee ? "" : " lack"}" title="Coins">${coinTxt(r.fee)}</span>` : ""}</div>
        </div>
        <span class="pp-sellbtns">
        <button class="btn btn-sm pp-make" data-ws="${w.id}" data-make="${r.make}" data-i="${r.i}" ${r.can ? "" : "disabled"}>
          ${r.roomLock ? (/opens in the story/.test(r.roomLock) ? "Story" : "Upgrade") : !r.open ? `Level ${r.level}` : w.skill === "cooking" ? "Cook" : w.npc ? "Transmute" : w.id === "furnace" ? "Smelt" : w.id === "tanner" ? "Tan" : "Make"}</button>
        ${r.can && r.times > 1 ? `<button class="btn btn-sm btn-quiet pp-make" data-ws="${w.id}" data-make="${r.make}" data-i="${r.i}" data-times="all"
          title="Make it as many times as you have the ingredients for${w.npc ? " and the coins" : ""} — ${r.times}">${w.skill === "cooking" ? "Cook all" : "All"} (${r.times}${w.skill === "cooking" ? "" : "×"})</button>
        <button class="btn btn-sm btn-quiet pp-make" data-ws="${w.id}" data-make="${r.make}" data-i="${r.i}" data-times="ask" data-max="${Math.min(1000, r.times)}" data-name="${esc(r.name || Core.ITEMS[r.make].name)}" data-xp="${r.xp || 0}" title="Choose how many (V7)">×?</button>` : ""}
        </span>
      </div>`).join("");
  }
  // the Herb table (Herblore, 2026-10-06): unidentified herbs in, named herbs out -- and into the Herbarium
  const ROMAN = ["I", "II", "III", "IV", "V"];
  // (2026-10-20: these four in the crafting bench's look -- a grid on the left, the one you picked on the right)
  function identifyHTML(w) {
    const known = (t) => t.herbs.find((h) => h.known);
    const items = [{key: "unid", icon: itemIcon("unidherb", 48), name: "Unidentified herbs", badge: w.unid || "", can: !!w.unid}]
      .concat(w.identify.map((t) => ({key: "t" + t.tier, icon: itemIcon(known(t) ? known(t).id : "unidherb", 48), name: `Tier ${ROMAN[t.tier - 1]}`, corner: ROMAN[t.tier - 1], lock: !t.open, lockWord: `lv ${t.level}`, t})));
    return gridBenchHTML("herbs", [{id: "herbs", label: "Herbs", items}], (it) => {
      if (it.key === "unid") return gbHead(itemIcon("unidherb", 64), "Unidentified herbs", [`${w.unid || 0} in your bag`, `Herbarium ${w.found}/${w.total}`])
        + `
        <div class="pp-row"><button class="btn btn-primary pp-bmake pp-identify" ${w.unid ? "" : "disabled"}>IDENTIFY</button>${w.unid > 1 ? `<button class="btn pp-identify" data-all="1">All ${w.unid}</button>` : ""}</div>`;
      const t = it.t;
      return gbHead(itemIcon(known(t) ? known(t).id : "unidherb", 64), `Tier ${ROMAN[t.tier - 1]}`, [`Herblore ${t.level}`, `+${t.xp} xp each`, t.double ? `${Math.round(t.double * 100)}% in twos` : ""])
        + `<div class="pp-label">Its herbs</div>${t.herbs.map((h) => h.known ? gbMat(h.id, esc(h.name), true) : `<div class="pp-bmat no"><span>? ? ? -- not yet identified</span></div>`).join("")}`;
    });
  }
  // the notice board (2026-10-07): three orders a day, for the things you've plenty of
  function ordersHTML(w) {
    const items = w.orders.map((o) => ({key: "o" + o.i, icon: itemIcon(o.id, 48), name: `${o.n} × ${o.name}`, badge: o.done ? "✓" : `${o.have}/${o.n}`, can: o.can, o}));
    return gridBenchHTML("orders", [{id: "orders", label: "Orders", items, empty: "Nothing on the board yet — go gathering first."}], (it) => { const o = it.o;
      return gbHead(itemIcon(o.id, 64), `${o.n} × ${esc(o.name)}`, [coinTxt(o.coins), `+${o.xp} ${esc(o.skill)} xp`, "a wooden crate"])
        + `${gbMat(o.id, `${o.have}/${o.n}`, o.have >= o.n)}
        <button class="btn btn-primary pp-bmake pp-order" data-i="${o.i}" ${o.can ? "" : "disabled"}>${o.done ? "FILLED ✓" : "FILL"}</button>`; });
  }
  // the grindstone (2026-10-15): every weapon you hold or carry -- where it is, how worn, and its one re-tempering
  function grindHTML(w) {
    const items = w.grind.map((x) => ({key: x.id, icon: itemIcon(x.id, 48), name: x.name, badge: `${100 - x.pct}%`, can: !!x.retemper, x}));
    return gridBenchHTML("grind", [{id: "grind", label: "Weapons", items, empty: "No weapons on you. Every weapon you hold or carry shows here, with how worn it is."}], (it) => { const x = it.x;
      return gbHead(itemIcon(x.id, 64), esc(x.name), [esc(x.where) + (x.count > 1 ? ` (×${x.count})` : ""), x.tempered ? "re-tempered" : ""])
        + `<div class="pp-slot-wear"><span class="pp-wear" title="${x.left} of ${x.dur} blows left"><span style="width:${100 - x.pct}%" class="${x.pct >= 90 ? "low" : x.pct >= 75 ? "mid" : ""}"></span></span>
          <span class="stamp">${x.left.toLocaleString()} of ${x.dur.toLocaleString()} blows left</span></div>
        ${x.retemper ? `<div class="pp-label">Re-tempering takes</div>${x.retemper.coins ? `<div class="pp-bmat"><span>${coinTxt(x.retemper.coins)}</span></div>` : Object.keys(x.retemper.needs).map((k) => gbMat(k, `${x.retemper.needs[k]} ${esc(Core.ITEMS[k].name.toLowerCase())}`)).join("")}` : `<p class="stamp">${esc(x.why)}</p>`}
        
        <button class="btn btn-primary pp-bmake pp-grind" data-item="${esc(x.id)}" ${x.retemper ? "" : "disabled"}>RE-TEMPER</button>`; });
  }
  // the altar: the enchants you've learnt (what in your bag they go on), and the gems it cuts in the bench's own look
  let altarTab = "enchants";
  function altarHTML(w) {
    const seg = w.recipes.length ? `<div class="pp-btabs pp-altar-tabs"><button class="pp-btab${altarTab !== "gems" ? " on" : ""}" data-altartab="enchants">Enchants <small>${w.altar.length}</small></button>
      <button class="pp-btab${altarTab === "gems" ? " on" : ""}" data-altartab="gems">Enchanting gems <small>${w.recipes.length}</small></button></div>` : "";
    if (altarTab === "gems" && w.recipes.length) return seg + benchHTML(w);
    const items = w.altar.map((e) => ({key: e.id, icon: itemIcon("tome" + e.id, 48), name: e.name, corner: e.level, lock: !e.open, can: e.open && e.costOk && e.coinsOk && e.targets.length > 0, e}));
    return seg + gridBenchHTML("altar", [{id: "ench", label: "Enchants", items, empty: "You don't know any enchants yet. Their tomes are found in ancient chests: bosses drop them now and then, the mage tower gives one for each rank."}], (it) => { const e = it.e;
      return gbHead(itemIcon("tome" + e.id, 64), esc(e.name), [`Enchanting ${e.level}`, "on " + esc(e.slots.join(", ").toLowerCase())])
        + `<p class="stamp">${esc(e.about)}</p>
        <div class="pp-label">It takes</div>${e.cost.map((c) => gbMat(c.id, `${c.have}/${c.need}`, c.have >= c.need)).join("")}
        <div class="pp-bmat${e.coinsOk ? " ok" : " no"}"><span>${coinTxt(e.coins)}</span></div>
        ${e.on.length ? `<p class="stamp">On now: ${esc(e.on.join(", "))}</p>` : ""}
        ${e.targets.length ? `<div class="pp-label">Put it on</div><select class="input pp-ench-pick" data-ench="${e.id}">${e.targets.map((t) => `<option value="${t.id}">${esc(t.name)}${t.has ? ` (${esc(t.has)})` : ""}</option>`).join("")}</select>
          <button class="btn btn-primary pp-bmake pp-enchant" data-ench="${e.id}" ${e.open && e.costOk && e.coinsOk ? "" : "disabled"}>ENCHANT</button>` : `<p class="stamp">Nothing in your bag it can go on.</p>`}`; });
  }
  function shopHeadHTML(w) {
    return `<div class="pp-shop-head">
        <img class="pp-npc" alt="" src="${shopIcon(w, 48)}">
        <div><b>${esc(w.npc ? `${w.who} the ${w.name.toLowerCase()}` : w.name)}</b>
          ${w.skill ? `<span class="pp-level">${esc(Core.SKILLS[w.skill].name)} level ${w.level}</span>` : ""}
          <span class="pp-level pp-coins">${coinTxt(w.coins)}</span>
          <div class="stamp">“${esc(w.says)}”</div></div>
      </div>
      ${w.skill ? `<div class="pp-npc-level"><span class="pp-bar"><span style="width:${Math.round(w.progress * 100)}%"></span></span>
        <span class="stamp">${w.toNext ? `${w.toNext.toLocaleString()} xp to level ${w.level + 1}` : "top level"} (your ${esc(Core.SKILLS[w.skill].name)})</span></div>` : ""}`;
  }
  // Cam (2026-10-04): "move all craft benchs to a new menu called workshop ... Village stays and is the
  // place you can find all the NPC" -- one page draws both, the workshops or the people.
  // painted in the village but not always there (petcore npcHere)
  const VILLAGE_AWAY = [["travelling", "only in town on Sundays", "Sundays"], ["reskinner", "comes once you've beaten two bosses", "After 2 bosses"]];
  function renderVillage(host, mode) {
    const {s, now} = current();
    const people = mode !== "workshop";
    const shops = Core.villageView(s, now).filter((w) => w.npc === people && !w.region);   // (the mirage merchant is at the Oasis)
    host.innerHTML = `
      <div class="pp-page">
        <p class="pp-status" id="pp-status">${esc(status)}</p>
        ${people ? "" : ``}
        ${people ? paintedHTML("village", ["pet:guild", "pet:nursery", "pet:market"].map((k) => ({key: k, name: {"pet:guild": "The Guild hall", "pet:nursery": "The Nursery", "pet:market": "The Marketplace"}[k]}))
            .concat(shops.map((w) => ({key: w.id, name: `${w.who} -- ${w.name}`,
              note: w.orders ? (w.ordersLeft ? `${w.ordersLeft} order${w.ordersLeft === 1 ? "" : "s"} today` : "") : w.identify && w.unid ? `${w.unid} to identify` : ""})), VILLAGE_AWAY.filter(([k]) => !shops.some((w) => w.id === k))
              .map(([k, lock, short]) => ({key: k, name: `${Core.WORKSHOPS[k].who} -- ${Core.WORKSHOPS[k].name}`, lock, lockShort: short})))) : ""}
        <div class="pp-village"${people ? " hidden" : ""}>${shops.map((w) => {
          const can = w.identify ? (w.unid ? 1 : 0) : w.orders ? w.orders.filter((o) => o.can).length : w.recipes.filter((r) => r.can).length;
          const sub = w.npc ? w.name : `${Core.SKILLS[w.skill].name} · level ${w.level}`;
          const line = w.orders ? (w.ordersLeft ? `${w.ordersLeft} order${w.ordersLeft === 1 ? "" : "s"} today` : "All filled — more tomorrow") : w.identify ? (can ? `${w.unid} herb${w.unid === 1 ? "" : "s"} to identify · Herbarium ${w.found}/${w.total}` : `Herbarium ${w.found}/${w.total} · find herbs foraging and digging`) : w.trade ? (w.id === "travelling" ? "Exotic eggs · pays more" : "Buy and sell") : w.reskin ? "Recolour a pet"
            : w.npc && !can ? "Lots of one thing into one better"
            : can ? `${can} thing${can === 1 ? "" : "s"} you can make now` : "Nothing you can make yet";
          return `<button class="pp-villager${w.npc ? " is-npc" : ""}" data-ws="${w.id}">
            <img alt="" src="${shopIcon(w, 64)}">
            <b>${esc(w.npc ? w.who : w.name)}</b><span class="stamp">${esc(sub)}</span>
            ${w.skill ? `<span class="pp-bar"><span style="width:${Math.round(w.progress * 100)}%"></span></span>` : ""}
            <span class="stamp">${esc(line)}</span></button>`;
        }).join("")}</div>
      </div>`;
    host.querySelectorAll(".pp-villager[data-ws]").forEach((b) => b.addEventListener("click", () => { openShop = b.dataset.ws; showShop(); }));
    host.querySelectorAll("[data-door]").forEach((b) => b.addEventListener("click", () => goTo(b.dataset.door)));
    wirePainted(host, (key) => { if (key.startsWith("pet:")) return goTo(key);
      const away = VILLAGE_AWAY.find(([k]) => k === key && !shops.some((w) => w.id === k));
      if (away) return toast(`${Core.WORKSHOPS[key].who} isn't here -- ${away[1]}.`, true);
      openShop = key; showShop(); });
    if (openShop) showShop();
  }
  // ---- the estate and its buildings, and the nursery (2026-10-08, Cam: "workshop is where all the workshop
  //      stuff will live, the library is where all the books will live ... nursery is where Hatchery and breeding
  //      will be. Equipment, storeroom will live in storeroom. Bag, player, pets, my pet, expeditions will be at
  //      home ... This is all to move to a navigation style game.") -- each is a place with doors to the pages
  const HUBS = {
    "pet:estate": {scene: "estate", say: "Your own corner of the isle: the house, the workshop, the library, the store room -- and the graveyard.",
                   doors: ["pet:house", "pet:workshop", "pet:library", "pet:storeroom", "pet:graveyard", "pet:ranch", "pet:pen"], extra: [["cart", "Cart shed"]]},
    "pet:house": {scene: "house", say: "Home. Your pet, your bag, you -- and the bedroom, where a rest heals you faster.",
                  doors: ["pet:home", "pet:pets", "pet:bag", "pet:skills", "pet:expeditions"], room: "bedroom",
                  extra: [["room:bedroom", "Bedroom"], ["materials", "Material archive"], ["sec:hearth"], ["sec:dining"]], secs: ["hearth", "dining"]},
    "pet:library": {scene: "library", say: "Every book you keep: spells, enchants, herbs, creatures and pets.",
                    doors: ["pet:spellbook", "pet:enchants", "pet:herbarium", "pet:bestiary", "pet:dex"],
                    extra: [["sec:archive"], ["sec:reading"], ["sec:stacks"], ["sec:observatory"]], secs: ["archive", "reading", "stacks", "observatory"]},
    // (Equipment left the Storeroom for the Character sheet, 2026-10-15)
    "pet:storeroom": {scene: "storeroom", say: "The bank -- what's stored here is safe, even if you fall. The recycle stash by the barrels breaks old things down.",
                      doors: [], room: "storeroom", extra: [["room:storeroom", "Bank"], ["recycle", "Recycle stash"], ["recycled", "Recycled materials"]]},
    "pet:nursery": {scene: "nursery", say: "Where eggs are kept warm and pets are paired up.", doors: ["pet:hatchery", "pet:breed"], extra: [["pet:village", "Village"]]}};
  // ---- life at home, on the page (2026-10-08): the hearth and the table at Home; the archive, the reading chair,
  //      the stacks and the observatory in the Library. The painted places scroll to these sections.
  const SECTIONS = {hearth: "Hearth", dining: "Dining table", archive: "Forbidden archive", reading: "Cozy hearth", stacks: "Ancient stacks", observatory: "Astro observatory"};
  let potPick = {};
  /** A painted section's badge: what's going on there now. */
  function secPlace(k) {
    const {s, now} = current(), hv = Core.homeView(s, now), p = {key: "sec:" + k, name: SECTIONS[k]};
    if (k === "hearth") { if (hv.pot) { p.note = hv.pot.ready ? "Stew's ready" : "Cooking"; p.ready = hv.pot.ready; } }
    if (k === "dining" && hv.fed) p.note = `Well fed +${Math.round(hv.fed.xp * 100)}%`;
    if (k === "archive") { if (!hv.archive.open) { if (hv.archive.key) { p.note = "You have the key"; p.ready = true; } else { p.lock = "locked -- Grizz carries the key"; p.lockShort = "Locked"; } }
      else p.note = `${hv.archive.found}/${hv.archive.total} pages`; }
    if (k === "reading" && hv.reading) p.note = "Reading";
    if (k === "stacks" && hv.researching) p.note = "Researching";
    if (k === "observatory") { if (hv.stars.buff) p.note = hv.stars.buff.name; else if (hv.stars.night && !hv.stars.looked) { p.note = "Stars are out"; p.ready = true; } }
    return p;
  }
  const secHead = (k, extra) => `<section class="pp-shop pp-home-sec" id="pp-sec-${k}"><b>${esc(SECTIONS[k])}</b>${extra ? ` <span class="stamp">${extra}</span>` : ""}`;
  function hearthHTML(hv) {
    const n = Object.values(potPick).reduce((a, b) => a + b, 0);
    return `${secHead("hearth", "· a slow-cooked stew while you're out")}
      ${hv.pot ? (hv.pot.ready ? `<p>The ${esc(hv.pot.name.toLowerCase())} is ready -- ${hv.pot.n} bowls.</p><button class="btn btn-primary" data-home="potcollect">Ladle it out</button>`
          : `<p>${esc(hv.pot.name)} for ${hv.pot.n} on the hearth -- ready in <b>${clock(hv.pot.readyIn)}</b>.</p>`)
        : `<p class="stamp">Put ${hv.potMin} to ${hv.potMax} ingredients in the pot; ${hv.potMins} minutes later, a bowl of stew for each.
            The better the ingredients, the better the stew: ${hv.stews.map((x) => `${esc(x.name.toLowerCase())} (heals ${x.heal})`).join(", ")}.</p>
          ${hv.ingredients.length ? `<div class="pp-pot-pick">${hv.ingredients.map((x) => `<button class="pp-need-chip pp-pot-add" data-pot="${x.id}" ${(potPick[x.id] || 0) >= x.have || n >= hv.potMax ? "disabled" : ""}
              title="Worth ${x.worth} in a stew"><img alt="" src="${itemIcon(x.id, 16)}">${esc(x.name)} ${potPick[x.id] ? `<b>${potPick[x.id]}</b>/` : ""}${x.have}</button>`).join("")}</div>
            <div class="pp-place-btns"><button class="btn btn-primary" data-home="pot" ${n >= hv.potMin ? "" : "disabled"}>Start the pot (${n})</button>
              ${n ? `<button class="btn btn-quiet" id="pp-pot-clear">Clear</button>` : ""}</div>`
          : `<p class="stamp">Nothing in your bag for a stew -- fruit, vegetables, raw fish or meat.</p>`}`}
      </section>`;
  }
  function diningHTML(hv) {
    return `${secHead("dining", "· sit down to a proper meal")}
      ${hv.fed ? `<p>Well fed (${esc(hv.fed.name.toLowerCase())}): <b>+${Math.round(hv.fed.xp * 100)}% xp</b> for another ${clock(hv.fed.endsIn)}.</p>` : ""}
      <p class="stamp">A meal at the table heals you, cheers your pet, and gives you xp for an hour -- the better the dish, the more (a stew a little extra).
        One meal at a time: a new one takes over.</p>
      ${hv.meals.length ? `<div class="pp-pot-pick">${hv.meals.slice(0, 16).map((x) => `<button class="pp-need-chip" data-dine="${x.id}"><img alt="" src="${itemIcon(x.id, 16)}">${esc(x.name)} ×${x.have} · +${Math.round(x.xp * 100)}%</button>`).join("")}</div>`
        : `<p class="stamp">Nothing cooked in your bag -- the kitchen or the hearth will fix that.</p>`}
      </section>`;
  }
  function archiveHTML(hv) {
    const a = hv.archive;
    return `${secHead("archive", `· ${a.found}/${a.total} torn pages found`)}
      ${a.open ? `<p class="stamp">Torn pages turn up now and then when you explore -- one in each region. Put them back together for what's pressed between them:
          ${a.rewards.map((r) => `${r.got ? "✓ " : ""}${r.at} pages: ${esc(r.what)}`).join(" · ")}.</p>
          <div class="pp-beasts">${a.pages.map((p) => p.found ? `<div class="pp-beast"><b>${esc(p.name)}</b><div class="stamp">${esc(p.text)}</div></div>`
            : `<div class="pp-beast unknown"><b>???</b><div class="stamp">A page from the ${esc(p.name)}</div></div>`).join("")}</div>`
        : a.key ? `<p>The archive key fits the gate.</p><button class="btn btn-primary" data-home="archive">Unlock the archive</button>`
        : `<p class="stamp">Behind the gate, shelves of torn books. The key's said to be with Grizz, in the Deep Forest -- and you've found ${a.found} torn page${a.found === 1 ? "" : "s"} already, exploring.</p>`}
      </section>`;
  }
  function readingHTML(hv) {
    return `${secHead("reading", "· read when you're home and idle")}
      ${hv.reading ? `<p>Reading about ${esc(hv.reading.name.toLowerCase())} -- ${hv.reading.xp} xp in <b>${clock(hv.reading.endsIn)}</b>.</p><button class="btn btn-quiet" data-home="stopread">Put the book down</button>`
        : `
          <div class="pp-place-btns"><select class="input" id="pp-read-skill">${hv.books.map((b) => `<option value="${b.skill}">${esc(b.name)} (+${b.xp} xp)</option>`).join("")}</select>
            <button class="btn btn-primary" id="pp-read-go" ${hv.busy ? "disabled" : ""}>Read (${hv.readMins} min)</button></div>
          ${hv.busy ? `<p class="stamp">${esc(hv.busy)}</p>` : ""}`}
      </section>`;
  }
  function stacksHTML(hv) {
    return `${secHead("stacks", hv.researching ? `· researching ${esc(hv.researching.name.toLowerCase())}${hv.researching.id === "plague" ? "" : " " + hv.researching.level} -- ${clock(hv.researching.endsIn)} left` : "· one project at a time")}
      <div class="pp-area pp-tablet"><div class="pp-skill-head"><b>The plague tablet</b><span class="pp-level">${hv.glyphs.filter((g) => g.have).length}/6 glyphs</span></div>
        <div class="stamp">Six glyphs from the desert and the river. Read together here (${hv.decipherHours} hours), they wake something.${hv.plagues ? ` You've read it ${hv.plagues}×.` : ""}</div>
        <div class="pp-needs">${hv.glyphs.map((g) => `<span class="pp-need-chip${g.have ? "" : " lack"}" data-iteminfo="${g.id}" title="${esc(g.from)}"><img alt="" src="${itemIcon(g.id, 16)}">${esc(g.name)}</span>`).join("")}</div>
        <button class="btn btn-sm ${hv.canDecipher ? "btn-primary" : ""}" data-home="decipher" ${hv.canDecipher ? "" : "disabled"}>Decipher</button></div>
      <div class="pp-areas">${hv.research.map((r) => `<div class="pp-area">
        <div class="pp-skill-head"><b>${esc(r.name)}</b><span class="pp-level">Level ${r.level} of ${r.max}</span></div>
        <div class="stamp">${esc(r.says)}.</div>
        ${r.next ? `<div class="pp-needs"><span class="pp-need-chip${r.next.libraryOk ? "" : " lack"}">${esc(r.next.library)} library</span><span class="pp-need-chip">${coinTxt(r.next.coins)}</span>${r.next.items.map((i) => `<span class="pp-need-chip${i.have >= i.need ? "" : " lack"}" data-iteminfo="${i.id}"><img alt="" src="${itemIcon(i.id, 16)}">${i.have}/${i.need}</span>`).join("")}
            <span class="pp-need-chip">${r.next.hours} h</span></div>
          <button class="btn btn-sm ${r.next.can ? "btn-primary" : ""}" data-research="${r.id}" ${r.next.can ? "" : "disabled"}>Research</button>` : `<div class="stamp">Done.</div>`}
      </div>`).join("")}</div>
      </section>`;
  }
  function observatoryHTML(hv) {
    const st = hv.stars;
    return `${secHead("observatory", `· this week: ${esc(st.name)} (${esc(st.skill)})`)}
      ${st.buff ? `<p>${esc(st.buff.name)} is with you: <b>+10% ${esc(st.buff.skill)} xp</b> until morning.</p>` : ""}
      
      ${st.night ? (st.looked ? `<p class="stamp">You've looked tonight. Come back tomorrow night.</p>` : `<button class="btn btn-primary" data-home="stargaze">Look at the stars</button>`)
        : `<p class="stamp">The sky's too bright -- come back after 9 at night.</p>`}
      </section>`;
  }
  function wireHome(host) {
    const doIt = async (a, o) => { const r = await act(a, Object.assign({roll: Math.random()}, o || {})); if (r && r.error) { status = r.error; toast(r.error, true); render(); } };
    host.querySelectorAll("[data-home]").forEach((b) => b.addEventListener("click", () => {
      if (b.dataset.home === "pot") { const items = potPick; potPick = {}; return doIt("pot", {items}); }
      doIt(b.dataset.home);
    }));
    host.querySelectorAll(".pp-pot-add").forEach((b) => b.addEventListener("click", () => { potPick[b.dataset.pot] = (potPick[b.dataset.pot] || 0) + 1; render(); }));
    const pc = host.querySelector("#pp-pot-clear"); if (pc) pc.addEventListener("click", () => { potPick = {}; render(); });
    host.querySelectorAll("[data-dine]").forEach((b) => b.addEventListener("click", () => doIt("dine", {food: b.dataset.dine})));
    host.querySelectorAll("[data-research]").forEach((b) => b.addEventListener("click", () => doIt("research", {id: b.dataset.research})));
    const rg = host.querySelector("#pp-read-go"); if (rg) rg.addEventListener("click", () => doIt("read", {skill: host.querySelector("#pp-read-skill").value}));
  }
  /** A painted place for a hub: a door (page), or one of extra [key, name]. */
  function hubPlace(k, name) {
    if (k.startsWith("sec:")) return secPlace(k.slice(4));
    if (k === "cart") {                                             // the cart: out on the road, or waiting to be loaded
      const {s, now} = current(), cv = Core.cartView(s, now), p = {key: k, name};
      if (!cv.tier) p.note = "Build one";
      else if (cv.out) p.note = `Out · back in ${clock(cv.out.backIn)}`;
      else if (cv.load.length) { p.note = `${cv.load.length} loaded`; p.ready = true; }
      return p;
    }
    if (k === "pet:ranch") {                                        // the Farm (2026-10-12): Fern waiting, eggs ready, hens hungry
      const {s, now} = current(), rv = Core.ranchView(s, now), p = {key: k, name: "The Farm"};
      if (!rv.open) { p.note = rv.fern && rv.fern.quest && rv.fern.quest.can ? "Fern's waiting" : "Overgrown"; p.ready = !!(rv.fern && rv.fern.quest && rv.fern.quest.can); }
      else if (rv.waiting) { p.note = `${rv.waiting} ready`; p.ready = true; }
      else if (rv.hungry) p.note = "Hungry";
      return p;
    }
    if (k === "recycle" || k === "recycled") {                      // the recycle stash: what's breaking down, what's ready to use
      const {s, now} = current(), rv = Core.recycleView(s, now), p = {key: k, name};
      if (k === "recycle" && rv.stash.lots.length) { p.note = rv.stash.lots.some((l) => l.waiting) ? "Store full" : `${rv.stash.lots.length} breaking down`; }
      if (k === "recycled" && (rv.store.used || rv.points >= 1)) { p.note = [rv.store.used ? `${rv.store.used}/${rv.store.cap} kinds` : "", rv.points >= 1 ? `♻ ${Math.floor(rv.points)}` : ""].filter(Boolean).join(" · "); p.ready = rv.store.used >= rv.store.cap; }
      return p;
    }
    return {key: k, name: name || doorOf(k)[0]};
  }
  /** A click on a hub's painted place: a page, a room (scroll to it), the materials list, or what's to come. */
  function hubGo(host, key) {
    if (key === "pet:spellbook") return openBook("arcane", "spells");  // a pop-up in the Library: the Arcane's book, at its spells (C4 D5)
    if (key.startsWith("pet:")) return goTo(key);
    if (key === "room:storeroom") return showStore();                  // the Bank, straight away (Modernize/Reduce Nav: one click, not two)
    if (key.startsWith("sec:") || key.startsWith("room:") || key === "materials" || key === "recycle" || key === "recycled" || key === "cart") return openPlace(key);
  }
  /** A door: what a page is called, its picture and a line about it now. */
  function doorOf(key) {
    const {s, v, now} = current(), pl = s.player || {};
    const pic = v.has && v.stage !== "egg" ? petURL(v.species, v.colour, 48, "ok", v.skin) : itemIcon("starteregg", 48);
    const D = {
      "pet:estate": ["Your estate", itemIcon("obj_house", 48), "House, workshop, library, storeroom, graveyard"],
      "pet:nursery": ["The Nursery", itemIcon("commonegg", 48), (() => { const n = Core.hatcheryView(s, now).eggs.length; return n ? `Hatching and breeding · ${n} egg${n === 1 ? "" : "s"}` : "Hatching and breeding"; })()],
      "pet:house": ["House", itemIcon("obj_house", 48), "Your pet, your bag and you"],
      "pet:workshop": ["Workshop", itemIcon("obj_anvil", 48), "Every bench: cooking, smithing, crafting and more"],
      "pet:library": ["Library", itemIcon("tomekeen", 48), "Spellbook, enchants, Herbarium, Bestiary, Petapedia"],
      "pet:storeroom": ["Storeroom", itemIcon("woodcrate", 48), "The bank and the recycle stash"],
      "pet:graveyard": ["Graveyard", itemIcon("bones", 48), "The pets lost on expeditions"],
      "pet:pen": ["Beast Pen", itemIcon("grainfeed", 48), "Battle pets: stalls, training and rest"],
      "pet:ranch": ["The Farm", itemIcon("obj_ranch", 48), Core.ranchOpen(s) ? "Your hens, the Feed store and Fern's stall" : "An overgrown track -- Fern has an idea"],
      "pet:home": [v.has && v.name ? v.name : "My pet", pic, v.has ? (v.need || "Feed, play and keep clean") : "Choose an egg"],
      "pet:pets": ["Pets", pic, "Your companion and the den"],
      "pet:bag": ["Bag", itemIcon("willowbasket", 48), `${Core.bagUsed(s)}/${Core.bagCap(s)} slots`],
      "pet:skills": ["Character", youURL(pl.look), `Total level ${Core.playerView(s, now).totalLevel}`],
      "pet:expeditions": ["Expeditions", itemIcon("woodcrate", 48), v.away ? `${v.name} is away: ${v.away.areaName}` : "Send your pet exploring"],
      "pet:spellbook": ["Spellbook", itemIcon("tomearcanist", 48), "Spells, runes and your three for a fight"],
      "pet:enchants": ["Enchant book", itemIcon("tomeflaming", 48), "The enchants you've learnt"],
      "pet:herbarium": ["Herbarium", itemIcon("herb", 48), "Every herb you've identified"],
      "pet:bestiary": ["Bestiary", itemIcon("batwing", 48), "Every creature you and your pets have met"],
      "pet:dex": ["Petapedia", itemIcon("clover", 48), "Every pet on the isle"],
      "pet:gear": ["Equipment", itemIcon("bronzehelm", 48), "What you and your pet wear"],
      "pet:hatchery": ["Hatchery", itemIcon("commonegg", 48), (() => { const n = Core.hatcheryView(s, now).eggs.length; return n ? `${n} egg${n === 1 ? "" : "s"} keeping warm` : "Eggs hatch here"; })()],
      "pet:breed": ["Breeding", itemIcon("heart", 48), "Two pets, an hour together, an egg"]};
    return D[key] || [key, itemIcon("obj_map", 48), ""];
  }
  function doorsHTML(keys) {
    return `<div class="pp-village pp-places">${keys.map((k) => { const [name, pic, line] = doorOf(k);
      return `<button class="pp-villager pp-place-card pp-door" data-door="${k}"><img alt="" src="${pic}"><b>${esc(name)}</b><span class="stamp pp-place-line">${esc(line)}</span></button>`; }).join("")}</div>`;
  }
  // ---- Home (2026-10-08, Cam: "start at home when the game first loads, which will have the today features, also it
  //      should have a collapsed menu that shows all unlocked materials and where to get them") -------------------------
  let materialsOpen = false, materialsQuery = "";
  /** Every material you can gather now (open region, spot not locked), by skill, and where. */
  function materialsList() {
    const {s, now} = current(), bySkill = {};
    Core.REGION_ORDER.forEach((r) => {
      const lv = Core.landView(s, r, now);
      if (!lv || !lv.open) return;
      lv.spots.forEach((sp) => {
        if (sp.lock) return;
        const def = Core.SKILLS[sp.skill].spots.find((x) => x.id === sp.id);
        const items = bySkill[sp.skill] = bySkill[sp.skill] || {};
        ((def && def.loot) || []).forEach((l) => { const id = l[0];
          if (!Core.ITEMS[id]) return;
          (items[id] = items[id] || []).push({region: r, regionName: lv.name, spot: sp.name, skill: sp.skill, spotId: sp.id}); });
      });
    });
    return Core.GATHERING.filter((k) => bySkill[k]).map((k) => ({skill: k, name: Core.SKILLS[k].name,
      items: Object.keys(bySkill[k]).map((id) => ({id, name: Core.ITEMS[id].name, where: bySkill[k][id]})).sort((a, b) => a.name.localeCompare(b.name))}));
  }
  function materialsHTML(inSheet) {
    const list = materialsList(), n = new Set([].concat(...list.map((g) => g.items.map((x) => x.id)))).size;
    return `<details class="pp-shop pp-materials" id="pp-materials"${materialsOpen || inSheet ? " open" : ""}>
      <summary><b>Materials you can gather</b> <span class="stamp">${n} kinds — and where</span></summary>
      <input class="input" id="pp-mat-q" type="search" placeholder="Find a material…" value="${esc(materialsQuery)}" aria-label="Find a material">
      ${list.map((g) => `<div class="pp-mat-group"><div class="pp-label">${esc(g.name)}</div>
        ${g.items.map((x) => `<div class="pp-mat-row" data-name="${esc(x.name.toLowerCase())}"><img alt="" src="${itemIcon(x.id, 24)}" data-iteminfo="${x.id}"><b data-iteminfo="${x.id}">${esc(x.name)}</b>
          <span class="pp-mat-where">${x.where.map((w) => `<button class="pp-need-chip" data-region-go="${w.region}" data-skill="${w.skill}" data-spot="${w.spotId}" title="Go there and gather">${esc(w.regionName)} · ${esc(w.spot)}</button>`).join("")}</span></div>`).join("")}</div>`).join("")}
    </details>`;
  }
  /** Go to a region and start gathering at one of its spots (already there: just go). */
  async function gatherAt(region, skill, spot) {
    closeSec();
    const {s} = current(), j = s.player && s.player.job;
    worldRegion = region;
    if (!(j && !j.hunt && j.spot === spot && j.skill === skill)) {
      const r = await act("trip", {skill, spot, roll: Math.random()});
      if (r && r.error) toast(r.error, true);
    }
    goTo("pet:world");
  }
  function wireMaterials(host) {
    const d = host.querySelector("#pp-materials");
    if (!d) return;
    d.addEventListener("toggle", () => { materialsOpen = d.open; });
    const q = d.querySelector("#pp-mat-q");
    const filter = () => { const t = materialsQuery.trim().toLowerCase();
      d.querySelectorAll(".pp-mat-group").forEach((g) => { let any = false;
        g.querySelectorAll(".pp-mat-row").forEach((r) => { r.hidden = !!t && !r.dataset.name.includes(t); any = any || !r.hidden; });
        g.hidden = !any; }); };
    q.addEventListener("input", () => { materialsQuery = q.value; filter(); });
    filter();
    // one click: off you go, gathering there (Cam, 2026-10-08: "when i click it once it just goes there and starts gathering")
    d.querySelectorAll("[data-region-go]").forEach((b) => b.addEventListener("click", () => gatherAt(b.dataset.regionGo, b.dataset.skill, b.dataset.spot)));
  }
  function renderHub(host, page) {
    const h = HUBS[page];
    const places = h.doors.map((k) => hubPlace(k)).concat((h.extra || []).map(([k, name]) => hubPlace(k, name)));
    if (page === "pet:house") {
      renderDash(host, "");                                        // Home: the house, then Today -- each place opens on its own
      const dash = host.querySelector(".pp-dash");
      if (dash) dash.insertAdjacentHTML("afterbegin", paintedHTML("house", places));
      wirePainted(host, (k) => hubGo(host, k));
      showSec();
      return;
    }
    host.innerHTML = `
      <div class="pp-page">
        <p class="pp-status" id="pp-status">${esc(status)}</p>
        ${h.scene ? paintedHTML(h.scene, places) : ""}
        
        ${h.scene ? "" : doorsHTML(h.doors)}
        ${h.room && !h.scene ? roomsHTML((r) => r.id === h.room) : ""}
      </div>`;
    host.querySelectorAll("[data-door]").forEach((b) => b.addEventListener("click", () => goTo(b.dataset.door)));
    wirePainted(host, (k) => hubGo(host, k));
    if (h.room && !h.scene) wireRooms(host);
    showSec();
  }
  // a merchant (2026-10-20: the crafting bench's look -- Buy and Sell tabs, a grid, the one you picked with an amount)
  function tradeHTML(w) {
    const buy = w.stock.map((x) => ({key: "b:" + x.id, icon: itemIcon(x.id, 48), name: x.name, find: x.name + " " + (x.does || ""), badge: x.have || "", can: x.can, x}));
    const sell = w.sell.map((x) => ({key: "s:" + x.id, icon: itemIcon(x.id, 48), name: x.name, badge: x.spare.toLocaleString(), can: !x.bound && x.spare >= x.one, lock: !!x.bound, lockWord: "kept", x}));
    const bagLine = w.bag ? `<p class="stamp${w.bag.used > w.bag.cap ? " pp-over" : ""}">Your bag: ${w.bag.used}/${w.bag.cap} slots${w.bag.used >= w.bag.cap ? " — full: sell what you can spare to make room" : ""}.</p>` : "";
    return bagLine + gridBenchHTML("trade:" + w.id, [
      {id: "buy", label: w.id === "travelling" ? "Zeph has" : "Buy", items: buy, empty: "Nothing for sale today."},
      {id: "sell", label: w.trade > 1 ? "Sell (half as much again)" : "Sell", items: sell, empty: "Nothing spare to sell."}], (it, tab) => {
      const x = it.x;
      if (tab === "buy") {
        const max = Core.ITEMS[x.id].bagSize ? (x.can ? 1 : 0) : x.can ? Math.max(1, Math.min(50, Math.floor((w.coins || 0) / Math.max(1, x.price)))) : 0;
        return gbHead(itemIcon(x.id, 64), esc(x.name), [`${coinTxt(x.price)} each`, x.have ? `${x.have} in your bag` : ""])
          + `<p class="stamp">${esc(x.does || "")}</p>${max > 1 ? gbAmountHTML("buy:" + w.id + x.id, max, 1) : ""}
          <p class="stamp pp-bget">${max ? `Cost: <b data-gbeach="${x.price}" data-gbunit="coin">${coinTxt(x.price * Math.min(max, +(gbAmt["buy:" + w.id + x.id] || 1)))}</b>` : (w.coins || 0) < x.price ? "Not enough coins." : "Your bag has no room for it."}</p>
          <button class="btn btn-primary pp-bmake pp-buy" data-item="${x.id}" data-amt="1" ${max ? "" : "disabled"}>BUY</button>`;
      }
      if (x.bound) return gbHead(itemIcon(x.id, 64), esc(x.name), [`${x.spare} spare`]) + `<p class="stamp">A mastery's keepsake -- it can't be sold.</p>`;
      const max = x.spare;
      return gbHead(itemIcon(x.id, 64), esc(x.name), [eachTxt(x.each), `${x.spare.toLocaleString()} spare`])
        + (max > 1 ? gbAmountHTML("sell:" + w.id + x.id, max, max) : "")
        + `<p class="stamp pp-bget">You get about <b data-gbeach="${x.each}" data-gbunit="coin">${coinTxt(Math.floor(x.each * Math.min(max, +(gbAmt["sell:" + w.id + x.id] || max))))}</b></p>
        <div class="pp-row"><button class="btn btn-primary pp-bmake pp-sell" data-item="${x.id}" data-n="amt" ${x.spare >= x.one ? "" : "disabled"}>SELL</button>
          ${x.spare > 1 && x.all >= 1 ? `<button class="btn pp-sell" data-item="${x.id}" data-n="all">All · ${coinTxt(x.all)}</button>` : ""}</div>`;
    });
  }
  // the reskinner's paint: a pet, a colour, click a part of it
  let reskin = {id: "", paint: {}, colour: "#e0789e"};
  const PAINT = ["#f2b46d", "#fbe3c0", "#b9b6c9", "#f6c6d0", "#9ad07a", "#b9a3e3", "#6fa8dc", "#e0789e", "#c0392b", "#f2c43c",
                 "#2f7d4f", "#2a5ad8", "#7d4fa8", "#8d6e63", "#ffffff", "#1f2430"];
  function reskinPets() {
    const {s, now} = current();
    return Core.petsView(s, now).filter((p) => !p.egg);
  }
  function paintPal(p) { return Art.palette(p.species, p.colour, Object.assign({}, p.skin || {}, reskin.paint)); }
  function reskinHTML(w) {
    const pets = reskinPets();
    if (!pets.length) return `<p class="stamp">You've no pet to recolour yet.</p>`;
    if (!pets.some((p) => p.id === reskin.id)) { reskin.id = pets[0].id; reskin.paint = {}; }
    const p = pets.find((x) => x.id === reskin.id);
    return `<div class="pp-row"><select class="input" id="pp-rs-pet">${pets.map((q) => `<option value="${q.id}" ${q.id === p.id ? "selected" : ""}>${esc(q.name)}</option>`).join("")}</select></div>
      <div class="pp-reskin">
        <canvas id="pp-rs-canvas" width="160" height="160" title="Click a part of your pet to paint it"></canvas>
        <div class="pp-reskin-side">
          <div class="pp-label">Paint (click a part of your pet)</div>
          <div class="pp-rs-colours">${PAINT.map((c) => `<button class="pp-rs-sw${c === reskin.colour ? " on" : ""}" data-col="${c}" style="background:${c}"></button>`).join("")}
            <input type="color" id="pp-rs-custom" value="${reskin.colour}" title="Any colour"></div>
          <div class="pp-row"><button class="btn btn-sm" id="pp-rs-apply" ${Object.keys(reskin.paint).length && w.coins >= w.cost ? "" : "disabled"}>Keep these colours · ${coinTxt(w.cost)}</button>
            <button class="btn btn-sm btn-quiet" id="pp-rs-undo">Start again</button>
            ${p.skin ? `<button class="btn btn-sm btn-quiet" id="pp-rs-reset">Its own colours (free)</button>` : ""}</div>
        </div>
      </div>
      <div class="pp-label">Exotic skins</div>
      <div class="pp-rs-presets">${w.presets.map((x) => `<div class="pp-rs-preset"><img alt="" src="${petURL(p.species, p.colour, 64, "ok", x.pal)}">
        <b>${esc(x.name)}</b><button class="btn btn-sm pp-rs-buy" data-preset="${x.id}" ${x.can ? "" : "disabled"}>${coinTxt(x.cost)}</button></div>`).join("")}</div>`;
  }
  function wireReskin(card, w) {
    const pets = reskinPets(), p = pets.find((x) => x.id === reskin.id);
    if (!p) return;
    const cv = card.querySelector("#pp-rs-canvas"), rows = Art.frame(p.species, "ok"), SC = 10;
    const paint = () => { const ctx = cv.getContext("2d"); ctx.clearRect(0, 0, 160, 160); Art.draw(ctx, rows, paintPal(p), 0, 0, SC, false); };
    paint();
    cv.addEventListener("click", (e) => {
      const r = cv.getBoundingClientRect(), x = Math.floor((e.clientX - r.left) / (r.width / 16)), y = Math.floor((e.clientY - r.top) / (r.height / 16));
      const ch = (rows[y] || "").charAt(x);
      if (!ch || ch === ".") return;
      reskin.paint[ch] = reskin.colour;          // the whole part: every pixel of that colour, in every pose
      showShop();
    });
    card.querySelector("#pp-rs-pet").addEventListener("change", (e) => { reskin.id = e.target.value; reskin.paint = {}; showShop(); });
    card.querySelectorAll(".pp-rs-sw").forEach((b) => b.addEventListener("click", () => { reskin.colour = b.dataset.col; showShop(); }));
    card.querySelector("#pp-rs-custom").addEventListener("change", (e) => { reskin.colour = e.target.value; showShop(); });
    card.querySelector("#pp-rs-undo").addEventListener("click", () => { reskin.paint = {}; showShop(); });
    const done = async (opts) => { const r = await act("reskin", Object.assign({id: p.id}, opts)); if (r && r.error) { status = r.error; toast(r.error, true); } else reskin.paint = {}; showShop(); };
    card.querySelector("#pp-rs-apply").addEventListener("click", () => done({skin: Object.assign({}, p.skin || {}, reskin.paint)}));
    const rs = card.querySelector("#pp-rs-reset");
    if (rs) rs.addEventListener("click", () => done({reset: true}));
    card.querySelectorAll(".pp-rs-buy").forEach((b) => b.addEventListener("click", () => done({preset: b.dataset.preset})));
  }
  function showShop() {
    let box = document.querySelector(".pp-modal.pp-shop-modal");
    const {s, now} = current();
    const w = Core.villageView(s, now).find((x) => x.id === openShop);
    if (!w) { if (box) box.remove(); openShop = ""; return; }
    if (!box) {
      box = document.createElement("div");
      box.className = "pp-modal pp-shop-modal";
      box.innerHTML = `<div class="pp-modal-card pp-shop-card" role="dialog"></div>`;
      document.body.appendChild(box);
      box.addEventListener("click", (e) => { if (e.target === box) closeShop(); });
      box.addEventListener("keydown", (e) => { if (e.key === "Escape") closeShop(); });
    }
    const card = box.querySelector(".pp-shop-card");
    const keep = card.querySelector(".pp-shop-list") ? card.querySelector(".pp-shop-list").scrollTop : 0;
    // a search box on a bench (2026-10-10, Cam: "search feature on craft tables to be able to find recipes faster"):
    // by name, what it does, or what goes into it ("oak" finds everything made with oak); kept for each bench while you craft
    if (shopQueryFor !== w.id) { shopQuery = ""; shopQueryFor = w.id; }
    const gridded = !!(w.grind || w.trade || w.identify || w.orders || w.altar);   // (2026-10-20: the crafting bench's look, every one but the reskinner's paint)
    const searchable = !w.reskin && !gridded && w.recipes.length > 3 && !benchPlain(w);   // (the new bench has its own search)
    box.classList.toggle("pp-bench-modal", benchPlain(w) || gridded);
    const hadFocus = document.activeElement && document.activeElement.id === "pp-shop-q";
    card.innerHTML = `<button class="btn btn-quiet btn-sm pp-shop-x" aria-label="Close">✕</button>
      ${shopHeadHTML(w)}
      ${w.id === "cryptmerchant" ? `<button class="btn btn-sm btn-quiet" data-talk="hobb">Ask about life essence</button>` : ""}
      ${searchable ? `<input class="input pp-shop-q" id="pp-shop-q" type="search" placeholder="Find a recipe, or an ingredient…" value="${esc(shopQuery)}" aria-label="Find a recipe">` : ""}
      <p class="pp-status" id="pp-shop-status">${esc(status)}</p>
      <div class="pp-shop-list">${w.grind ? grindHTML(w) : w.trade ? tradeHTML(w) : w.reskin ? reskinHTML(w) : w.identify ? identifyHTML(w) : w.orders ? ordersHTML(w) : w.altar ? altarHTML(w) : benchPlain(w) ? benchHTML(w) : shopRecipesHTML(w)}</div>`;
    const list = card.querySelector(".pp-shop-list"), sq = card.querySelector("#pp-shop-q");
    card.querySelectorAll("[data-talk]").forEach((b) => b.addEventListener("click", () => talkPopup(b.dataset.talk)));
    if (w.id === "cryptmerchant") setTimeout(() => talkPopup("hobb", true), 200);   // (PT20 c6: "maybe [Sexton] can explain again")
    const findRecipes = () => {
      const words = shopQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
      let shown = 0;
      list.querySelectorAll(".pp-recipe[data-find]").forEach((r) => { r.hidden = words.length > 0 && !words.every((x) => r.dataset.find.includes(x)); if (!r.hidden) shown++; });
      let none = list.querySelector(".pp-shop-none");
      if (!none) { none = document.createElement("p"); none.className = "stamp pp-shop-none"; list.appendChild(none); }
      none.textContent = `Nothing here matches “${shopQuery.trim()}”.`;
      none.hidden = !words.length || shown > 0;
    };
    if (sq) {
      findRecipes();
      sq.addEventListener("input", () => { shopQuery = sq.value; findRecipes(); list.scrollTop = 0; });
      sq.addEventListener("keydown", (e) => { if (e.key === "Escape" && sq.value) { e.stopPropagation(); sq.value = shopQuery = ""; findRecipes(); } });
      if (hadFocus) { sq.focus(); sq.setSelectionRange(sq.value.length, sq.value.length); }
    }
    list.scrollTop = keep;
    card.querySelector(".pp-shop-x").addEventListener("click", closeShop);
    const run = async (a, o) => { const r = await act(a, o); if (r && r.error) { status = r.error; toast(r.error, true); } showShop(); };
    // "Cook all" / "All" (2026-10-14) asks for as many as there's enough for
    if (benchPlain(w) || (w.altar && altarTab === "gems" && w.recipes.length)) benchWire(card, w, run, showShop);   // the redesigned bench (2026-10-19, Q6)
    card.querySelectorAll(".pp-gbench").forEach((g) => gridBenchWire(card, g.dataset.gb, showShop));    // ... and the rest in its look (2026-10-20)
    card.querySelectorAll("[data-altartab]").forEach((b) => b.addEventListener("click", () => { altarTab = b.dataset.altartab; showShop(); }));
    card.querySelectorAll(".pp-make").forEach((b) => b.addEventListener("click", async () => {
      let times = b.dataset.times;
      if (times === "ask") {                                              // V7: the amount picker -- how many to make
        const xp = +b.dataset.xp || 0, nm = b.dataset.name.toLowerCase();
        times = await askCount(`${nm} to ${w.skill === "cooking" ? "cook" : "make"}`, +b.dataset.max, {ok: w.skill === "cooking" ? "Cook" : "Make",
          preview: (n) => `<b>${n.toLocaleString()} × ${esc(nm)}</b>${xp ? ` · about +${Math.round(n * xp).toLocaleString()} xp` : ""}`});
        if (!times) return;
      }
      run("craft", {workshop: b.dataset.ws, make: b.dataset.make, i: +b.dataset.i, ...(times ? {times} : {})});
    }));
    card.querySelectorAll(".pp-identify").forEach((b) => b.addEventListener("click", () => run("identify", {all: !!b.dataset.all, roll: Math.random()})));
    card.querySelectorAll(".pp-grind").forEach((b) => b.addEventListener("click", () => run("retemper", {item: b.dataset.item})));
    card.querySelectorAll(".pp-order").forEach((b) => b.addEventListener("click", () => run("order", {i: +b.dataset.i})));
    card.querySelectorAll(".pp-enchant").forEach((b) => b.addEventListener("click", () => {
      const sel = card.querySelector(`select[data-ench="${b.dataset.ench}"]`);   // (the picked enchant's target)
      if (sel && sel.value) run("enchant", {enchant: b.dataset.ench, item: sel.value});
    }));
    card.querySelectorAll(".pp-buy").forEach((b) => b.addEventListener("click", () => run("buy", {item: b.dataset.item, from: w.id, n: b.dataset.amt ? gbAmount(b) : 1})));
    card.querySelectorAll(".pp-sell").forEach((b) => b.addEventListener("click", async () => {
      let n = b.dataset.n === "all" ? "all" : b.dataset.n === "amt" ? gbAmount(b) : +b.dataset.n || 1;
      if (b.dataset.n === "ask") {                                        // V7: the amount picker -- how many to sell, and for what
        const each = +b.dataset.each || 0;
        n = await askCount(b.dataset.name.toLowerCase() + " to sell", +b.dataset.max, {ok: "Sell", preview: (k) => `<b>${k.toLocaleString()} sold</b> · about ${coinTxt(Math.floor(k * each))}`});
        if (!n) return;
      }
      run("sell", {item: b.dataset.item, n, to: w.id});
    }));
    if (w.reskin) wireReskin(card, w);
  }
  // ---- home (2026-10-07, Cam: "build a new area called home, inside the home it has different areas like
  //      kitchen where i cook, smithy ..., shed ..., library ... Each area starts off basic and you have to
  //      build house upgrades") -- the Workshop page is your house now: its rooms, their benches, upgrades
  const ROOM_ICON = {kitchen: "obj_kitchen", smithy: "obj_anvil", shed: "obj_bench", library: "obj_herbs", bedroom: "petbed", storeroom: "woodcrate"};
  let storeQuery = "", storeDrag = "", storeOverflow = false, bankTab = 0, bankSort = "rare";   // bankSort: like the bag's Order (PT14 b3)      // the bank (Modernize/Reduce Nav): 0 = every tab, 1..9 a tab
  // 2026-10-08 (Cam: "workshop is where all the workshop stuff will live ... Equipment, storeroom will live in
  // storeroom"): the Workshop shows the bench rooms; the House and the Storeroom hubs show their own room
  function renderHouse(host) {
    // the painted workshop (2026-10-08): every bench, each room's upgrade, and the garden
    const {s, now} = current(), hv = Core.houseView(s, now), shops = {};
    Core.villageView(s, now).forEach((w) => { shops[w.id] = w; });
    const places = hv.rooms.filter((r) => r.workshops.length).map((r) => ({key: "room:" + r.id, name: `${r.tierName} ${r.name.toLowerCase()}`,
        note: r.tier > 1 ? "Now " + r.tierName.toLowerCase() : "", ready: !!(r.next && r.next.can)}))
      // (2026-10-10, Cam: "Remove the number to make underneath the crafting stations scroll") -- just the bench's name
      .concat(Object.keys(shops).filter((k) => !shops[k].npc).map((k) => ({key: k, name: shops[k].name,
        ...(benchFrom && shops[k].recipes && shops[k].recipes.some((r) => r.needs.some((n) => n.id === benchFrom)) ? {here: true, hereText: "Uses " + Core.ITEMS[benchFrom].name.toLowerCase()} : {})})), [{key: "pet:farm", name: "The garden"}]);
    host.innerHTML = `<div class="pp-page"><p class="pp-status" id="pp-status">${esc(status)}</p>
      ${benchFrom ? `<div class="pp-bfrom pp-bfrom-hub">Using <b>${esc(Core.ITEMS[benchFrom].name.toLowerCase())}</b>: the glowing benches make something from it -- click one. <button class="btn btn-sm btn-quiet" id="pp-bfrom-x">Cancel</button></div>` : ""}
      ${paintedHTML("workshop", places)}
      </div>`;
    const bx = host.querySelector("#pp-bfrom-x"); if (bx) bx.addEventListener("click", () => { benchFrom = ""; render(); });
    wirePainted(host, (k) => { if (k.startsWith("pet:") || k.startsWith("room:")) { benchFrom = ""; return hubGo(host, k); } openShop = k; showShop(); });
    if (openShop) showShop();
    if (document.querySelector(".pp-store-modal")) showStore();
    showSec();
  }
  function roomsHTML(want, intro) {
    const {s, now} = current();
    const hv = Core.houseView(s, now), shops = {};
    Core.villageView(s, now).forEach((w) => { shops[w.id] = w; });
    const card = (w) => {
      const can = w.identify ? (w.unid ? 1 : 0) : w.recipes.filter((r) => r.can).length;
      return `<button class="pp-villager" data-ws="${w.id}">
        <img alt="" src="${shopIcon(w, 48)}">
        <b>${esc(w.name)}</b><span class="stamp">${esc(Core.SKILLS[w.skill].name)} · level ${w.level}</span>
        <span class="pp-bar"><span style="width:${Math.round(w.progress * 100)}%"></span></span>
        <span class="stamp">${w.grind ? (w.grind.length ? `${w.grind.length} weapon${w.grind.length === 1 ? "" : "s"}${w.grind.some((x) => x.retemper) ? " · one to re-temper" : ""}` : "No weapons on you") : w.altar ? (w.altar.length ? `${w.altar.length} enchant${w.altar.length === 1 ? "" : "s"} known` : "No enchants known yet") : w.identify ? (w.unid ? `${w.unid} herbs to identify` : "Nothing to identify") : can ? `${can} thing${can === 1 ? "" : "s"} you can make` : "Nothing you can make yet"}</span></button>`;
    };
    const tierDots = (t) => [1, 2, 3, 4].map((i) => `<span class="pp-tier-dot${i <= t ? " on" : ""}"></span>`).join("");
    return `
        <p class="stamp"${intro ? "" : " hidden"}>Every room starts basic — build it up to make better things (a workshop room limits the level of what its benches make).
          Building trains <b>Construction</b> (level ${hv.con}); saw planks at the sawbench in your shed. ${coinTxt(s.coins || 0)}</p>
        <div class="pp-rooms">${hv.rooms.filter(want).map((r) => `
          <section class="pp-room room-${r.id}">
            <header class="pp-room-head">
              <img alt="" src="${itemIcon(ROOM_ICON[r.id], 40)}">
              <div><b>${esc(r.tierName)} ${esc(r.name.toLowerCase())}</b> <span class="pp-tier-dots" title="Tier ${r.tier} of 4">${tierDots(r.tier)}</span>
                <div class="stamp">${esc(r.perks)}</div></div>
            </header>
            ${r.workshops.length ? `<div class="pp-village pp-room-benches">${r.workshops.filter((k) => shops[k]).map((k) => card(shops[k])).join("")}</div>` : ""}
            ${r.id === "storeroom" ? `<p class="stamp">${hv.storage.used}/${hv.storage.cap} kinds in the bank</p>
              <button class="btn" id="pp-open-store">Open the bank</button>` : ""}
            ${r.id === "bedroom" ? `` : ""}
            ${r.id === "shed" ? `<button class="btn btn-quiet" data-jump="pet:farm">The garden: plots and herb pots</button>` : ""}
            ${r.next ? `<div class="pp-room-next">
                <div><b>Build ${esc(r.next.name.toLowerCase())} ${esc(r.name.toLowerCase())}</b> <span class="stamp">· ${esc(r.next.perks)} · +${r.next.xp} Construction xp</span></div>
                <div class="pp-needs">
                  <span class="pp-need-chip${hv.con >= r.next.con ? "" : " lack"}">Construction ${hv.con}/${r.next.con}</span>
                  <span class="pp-need-chip${(s.coins || 0) >= r.next.coins ? "" : " lack"}">${coinTxt(r.next.coins)}</span>
                  ${r.next.needs.map((n) => `<span class="pp-need-chip${n.have >= n.need ? "" : " lack"}" title="${esc(n.name)}" data-iteminfo="${n.id}"><img alt="" src="${itemIcon(n.id, 16)}">${n.have}/${n.need}</span>`).join("")}
                </div>
                <button class="btn btn-sm ${r.next.can ? "btn-primary" : ""} pp-build" data-room="${r.id}" ${r.next.can ? "" : "disabled"}>Build</button>
              </div>` : `<p class="stamp pp-room-done">As grand as it gets.</p>`}
          </section>`).join("")}</div>`;
  }
  function wireRooms(host) {
    host.querySelectorAll(".pp-room .pp-villager").forEach((b) => b.addEventListener("click", () => { openShop = b.dataset.ws; showShop(); }));
    host.querySelectorAll(".pp-build").forEach((b) => b.addEventListener("click", async () => {
      const r = await act("build", {room: b.dataset.room});
      if (r && r.error) { status = r.error; toast(r.error, true); render(); }
    }));
    host.querySelectorAll("[data-jump]").forEach((b) => b.addEventListener("click", () => goTo(b.dataset.jump)));
    const st = host.querySelector("#pp-open-store");
    if (st) st.addEventListener("click", () => showStore());
    if (openShop) showShop();
    if (document.querySelector(".pp-store-modal")) showStore();
  }
  // ---- the bank (Modernize/Reduce Nav, 2026-10-18, Cam's N9: "a bank utilising the storeroom but allow better base storage size,
  //      and a way to tab and organise items same as runescapes bank ... reduce clicks and navigation options in the form of
  //      multiple chests"). RuneScape's layout: tabs along the top (All, then yours), the bank's things as a grid, your bag below.
  //      A click withdraws one (or deposits one from the bag); a right click has the rest; drag a thing onto a tab to move it.
  function showStore() {
    let box = document.querySelector(".pp-modal.pp-store-modal");
    const {s, now} = current();
    const hv = Core.houseView(s, now), bag = Core.bagList(s).filter((x) => x.id !== "unidherb");
    if (!box) {
      box = document.createElement("div");
      box.className = "pp-modal pp-store-modal";
      box.innerHTML = `<div class="pp-modal-card pp-shop-card pp-bank" role="dialog" aria-label="Bank"></div>`;
      document.body.appendChild(box);
      box.addEventListener("click", (e) => { if (e.target === box) { box.remove(); render(); } });
      box.addEventListener("keydown", (e) => { if (e.key === "Escape" && !document.querySelector(".np-ctx")) { box.remove(); render(); } });
    }
    const card = box.querySelector(".pp-shop-card");
    const keep = card.querySelector(".pp-bank-grid") ? card.querySelector(".pp-bank-grid").scrollTop : 0;
    const typing = document.activeElement && document.activeElement.id === "pp-store-q";
    const q = storeQuery.trim().toLowerCase(), hit = (n) => !q || n.toLowerCase().includes(q);
    const tabs = hv.storage.chests || [], ovRows = hv.storage.overflow || [];
    if (!ovRows.length) storeOverflow = false;
    if (bankTab > tabs.length) bankTab = 0;
    // the tabs you've started (named, or with something in them), and one more to start
    const live = tabs.filter((t) => t.i === 0 || t.named || t.used), next = tabs.find((t) => t.i > 0 && !t.named && !t.used);
    const tabBtn = (t) => `<button class="pp-bank-tab${!storeOverflow && bankTab === t.i + 1 ? " on" : ""}" data-btab="${t.i + 1}" title="${esc(t.name)} -- ${t.used} kind${t.used === 1 ? "" : "s"}. Drop things here to move them; right-click to rename">
        ${t.items[0] ? `<img alt="" src="${itemIcon(t.items[0].id, 24)}">` : ""}<span>${esc(t.name)}</span></button>`;
    const cell = (x, tab) => `<button class="pp-bank-cell" draggable="true" data-bitem="${esc(x.id)}" data-btabof="${tab}" title="${esc(x.name)} × ${x.count.toLocaleString()} -- click: take 1 · right-click: more">
        <img alt="" src="${itemIcon(x.id, 32)}"><span class="np-kit-n">${kitCount(x.count) || ""}</span></button>`;
    const order = (list) => list.slice().sort(bankSort === "name" ? (a, c) => a.name.localeCompare(c.name) : bankSort === "most" ? (a, c) => c.count - a.count || a.name.localeCompare(c.name) : (a, c) => c.gem - a.gem || a.name.localeCompare(c.name));
    const shown = storeOverflow ? null : bankTab ? tabs.filter((t) => t.i === bankTab - 1) : tabs.filter((t) => t.items.length);
    const grid = storeOverflow ? `<div class="pp-bank-sec">${ovRows.filter((x) => hit(x.name)).map((x) => cell(x, "ov")).join("") || `<p class="stamp">Nothing here matches.</p>`}</div>`
      : shown.map((t) => { const its = order(t.items.filter((x) => hit(x.name)));
          // (I9, 2026-10-19, Cam: "when in All view to drag and drop from one organized tab to another") -- each tab's part of All is a drop target
          const sec = its.length ? `<div class="pp-bank-sec">${its.map((x) => cell(x, t.i)).join("")}</div>` : "";
          return bankTab ? sec : its.length ? `<div class="pp-bank-group" data-bsec="${t.i}" title="Drop things here to move them to ${esc(t.name)}"><div class="pp-bank-divider">${esc(t.name)}</div>${sec}</div>` : ""; }).join("")
        || `<p class="stamp">${q ? "Nothing in the bank matches." : bankTab ? "This tab is empty -- drag things onto it, or deposit from your bag below." : "The bank is empty -- click things in your bag below to put them in."}</p>`;
    card.innerHTML = `<button class="btn btn-quiet btn-sm pp-shop-x" aria-label="Close">✕</button>
      <div class="pp-shop-head"><img class="pp-npc" alt="" src="${itemIcon("obj_chest", 48)}">
        <div><b>Bank${hv.storage.here && hv.storage.here !== "home" ? ` · ${esc(hv.storage.here)}` : ""}</b> <span class="pp-level">${hv.storage.used}/${hv.storage.cap} kinds</span>
          <div class="stamp">What's here is safe, even if you fall -- and the benches here use it. Click to take one; right-click for more; drag onto a tab to sort.</div>
          ${hv.storage.here === "home" ? `<button class="btn btn-sm btn-quiet" id="pp-bank-room" title="Build a bigger store room for a bigger bank">The store room ›</button>` : ""}</div></div>
      <nav class="pp-bank-tabs" aria-label="Bank tabs">
        <button class="pp-bank-tab${!storeOverflow && !bankTab ? " on" : ""}" data-btab="0" title="Everything, tab by tab">All</button>
        ${live.map(tabBtn).join("")}
        ${next ? `<button class="pp-bank-tab add" data-btab="${next.i + 1}" title="A new tab: drop something on it">+</button>` : ""}
        ${ovRows.length ? `<button class="pp-bank-tab ov${storeOverflow ? " on" : ""}" data-bov="1" title="What didn't fit when bags got smaller -- take only">Overflow</button>` : ""}
      </nav>
      <div class="pp-bank-tools"><input class="input" id="pp-store-q" type="search" placeholder="Search the bank…" value="${esc(storeQuery)}" aria-label="Search the bank">
        <select class="input pp-bank-order" id="pp-bank-order" aria-label="Order">${[["rare", "Rarest first"], ["name", "A to Z"], ["most", "Most first"]].map(([k, n]) => `<option value="${k}" ${bankSort === k ? "selected" : ""}>${n}</option>`).join("")}</select>
        <button class="btn btn-sm" id="pp-bank-deposit" title="Everything in your bag goes in (what you wear and carry stays)">Deposit bag</button></div>
      <p class="pp-status" id="pp-shop-status">${esc(status)}</p>
      <div class="pp-bank-grid pp-drop" data-drop="bank">${grid}</div>
      <div class="pp-bank-bag pp-drop" data-drop="bag">
        <div class="pp-label">Your bag <span class="stamp">${Core.bagUsed(s)}/${Core.bagCap(s)} slots · click to put one in, right-click for more</span></div>
        <div class="pp-bank-sec">${bag.map((x) => `<button class="pp-bank-cell" draggable="true" data-bbag="${esc(x.id)}" title="${esc(x.name)} × ${x.count.toLocaleString()} -- click: put 1 in · right-click: more">
            <img alt="" src="${itemIcon(x.id, 32)}"><span class="np-kit-n">${kitCount(x.count) || ""}</span></button>`).join("") || `<p class="stamp">Your bag is empty.</p>`}</div></div>`;
    const g = card.querySelector(".pp-bank-grid"); if (g) g.scrollTop = keep;
    card.querySelector(".pp-shop-x").addEventListener("click", () => { box.remove(); render(); });
    const qi = card.querySelector("#pp-store-q");
    qi.addEventListener("input", () => { storeQuery = qi.value; showStore(); const n = document.querySelector("#pp-store-q"); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } });
    if (typing) { qi.focus(); qi.setSelectionRange(qi.value.length, qi.value.length); }
    const said = (r) => { if (r && r.error) { status = r.error; toast(r.error, true); } else status = ""; showStore(); };
    const take = async (id, n, ov) => said(await act("withdraw", ov ? {item: id, n, from: "overflow"} : {item: id, n}));
    const moveTo = async (id, tab) => said(await act("banktab", {item: id, tab}));
    card.querySelector("#pp-bank-order").addEventListener("change", (e) => { bankSort = e.target.value; showStore(); });
    const br = card.querySelector("#pp-bank-room"); if (br) br.addEventListener("click", () => { box.remove(); openPlace("room:storeroom"); });
    card.querySelector("#pp-bank-deposit").addEventListener("click", async () => said(await act("deposit", {tab: bankTab > 0 ? bankTab - 1 : 0})));
    card.querySelectorAll("[data-btab]").forEach((b) => {
      b.addEventListener("click", () => { storeOverflow = false; bankTab = +b.dataset.btab; showStore(); });
      if (+b.dataset.btab > 0) b.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        const i = +b.dataset.btab - 1, t = tabs[i];
        ctxMenu(e.clientX, e.clientY, t.name, [
          {label: "Rename…", fn: async () => { const nm = await askText({title: "Name this tab", label: "Blank for none", value: t.named ? t.name : "", max: 20, ok: "Save"}); if (nm !== null) said(await act("tabname", {tab: i, name: nm})); }},
          {label: "Clear the name", off: !t.named, fn: async () => said(await act("tabname", {tab: i, name: ""}))}]);
      });
    });
    const ovb = card.querySelector("[data-bov]"); if (ovb) ovb.addEventListener("click", () => { storeOverflow = true; showStore(); });
    // the bank's things: click takes one; right click has the rest
    card.querySelectorAll("[data-bitem]").forEach((b) => {
      const id = b.dataset.bitem, ov = b.dataset.btabof === "ov", have = ov ? (ovRows.find((x) => x.id === id) || {}).count || 0 : (tabs.flatMap((t) => t.items).find((x) => x.id === id) || {}).count || 0;
      b.addEventListener("click", () => take(id, 1, ov));
      b.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        const nm = Core.ITEMS[id].name, items = [{label: "Take 1", fn: () => take(id, 1, ov)}];
        if (have > 5) items.push({label: "Take 5", fn: () => take(id, 5, ov)});
        if (have > 10) items.push({label: "Take 10", fn: () => take(id, 10, ov)});
        if (have > 1) { items.push({label: "Take all", fn: () => take(id, "all", ov)}); items.push({label: "Take X…", fn: async () => { const n = await askCount(nm.toLowerCase(), have); if (n) take(id, n, ov); }}); }
        if (!ov) { items.push({sep: true}); tabs.filter((t) => (t.i === 0 || t.named || t.used || t === next) && t.i !== +b.dataset.btabof).forEach((t) => items.push({label: "Move to " + (t.named || t.i === 0 ? t.name : "a new tab"), fn: () => moveTo(id, t.i)})); }
        items.push({sep: true}, {label: "Examine", fn: () => showItem(id)});
        ctxMenu(e.clientX, e.clientY, nm + " (" + have.toLocaleString() + ")", items);
      });
      b.addEventListener("keydown", (e) => { if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) { e.preventDefault(); const r = b.getBoundingClientRect(); b.dispatchEvent(new MouseEvent("contextmenu", {clientX: r.left, clientY: r.bottom, bubbles: true})); } });
      b.addEventListener("dragstart", (e) => { e.dataTransfer.setData("text/plain", (ov ? "withdraw" : "move") + ":" + id); e.dataTransfer.effectAllowed = "move"; storeDrag = ov ? "withdraw" : "move"; bankDragFrom = ov ? -1 : +b.dataset.btabof; });
    });
    // your bag: click puts one in (into the open tab); right click has the rest (the side panel's menu)
    card.querySelectorAll("[data-bbag]").forEach((b) => {
      const id = b.dataset.bbag;
      b.addEventListener("click", () => storeIt(id, 1));
      b.addEventListener("contextmenu", (e) => { e.preventDefault(); bagMenu(id, e.clientX, e.clientY); });
      b.addEventListener("keydown", (e) => { if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) { e.preventDefault(); const r = b.getBoundingClientRect(); bagMenu(id, r.left, r.bottom); } });
      b.addEventListener("dragstart", (e) => { e.dataTransfer.setData("text/plain", "store:" + id); e.dataTransfer.effectAllowed = "move"; storeDrag = "store"; });
    });
    // drag and drop: a bag thing onto the bank or a tab stores it (all of it); a bank thing onto a tab moves it, onto the bag takes it
    let bankDragFrom = -1;
    const wants = (t, kind) => t.dataset.bsec !== undefined ? kind === "store" || (kind === "move" && +t.dataset.bsec !== bankDragFrom)
      : t.dataset.btab !== undefined ? (kind === "store" || kind === "move") && +t.dataset.btab > 0 || (kind === "store" && t.dataset.btab === "0")
      : t.dataset.drop === "bank" ? kind === "store" : t.dataset.drop === "bag" ? kind === "move" || kind === "withdraw" : false;
    card.querySelectorAll(".pp-bank-tab[data-btab], .pp-drop, [data-bsec]").forEach((t) => {
      t.addEventListener("dragover", (e) => { if (!wants(t, storeDrag)) return; e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = "move"; t.classList.add("over"); });
      t.addEventListener("dragleave", (e) => { if (!t.contains(e.relatedTarget)) t.classList.remove("over"); });
      t.addEventListener("drop", (e) => {
        t.classList.remove("over");
        const [kind, id] = (e.dataTransfer.getData("text/plain") || "").split(":");
        if (!id || !wants(t, kind)) return;
        e.preventDefault(); e.stopPropagation();
        const tab = t.dataset.bsec !== undefined ? +t.dataset.bsec : t.dataset.btab !== undefined ? +t.dataset.btab - 1 : -1;
        if (kind === "store") return storeIt(id, "all", tab >= 0 ? tab : undefined);
        if (kind === "move") return tab >= 0 ? moveTo(id, tab) : take(id, "all");
        return take(id, "all", true);
      });
    });
  }
  function closeShop() {
    openShop = "";
    const box = document.querySelector(".pp-modal.pp-shop-modal");
    if (box) box.remove();
    render();
  }


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

  // ---- the hunt, your health, game over (2026-10-03) ---------------------------------------
  function monsterURL(id, size, flip) {
    if (modPics.monsters[id]) return modPics.monsters[id];
    // a painted creature (2026-10-10): stored facing left -- towards you in a fight -- so it's never mirrored
    if (window.MONSTER_PICS && window.MONSTER_PICS[id]) return "art/creatures/" + id + ".webp";
    const m = Art.monster(id);
    const c = document.createElement("canvas");
    const sc = Math.max(1, Math.floor(size / 16));
    c.width = c.height = 16 * sc;
    Art.draw(c.getContext("2d"), m.rows, m.pal, 0, 0, sc, !!flip);
    return c.toDataURL();
  }
  function hpBar(hp, max) {
    const pct = Math.round(100 * hp / Math.max(1, max));
    return `<div class="pp-hp${pct <= 30 ? " low" : ""}"><span class="pp-hp-fill" style="width:${pct}%"></span><span class="pp-hp-text">${hp} / ${max}</span></div>`;
  }
  // your potions (2026-10-05): what you're under, and a button for each you could drink
  function potionLine(pv, s, kind) {
    const on = (pv.brews || {})[kind];
    const can = Core.bagList(s).filter((b) => b.kind === "brew" && Core.ITEMS[b.id].brew.kind === kind);
    if (!on && !can.length) return "";
    return `<p class="stamp pp-potions">${on ? `Under ${esc(on.name.toLowerCase())}: ${esc(on.does.replace(/ for \d+ (fights|finds)$/, ""))} — ${on.left} ${kind === "combat" ? "fights" : "finds"} left (another is drunk from the bag when it wears off).` : `No ${kind === "combat" ? "combat potion" : "gathering draught"} on.`}
      ${can.map((b) => `<button class="btn btn-sm pp-drink" data-item="${b.id}" title="${esc(b.does)}">Drink ${esc(b.name.toLowerCase())} ×${b.count}</button>`).join(" ")}</p>`;
  }
  function renderHunt(host) {
    const {s, now} = current();
    const pv = Core.playerView(s, now), grounds = Core.huntsView(s);
    const heal = Core.bagList(s).filter((b) => Core.ITEMS[b.id].heal);
    const j = pv.job && pv.job.hunt ? pv.job : null;
    const den = Core.petsView(s, now).filter((p) => !p.companion);
    // Cam (2026-10-03): "Have the window on right side of the screen then to the left have the areas
    // (which will be collpased, the classes move to player menu ...)"
    const last = !j && pv.lastTrip && pv.lastTrip.hunt ? pv.lastTrip : null, sess = j || last;
    host.innerHTML = `
      <div class="pp-page">
        <div class="np-panel np-statstrip">
          ${badge("Combat", pv.combatLevel, "good")}${badge("Attack", pv.skills.attack.level)}${badge("Ranged", pv.skills.ranged.level)}${badge("Magic", pv.skills.magic.level)}
          ${badge("Defence", pv.skills.defence.level)}${badge("Hitpoints", pv.skills.hitpoints.level)}
          ${pv.worn.att || pv.worn.def ? badge("Gear", `+${pv.worn.att} / +${pv.worn.def}`, "info") : ""}
          ${badge("Class", pv.cls ? esc(Core.CLASSES[pv.cls].name) : "None", pv.cls ? "warn" : "bad")}
          <a href="#" class="pp-go-player np-link">Class &amp; stats →</a>
        </div>
        ${(() => {
          /* V16 (2026-10-19): what you woke with, and your gravestone -- said plainly while it stands */
          const f = s.lastFall, g = Core.graveView(s, now);
          if (!f || now - f.at > 60 * 60000) return g ? graveHTML(g) : "";
          const kept = Object.keys(f.kept || {}).map((k) => `${f.kept[k] > 1 ? f.kept[k] + " × " : ""}${esc(Core.ITEMS[k].name.toLowerCase())}`);
          return `<div class="pp-fell"><b>You fell to ${esc(f.by)} at the ${esc(f.where)}.</b>
            You woke by the fire ${kept.length ? `still holding ${kept.join(", ")}` : "with nothing you'd carried"}.
            ${g ? "" : f.grave ? "Your gravestone has crumbled -- the rest is gone." : ""} Your skills, pets, farm and home are safe.</div>${g ? graveHTML(g) : ""}`;
        })()}
        <p class="pp-status" id="pp-status">${esc(status)}</p>
        <div class="pp-hunt-layout">
          <div class="pp-hunt-areas">
            <div class="pp-label">Areas</div>
            ${!sess ? `
              <button class="btn" data-jump="pet:world">Map</button>` : ""}
            ${grounds.filter((g) => sess && g.id === sess.hunt).map((g) => {     // (2026-10-10 audit, H-5) only the ground you're at
              const here = j && j.hunt === g.id;
              return `<details class="pp-hunt-fold${g.open ? "" : " locked"}${here ? " here" : ""}" data-ground="${g.id}" ${openAreas.has(g.id) ? "open" : ""}>
              <summary>
                <img alt="" src="${monsterURL(g.monsters[0].id, 32)}">
                <span class="pp-fold-name"><b>${esc(g.name)}</b>
                  <span class="stamp">Combat ${g.level}${g.open ? ` · ${esc(g.boss.name)} ${g.kills}/${g.need}${g.wins ? ` · beaten ${g.wins}×` : ""}` : " · 🔒"}</span></span>
                ${here ? `<span class="pp-boost">Hunting</span>` : g.bossReady ? `<span class="pp-rarity r-special">Boss ready</span>` : ""}
              </summary>
              <div class="pp-fold-body">
                <div class="pp-row">
                  ${here ? `<span class="pp-boost">You're here</span>` : `<span class="stamp">Last hunted here — travel back on the Map to hunt again.</span>`}
                  ${den.length ? `<select class="input pp-pethunt" data-ground="${g.id}"><option value="">Send a den pet…</option>
                    ${den.map((p) => `<option value="${p.id}" ${p.level >= g.level ? "" : "disabled"}>${esc(p.name)} (level ${p.level})</option>`).join("")}</select>` : ""}
                </div>
                ${bossHTML(g)}
                <div class="pp-monsters">${g.monsters.map((m) => `<div class="pp-monster">
                    <img alt="" src="${monsterURL(m.id, 48)}"><b>${esc(m.name)}${m.when ? ` <span class="pp-when ${m.when}" title="Only comes out ${m.when === "night" ? "at night (9 pm to 5 am)" : "by day"}">${m.when === "night" ? "🌙 night" : "☀ day"}</span>` : ""}</b>
                    <span class="stamp">${m.hp} hp · attack ${m.att} · defence ${m.def} · hits with ${esc(Core.DTYPES[m.atk].toLowerCase())}${m.eva ? ` · dodges ${Math.round(m.eva * 100)}%` : ""}</span>
                    <span class="pp-wr">${Object.keys(m.weak || {}).map((k) => `<span class="pp-weak">weak: ${esc(Core.DTYPES[k].toLowerCase())}</span>`).join("")}
                      ${Object.keys(m.resist || {}).map((k) => `<span class="pp-resist">resists: ${esc(Core.DTYPES[k].toLowerCase())}</span>`).join("")}
                      ${Object.keys(m.matWeak || {}).map((k) => `<span class="pp-weak">weak to ${esc(k)}</span>`).join("")}</span>
                    <span class="pp-finds">${m.drops.map((d) => `<img alt="" title="${esc(Core.ITEMS[d].name)}" src="${itemIcon(d, 16)}">`).join("")}</span></div>`).join("")}</div>
              </div>
            </details>`; }).join("")}
            
          </div>
          <div class="pp-hunt-main">
            ${arenaHTML(pv, j, s, now)}
            ${sess ? `<div class="pp-hunt-sum">
                <span class="pp-label">${j ? "This hunt" : "Last hunt"}</span>
                <b>The ${esc(j ? j.spotName : Core.HUNTS[last.hunt].name)}</b>
                <span class="pp-wins">${sess.count} win${sess.count === 1 ? "" : "s"}</span>
                <span class="pp-finds">${Object.keys(sess.items || {}).length ? items(sess.items) : `<span class="stamp">nothing yet</span>`}</span>
                ${sess.ate ? `<span class="stamp">ate ${Object.keys(sess.ate).map((k) => `${sess.ate[k]} ${esc(Core.ITEMS[k].name.toLowerCase())}`).join(", ")}</span>` : ""}</div>` : ""}
            ${""/* (2026-10-20, Cam: the health box, the plan line, the weapon line and the companion line went -- the fight card has your
                   health, the Kit has the rest) */}
          </div>
        </div>
      </div>`;
    host.querySelectorAll(".pp-hunt-fold").forEach((d) => d.addEventListener("toggle", () => { if (d.open) openAreas.add(d.dataset.ground); else openAreas.delete(d.dataset.ground); }));
    host.querySelectorAll(".pp-go-player").forEach((a2) => a2.addEventListener("click", (e) => { e.preventDefault(); goTo("pet:skills"); }));
    const err = (r) => { if (r && r.error) { status = r.error; toast(r.error, true); const el = host.querySelector("#pp-status"); if (el) el.textContent = status; } };
    host.querySelectorAll(".pp-eat").forEach((b) => b.addEventListener("click", async () => err(await act("eat", {item: b.dataset.item}))));
    host.querySelectorAll(".pp-hunt").forEach((b) => b.addEventListener("click", async () => err(await act("hunt", {ground: b.dataset.ground, roll: Math.random()}))));
    host.querySelectorAll(".pp-hunt-areas [data-jump]").forEach((b) => b.addEventListener("click", () => { worldRegion = ""; goTo(b.dataset.jump); }));
    host.querySelectorAll("[data-bm]").forEach((b) => b.addEventListener("click", () => {
      bossMode(b.dataset.bm);
      host.querySelectorAll("[data-bm]").forEach((x) => x.classList.toggle("on", x.dataset.bm === b.dataset.bm));
    }));
    host.querySelectorAll(".pp-boss-go").forEach((b) => b.addEventListener("click", async () => {
      // one click (2026-10-11, Cam: "remove the warning note which comes up when challenging the boss, that way it is a
      // single click for the player to challenge the boss") -- the rematch count is on the boss's card
      arenaMenu = "main";
      const r = await act("boss", {ground: b.dataset.ground, roll: Math.random(), manual: bossMode() === "manual"});
      if (r && r.error) err(r);
      else { const ar = document.getElementById("pp-arena"); if (ar) ar.scrollIntoView({block: "center", behavior: "smooth"}); }
    }));
    host.querySelectorAll(".pp-pethunt").forEach((sel) => sel.addEventListener("change", async () => {
      if (sel.value) err(await act("pethunt", {id: sel.value, ground: sel.dataset.ground, roll: Math.random()}));
    }));
    clearInterval(huntTimer);
    const sig = (p2, c) => [p2.dead ? 1 : 0, p2.job && p2.job.hunt ? p2.job.hunt : "", p2.battle ? p2.battle.start : 0,
      c.s.lastBoss && c.now - c.s.lastBoss.at < 12000 ? c.s.lastBoss.at : 0].join("|");
    let shape = sig(pv, {s, now}), fightAt = j && j.fight ? j.fight.at : 0, tick = 0;
    if (host.querySelector("#pp-arena")) arenaWire(host, pv);
    updateArena(host, s, pv, now);
    huntTimer = setInterval(() => {
      if (!host.isConnected || page() !== "pet:hunt") { clearInterval(huntTimer); return; }
      const c = current(), p2 = Core.playerView(c.s, c.now);
      // a fight began or ended, a hunt or a boss: build the page again
      if (sig(p2, c) !== shape) {
        const f2 = p2.job && p2.job.fight;
        // let the creature faint on screen first
        if (!(f2 && f2.at !== fightAt && c.now - f2.at < 1600 && !p2.battle)) return render();
      }
      updateArena(host, c.s, p2, c.now);
      if (++tick % 4) return;                                        // the health and special bars: once a second
      const hb = host.querySelector("#pp-hp-box"); if (hb) hb.innerHTML = hpBar(p2.hp, p2.maxHp);
      const sb = host.querySelector("#pp-spec-box"); if (sb) sb.style.width = p2.spec + "%";
    }, 250);                                                         // 4 a second (audit OPT-2, 2026-10-13; was 10): still smooth
  }
  let huntTimer = 0;
  const openAreas = new Set();                     // the Hunting page's open areas, kept as it redraws

  // each area's boss: how close you are, what it's like, what beating it unlocks
  function bossHTML(g) {
    const b = g.boss, pct = Math.min(100, Math.round(100 * g.kills / g.need));
    return `<div class="pp-boss">
      <img alt="" src="${monsterURL(b.id, 64)}">
      <div class="pp-boss-main">
        <div><b>${esc(b.name)}</b> <span class="pp-rarity r-special">Boss</span>${g.wins ? ` <span class="stamp">beaten ${g.wins}×</span>` : ""}</div>
        <div class="stamp">${b.hp} hp · attack ${b.att} · defence ${b.def} · hits with ${esc(Core.DTYPES[b.atk].toLowerCase())}${b.eva ? ` · <b>dodges ${Math.round(b.eva * 100)}%</b>` : ""}</div>
        <span class="pp-wr" style="justify-content:flex-start">${Object.keys(b.weak || {}).map((k) => `<span class="pp-weak">weak: ${esc(Core.DTYPES[k].toLowerCase())}</span>`).join("")}
          ${Object.keys(b.resist || {}).map((k) => `<span class="pp-resist">resists: ${esc(Core.DTYPES[k].toLowerCase())}</span>`).join("")}</span>
        <div class="pp-finds">${b.drops.map((d) => `<img alt="" title="${esc(Core.ITEMS[d].name)}" src="${itemIcon(d, 16)}">`).join("")}</div>
        ${b.unlocks.map((u) => `<div class="stamp">${u.done ? "✓" : `${Math.min(g.wins, u.wins)}/${u.wins}`} — ${esc(u.pet)} from ${esc(u.egg.toLowerCase())}s</div>`).join("")}
        ${Core.bossGearSet(g.id).length ? `<div class="stamp">${g.wins >= Core.BOSS_GEAR_WINS ? "✓" : `${g.wins}/${Core.BOSS_GEAR_WINS}`} — ${esc(b.name)}'s armour and weapons can be made</div>` : ""}
        <div class="pp-npc-level"><span class="pp-bar"><span style="width:${pct}%"></span></span><span class="stamp">${g.kills}/${g.need} kills to challenge${g.unlocked ? " (a rematch)" : ` (the first time; then ${g.rematch} a rematch)`}</span></div>
        <button class="btn btn-sm ${g.bossReady ? "btn-primary" : ""} pp-boss-go" data-ground="${g.id}" ${g.bossReady ? "" : "disabled"}>Challenge ${esc(b.name)}</button>
        <span class="pp-bossmode" role="group" aria-label="How the fight is played" title="Auto: the fight plays itself. Manual: each round waits for your move.">
          <button class="pp-bm ${bossMode() === "auto" ? "on" : ""}" data-bm="auto">Auto</button><button class="pp-bm ${bossMode() === "manual" ? "on" : ""}" data-bm="manual">Manual</button></span>
      </div></div>`;
  }
  /** Your gravestone while it stands: where, how long, what's in it, and Open (half of what's inside) -- V16. */
  function graveHTML(g) {
    const m = Math.ceil(g.leftMs / 60000);
    return `<div class="pp-fell pp-grave"><b>Your gravestone at the ${esc(g.where)}</b> · ${m} minute${m === 1 ? "" : "s"} before it crumbles
      <div class="pp-needs">${g.coins ? `<span class="pp-need-chip">${g.coins.toLocaleString()} coins</span>` : ""}${g.items.slice(0, 12).map((x) => `<span class="pp-need-chip" title="${esc(x.name)}"><img alt="" src="${itemIcon(x.id, 16)}">${x.n}</span>`).join("")}${g.items.length > 12 ? `<span class="stamp">and ${g.items.length - 12} more</span>` : ""}</div>
      ${g.here ? `<button class="btn btn-sm btn-primary" id="pp-grave-open">Open it · ${g.fee.toLocaleString()} coins</button> <span class="stamp">half of what's inside</span>`
        : `<span class="stamp">It's on ${g.isle ? "another island" : "the main island"} -- go there to open it (${g.fee.toLocaleString()} coins).</span>`}</div>`;
  }
  /** The Hunting page's one line of your plan (C4 D1, 2026-10-16: the plan and how you fight have one home, the
   *  Character sheet's Combat tab -- the Hunting page had them all again). */

  // your attack style and special (Cam: "from here i can select a default attack to use or a
  // special attack")
  // (PT38 q1, 2026-10-20, Cam: yes -- the hunt plan's one home is the Kit's Combat tab: quick slots, traps and nets, the bash;
  //  the Character sheet's copy of it went)
  // the Hunter's traps and nets in the plan (Battle Re-work Part 4; Cam's Q1: "net creatures above Y")
  function toolPlanHTML(tp, row) {
    if (!tp || !tp.can) return "";
    const pick = (cls, list, on, kind) => `<select class="input ${cls}" aria-label="Which ${kind}"><option value="">your cheapest ${kind}</option>
        ${list.map((x) => `<option value="${x.id}" ${on === x.id ? "selected" : ""}>${esc(x.name)} (×${x.count})</option>`).join("")}</select>`;
    return row("Use them on", `<select class="input pp-toolson" aria-label="Which creatures get traps and nets">
                <option value="tough" ${tp.toolsOn === "tough" ? "selected" : ""}>dangerous creatures only</option>
                <option value="all" ${tp.toolsOn === "all" ? "selected" : ""}>every creature</option></select>`, `Dangerous: a boss, or a creature whose best blow ${tp.toughBlows} times would finish you. On easy creatures a trap only costs your first blow.`)
      + row("Trap", `<label><input type="checkbox" class="pp-trapopen" ${tp.trapOpen ? "checked" : ""}> as each fight opens</label> ${pick("pp-trapwhich", tp.traps, tp.trap, "trap")}`, `The trap costs your first attack (not with Ambush). ${tp.perFight > 1 ? "Two traps a fight." : "One trap a fight."}`)
      + row("Net", `<span class="stamp">when it's above</span> <select class="input pp-netabove" aria-label="Throw a net above">
                ${tp.above.map((r) => `<option value="${r}" ${Math.abs(tp.netAbove - r) < 0.001 ? "selected" : ""}>${r ? Math.round(r * 100) + "%" : "never"}</option>`).join("")}</select> ${pick("pp-netwhich", tp.nets, tp.net, "net")}`, "Once a fight, when the creature isn't already caught. A net (or a bear trap) is picked up again after a win -- a snare is spent.")
      + (!tp.traps.length && !tp.nets.length ? `` : "");
  }
  /** Wire the plan's and fighting style's controls in `host` (the Hunting page and the Combat tab). */
  function wirePlan(host, err) {
    const on = (sel, ev, f) => { const el = host.querySelector(sel); if (el) el.addEventListener(ev, f); };
    on(".pp-retreat", "change", async (e) => err(await act("settings", {retreat: +e.target.value})));
    host.querySelectorAll(".pp-quickpick").forEach((sel) => sel.addEventListener("change", async () => err(await act("quick", {op: "set", i: +sel.dataset.i, item: sel.value}))));   // V16
    on(".pp-toolson", "change", async (e) => err(await act("toolplan", {toolsOn: e.target.value})));
    on(".pp-bashauto", "change", async (e) => err(await act("bashplan", {on: e.target.checked})));
    on(".pp-trapopen", "change", async (e) => err(await act("toolplan", {trapOpen: e.target.checked})));
    on(".pp-netabove", "change", async (e) => err(await act("toolplan", {netAbove: +e.target.value})));
    on(".pp-trapwhich", "change", async (e) => err(await act("toolplan", {trap: e.target.value})));
    on(".pp-netwhich", "change", async (e) => err(await act("toolplan", {net: e.target.value})));
    host.querySelectorAll(".pp-drink").forEach((b) => b.addEventListener("click", async () => err(await act("drink", {item: b.dataset.item}))));
    host.querySelectorAll(".pp-class-guild").forEach((b) => b.addEventListener("click", () => goTo("pet:guild")));
    host.querySelectorAll(".pp-style").forEach((b) => b.addEventListener("click", async () => err(await act("combat", {style: b.dataset.style}))));
    on(".pp-special", "change", async (e) => err(await act("combat", {special: e.target.value})));
    host.querySelectorAll("[data-speccat]").forEach((b) => b.addEventListener("click", async () => {   // V18: on or off your side bar
      const {s, now} = current(), lo = Core.playerView(s, now).specLoadout.slice(), id = b.dataset.speccat, i = lo.indexOf(id);
      if (i >= 0) lo.splice(i, 1); else if (lo.length >= Core.SPECIALS.max) return toast(`Your side bar holds ${Core.SPECIALS.max} specials -- take one off first.`, true); else lo.push(id);
      err(await act("combat", {loadout: lo}));
    }));
    const pack = () => (current().s.player.combat || {}).pack || [];          // a Beast Master's pack (Part 11b)
    host.querySelectorAll("[data-packadd]").forEach((b) => b.addEventListener("click", async () => err(await act("pack", {ids: pack().concat([b.dataset.packadd])}))));
    host.querySelectorAll("[data-packoff]").forEach((b) => b.addEventListener("click", async () => err(await act("pack", {ids: pack().filter((x) => x !== b.dataset.packoff)}))));
    host.querySelectorAll("[data-packup]").forEach((b) => b.addEventListener("click", async () => { const p = pack(), i = p.indexOf(b.dataset.packup); if (i > 0) { [p[i - 1], p[i]] = [p[i], p[i - 1]]; err(await act("pack", {ids: p})); } }));
  }
  /** A Beast Master's pack (Part 11b): who fights, in order, and who waits on the bench. */
  function packPlanHTML(pp) {
    const inPack = pp.pack.map((id) => pp.beasts.find((x) => x.id === id)).filter(Boolean), out = pp.beasts.filter((x) => x.inPack < 0);
    const row = (x, i) => `<div class="pp-recipe${x.resting ? " short" : ""}"><div class="pp-recipe-main"><b>${i < pp.size ? (i === 0 ? "Front: " : "Fights: ") : "Bench: "}${esc(x.name)}</b>
        <span class="stamp">${esc(x.type)} · level ${x.level} · ${x.hp}/${x.maxHp}${x.resting ? " · resting" : ""}</span></div>
        <span class="pp-place-btns">${i ? `<button class="btn btn-sm btn-quiet" data-packup="${esc(x.id)}" title="Move up">↑</button>` : ""}<button class="btn btn-sm btn-quiet" data-packoff="${esc(x.id)}">Leave out</button></span></div>`;
    return `<div class="pp-label">Your pack</div>
      
      ${inPack.length ? inPack.map(row).join("") : `<p class="stamp"><b>Nobody in your pack</b> -- add a battle pet below.</p>`}
      ${out.length ? `<div class="pp-row">${out.map((x) => `<button class="btn btn-sm" data-packadd="${esc(x.id)}" ${inPack.length >= pp.size + pp.bench ? "disabled" : ""}>+ ${esc(x.name)} (${esc(x.type)}, ${x.level})</button>`).join("")}</div>` : pp.beasts.length ? "" : `<p class="stamp">No battle pets yet -- a new pet can go to the Beast Pen when it hatches.</p>`}`;
  }
  // the specials catalogue (V18, 2026-10-20, Cam: "the skills that you want to appear on the combat side bar screen can be adjusted
  // from a catalogue in the player screen under combat"): every special, an icon and its level, greyed until it's yours; a click
  // puts it on the Kit's side bar or takes it off (SPECIALS.max of them)
  /** A special's painted icon (spec_<id>, Cam's sheets 113-114), else its stand-in (the class book, the weapon). */
  function specIcon(id, standIn, size) { return itemIcon(window.PET_ICONS && window.PET_ICONS["spec_" + id] ? "spec_" + id : standIn || "tome", size); }
  function specCatalogueHTML(pv) {
    const all = pv.specCatalogue || [], on = pv.specLoadout || [];
    const cell = (x) => `<button class="pp-bcell pp-speccell${x.lock ? " lock" : ""}${x.on ? " on" : ""}" data-speccat="${esc(x.id)}" ${x.lock ? "disabled" : ""}
        title="${esc(x.name)} (${esc(x.from)}) -- ${esc(x.about)} ${x.cost}${pv.fury ? " " + esc(pv.meter) : "%"}${x.lock ? " -- " + esc(x.lock) : x.on ? " -- on your side bar" : ""}">
        <img alt="" src="${specIcon(x.id, x.icon, 48)}">${x.level ? `<span class="lv">${x.level}</span>` : ""}<span class="pp-specname">${esc(x.name)}</span></button>`;
    const group = (kind, title) => { const l = all.filter((x) => x.kind === kind); return l.length ? `<div class="pp-label">${title}</div><div class="pp-specgrid">${l.map(cell).join("")}</div>` : ""; };
    return `<div class="pp-label">Specials <span class="stamp">${on.length}/${Core.SPECIALS.max} on your side bar</span></div>
      ${pv.cls ? group("class", esc(Core.CLASSES[pv.cls].name)) : ""}${group("weapon", "Weapons")}${group("signature", "Signature weapons")}`;
  }
  function combatHTML(pv) {
    const cls = pv.cls ? Core.CLASSES[pv.cls] : null;
    const specials = cls ? cls.specials : {};
    const typeList = (t) => Object.keys(t || {}).map((k) => Core.DTYPES[k].toLowerCase()).join(", ") || "nothing";
    return `<div class="pp-trip">
      ${pv.packPlan ? packPlanHTML(pv.packPlan) : `<div class="pp-label">How you fight</div>
      <div class="pp-row">${Object.keys(Core.STYLES).map((k) => `<button class="btn btn-sm pp-style${pv.combat.style === k ? " on" : ""}" data-style="${k}"
          title="${esc(Core.STYLES[k].about)}">${esc(Core.STYLES[k].name)}</button>`).join("")}
        <span class="stamp">${esc(Core.STYLES[pv.combat.style] ? Core.STYLES[pv.combat.style].about : "")}</span></div>`}
      ${cls ? specCatalogueHTML(pv) + `
        ${pv.fury ? ``
          : `${pv.combat.special && specials[pv.combat.special] ? `` : ""}
        <div class="pp-row"><span class="stamp">Special bar</span><span class="pp-bar pp-spec"><span id="pp-spec-box" style="width:${pv.spec}%"></span></span>
          <span class="stamp">+10 a fight</span></div>`}
        ${pv.paladin ? `<p class="stamp">${pv.bless ? `Your blade is blessed — ${pv.bless.left} hits left (more against the undead).` : "Bless your blade with holy water from your bag (open it, then <b>Bless your blade</b>)."}</p>` : ""}
        ${pv.canCoat ? `<p class="stamp">${pv.coat ? `Your blades: <b>${esc(pv.coat.name)}</b> — ${pv.coat.left} hits left. (Throwing knives carry it too.)` : "Your blades are clean — coat them from a poison in your bag (open it, then <b>Coat your blades</b>)."}</p>` : ""}
        `
      : `<p class="stamp">Choose a class at the Guild hall in the Village for special attacks.</p>`}
    </div>`;
  }
  // the gravestone's Open button, wherever it shows (the Hunting page, the top bar) -- V16
  document.addEventListener("click", async (e) => {
    const b = e.target.closest && e.target.closest("#pp-grave-open, [data-graveopen]"); if (!b) return;
    e.preventDefault(); const r = await act("grave", {op: "open"}); if (r) toast(r.error || r.msg, !!r.error);
  });
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

  // ---- expeditions (slice 4) -------------------------------------------------------------
  // ---- the Camp and the Bestiary (2026-10-06, part 3; Cam: "the more unlocks we achieve, the better
  //      our next run is") ---------------------------------------------------------------------------
  function renderCamp(host) {
    const {s, now} = current();
    const c = Core.campView(s, now);
    host.innerHTML = `
      <div class="pp-page">
        ${paintedHTML("camp", [{key: "@forest", name: "Forest"}, {key: "camp:fire", name: "Campfire"}, {key: "camp:training", name: "Training post"},
          {key: "camp:relic", name: "Relic chest", note: `${c.relics} relic${c.relics === 1 ? "" : "s"}`}])}
        <div class="np-panel np-statstrip">${badge("Ancient relics", c.relics, "warn")}
          <span class="stamp">Found clearing the deep areas: one sometimes from the Caves, one or two from each later area. Upgrades last for every pet, through deaths.</span></div>
        <p class="pp-status" id="pp-status">${esc(status)}</p>
        <div class="pp-areas">${c.upgrades.map((u) => `
          <div class="pp-area">
            <div class="pp-skill-head"><b>${esc(u.name)}</b><span class="pp-level">${u.max > 1 ? `Level ${u.level} of ${u.max}` : u.level ? "Built" : "Not built"}</span></div>
            <div class="stamp">${esc(u.says.charAt(0).toUpperCase() + u.says.slice(1))}.</div>
            ${u.id === "phoenix" && u.level ? `<div class="stamp">${c.phoenixReady ? "Ready." : "Resting — it wakes a day after it last saved a pet."}</div>` : ""}
            ${u.level < u.max ? `<button class="btn btn-sm pp-camp" data-u="${u.id}" ${u.can ? "" : "disabled"}><img alt="" src="${itemIcon("relic", 16)}"> ${u.cost} relics</button>` : ""}
          </div>`).join("")}</div>
      </div>`;
    host.querySelectorAll(".pp-camp").forEach((b) => b.addEventListener("click", async () => {
      const r = await act("camp", {upgrade: b.dataset.u});
      if (r && r.error) { status = r.error; toast(r.error, true); const el = host.querySelector("#pp-status"); if (el) el.textContent = status; }
    }));
    wirePainted(host, (k) => {                                         // the picture: back to the Forest, or the upgrades
      if (k === "@forest") { worldRegion = "forest"; return goTo("pet:world"); }
      const el = host.querySelector(".pp-areas"); if (el) el.scrollIntoView({block: "start", behavior: "smooth"});
    });
  }
  // The Bestiary: one home for every creature (V6, "Know your quarry") -- the ones you hunt (default) and the ones your pets meet
  let bestiaryTab = "hunt";
  const elName = (el) => (Core.ELEMENTS[el] || {}).name || el;
  /** What you know of a creature, as chips: "?" until your kills teach you (V6). */
  function quarryChips(k) {
    const chip = (cls, label, list, names) => list === null ? `<span class="pp-know-chip unknown" title="Beat more to learn this">${label}: ?</span>`
      : list.length ? `<span class="pp-know-chip ${cls}">${label}: ${list.map((x) => esc(names ? elName(x) : x)).join(", ")}</span>` : "";
    return chip("weak", "Weak", k.weak) + chip("resist", "Resists", k.resist) + chip("weak", "Fears", k.elWeak, true) + chip("resist", "Shrugs off", k.elResist, true);
  }
  function renderBestiary(host) {
    const {s} = current();
    const tabs = `<nav class="pp-tabs" role="tablist" aria-label="Bestiary">${[["hunt", "Your hunts"], ["pets", "Your pets' expeditions"]].map(([k, n]) =>
      `<button class="pp-tab${bestiaryTab === k ? " on" : ""}" role="tab" aria-selected="${bestiaryTab === k}" data-btab="${k}">${n}</button>`).join("")}</nav>`;
    let body;
    if (bestiaryTab === "hunt") {
      const T = Core.QUARRY.tiers;
      body = `<p class="stamp" style="margin:0 0 12px">Every creature you've beaten, ground by ground. Beat ${T.style} and you know where to hit it; ${T.resist}, what it
          shrugs off; ${T.elements}, its elements. Beat enough to <b>master</b> it: +${Math.round(Core.QUARRY.bonus.dmg * 100)}% damage and drops against it, a trophy here,
          and for some its own special drop. Ranger Ash in the Forest can tell you more.</p>
        ${Core.quarryView(s).map((g) => `<div class="pp-group"><div class="pp-label">${esc(g.name)} <span class="stamp">· level ${g.level}${g.trackWhy ? ` · tracking: ${esc(g.trackWhy.toLowerCase())}` : " · you can track one kind here"}</span></div>
          <div class="pp-beasts">${g.creatures.map((c) => { const k = c.know;
            if (!k.kills) return `<div class="pp-beast unknown"><b>???</b><div class="stamp">Not beaten yet${c.night ? " · comes out at night" : ""}${c.boss ? " · the boss" : ""}</div></div>`;
            const bar = k.mastery ? `<div class="pp-skill-bar" title="${k.kills} of ${k.mastery} for mastery"><span class="pp-skill-fill" style="width:${Math.min(100, Math.round(100 * k.kills / k.mastery))}%"></span></div>` : "";
            return `<div class="pp-beast${c.boss ? " guardian" : ""}${k.mastered ? " mastered" : ""}">
              <div class="pp-quarry-top"><img alt="" src="${monsterURL(c.id, 32)}"><b>${esc(c.name)}</b>${c.boss ? ' <span class="pp-guard-tag">Boss</span>' : ""}${k.mastered ? ' <span class="pp-guard-tag mastered">Mastered</span>' : ""}</div>
              <div class="stamp">Beaten ${k.kills.toLocaleString()}${k.mastery && !k.mastered ? ` · mastery at ${k.mastery.toLocaleString()}` : ""}${k.next && k.next < (k.mastery || Infinity) ? ` · learn more at ${k.next}` : ""}</div>
              <div class="pp-know">${quarryChips(k)}</div>${bar}
              ${c.tracked ? `<div class="pp-row"><span class="pp-need-chip">Tracking</span><button class="btn btn-sm btn-quiet" data-track="${esc(g.ground)}" data-mon="">Stop tracking</button></div>`
                : c.canTrack ? `<div class="pp-row"><button class="btn btn-sm" data-track="${esc(g.ground)}" data-mon="${esc(c.id)}" title="Hunt only ${esc(c.name.toLowerCase())}s at the ${esc(g.name)} -- a little slower between fights">Track</button></div>` : ""}
              ${k.mastered ? `<div class="stamp">Trophy won${k.drop ? ` · its <b>${esc(k.drop.name)}</b>: ${esc(k.drop.about)}` : ""}</div>`
                : k.mastery ? `<div class="stamp">Mastery brings a trophy${k.drop ? ` and now and then its ${esc(k.drop.name.toLowerCase())}` : ""}.</div>` : ""}</div>`; }).join("")}</div></div>`).join("")}`;
    } else {
      const areas = Core.bestiaryView(s);
      body = `<p class="stamp" style="margin:0 0 12px">Every creature your pets meet on expeditions. Beat one 5 times and your pets know it
          (studied: they hit it more often, and harder); 15 times and they've mastered it.</p>
        ${areas.map((a) => `<div class="pp-group"><div class="pp-label">${esc(a.name)}</div>
          <div class="pp-beasts">${a.foes.map((f) => f.met ? `
            <div class="pp-beast${f.guardian ? " guardian" : ""}"><div><b>${esc(f.name)}</b>${f.guardian ? ' <span class="pp-guard-tag">Guardian</span>' : ""}</div>
              <div class="stamp">Health ${f.hp} · Attack ${f.att} · Defence ${f.def} · hits up to ${f.maxHit}</div>
              <div class="stamp">Beaten ${f.beaten} · felled your pets ${f.felled}${f.know && f.know !== "met" ? ` · <b>${esc(f.know)}</b>` : ""}${f.toNext ? ` · ${f.toNext} more wins to ${f.beaten >= 5 ? "master" : "study"} it` : ""}</div></div>`
            : `<div class="pp-beast unknown"><b>???</b><div class="stamp">Not met yet</div></div>`).join("")}</div></div>`).join("")}`;
    }
    host.innerHTML = `<div class="pp-page">${tabs}${body}</div>`;
    host.querySelectorAll("[data-btab]").forEach((b) => b.addEventListener("click", () => { bestiaryTab = b.dataset.btab; renderBestiary(host); }));
    host.querySelectorAll("[data-track]").forEach((b) => b.addEventListener("click", async () => {   // tracking (V15)
      const r = await act("track", {ground: b.dataset.track, mon: b.dataset.mon}); if (r && r.error) toast(r.error, true); }));
  }

  // ---- Today (2026-10-07): the first screen -- what's going on, what's ready, where you left off -----------
  function renderDash(host, after) {
    everySecond("dash");
    const here = page();
    const {s, v, now} = current();
    const d = Core.dashView(s, now);
    const pic = (x, size) => x.pet && v.has ? petURL(v.species, v.colour, size, "ok", v.skin) : x.look ? avatarURL(x.look, size) : itemIcon(x.icon || "obj_map", size);
    const tile = (x, i, list) => `<button class="pp-dash-row" data-list="${list}" data-i="${i}">
        <img alt="" src="${pic(x, 32)}">
        <span class="pp-dash-text"><b>${esc(x.title)}</b>${x.sub ? `<span class="stamp">${esc(x.sub)}</span>` : ""}</span>
        ${x.endsIn ? `<span class="pp-dash-clock" data-ends="${now + x.endsIn * 1000}">${clock(x.endsIn)}</span>` : `<span class="pp-dash-go">›</span>`}
      </button>`;
    host.innerHTML = `
      <div class="pp-page pp-dash">
        <p class="pp-status" id="pp-status">${esc(status)}</p>
        <section class="pp-dash-hero">
          ${v.has ? `<img class="pp-dash-pet" alt="" src="${petURL(v.species, v.colour, 96, "ok", v.skin)}">` : `<img class="pp-dash-pet" alt="" src="${itemIcon("starteregg", 96)}">`}
          <div class="pp-dash-who">
            <b>${v.has && v.name ? esc(v.name) : v.has ? "Your pet" : "No pet yet"}</b>
            <span class="stamp">${v.has && v.need ? esc(v.need) : v.has ? "Happy and well" : "Hatch the starter egg on My pet"}</span>
          </div>
          <div class="pp-dash-stats">
            <span><small>You</small><b>${esc(d.name)}</b></span>
            <span class="pp-mode-${d.mode}"><small>Mode</small><b>${esc(d.modeName)}${d.ngPlus ? ` · NG+${d.ngPlus > 1 ? d.ngPlus : ""}` : ""}</b></span>
            <span><small>Combat</small><b>${d.combat}</b></span>
            <span><small>Health</small><b>${d.hp}/${d.maxHp}</b></span>
            <span><small>Coins</small><b>${d.coins.toLocaleString()}</b></span>
            <span class="${d.bag.used > d.bag.cap ? "pp-over" : ""}"><small>Bag</small><b>${d.bag.used}/${d.bag.cap}</b></span>
          </div>
        </section>
        ${(() => { const st = d.story; if (!st) return "";      // the story (2026-10-10, audit H-4)
          return st.finished ? `<section class="pp-dash-card pp-story"><h3>${esc(st.name)}</h3><p class="stamp">Every chapter told (${st.total}/${st.total}). More of the story is coming.</p></section>`
            : `<section class="pp-dash-card pp-story">
            <h3>${st.part > 1 ? `Part ${st.part}: ` : ""}${esc(st.name)} · <span class="stamp">chapter ${st.chapter} of ${st.total}</span></h3>
            <p><b>${esc(st.title)}</b> — ${esc(st.text)}</p>
            <p class="stamp">See <b>${esc(st.person)}</b> in the <b>${esc(st.regionName)}</b>.${st.gated && st.opens.length ? ` Opens: ${esc(st.opens.join(", "))}.` : ""}</p>
            <button class="btn" data-story-region="${esc(st.region)}">Find ${esc(st.person)} on the Map</button></section>`; })()}
        <div class="pp-dash-grid">
          <section class="pp-dash-card">
            <h3>Going on now</h3>
            ${d.live.length ? d.live.map((x, i) => tile(x, i, "live")).join("") : `<p class="stamp">Nothing's running. Pick somewhere on the map, or pick up where you left off.</p>`}
            ${d.again.length ? `<h3>Pick up where you left off</h3><div class="pp-dash-again">${d.again.map((x, i) =>
              `<button class="btn" data-again="${i}">${esc(x.title)}</button>`).join("")}</div>` : ""}
            <div class="pp-dash-again"><button class="btn btn-quiet" data-jump="pet:world">Map</button><button class="btn btn-quiet" data-jump="pet:estate">Estate</button>
              <button class="btn btn-quiet" data-jump="pet:village">Village</button></div>
          </section>
          <section class="pp-dash-card">
            <h3>Ready for you</h3>
            ${d.ready.length ? d.ready.map((x, i) => tile(x, i, "ready")).join("") : `<p class="stamp">All caught up.</p>`}
          </section>
          <section class="pp-dash-card pp-dash-log">
            <h3>Lately</h3>
            ${d.log.map((e) => `<p><span class="stamp">${esc(new Date(e.at).toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"}))}</span> ${esc(e.text)}</p>`).join("")}
          </section>
        </div>
        ${after || ""}
      </div>`;
    const go = (x) => { if (x.region) worldRegion = x.region; goTo(x.go); };
    host.querySelectorAll(".pp-dash-row").forEach((b) => b.addEventListener("click", () => go(d[b.dataset.list][+b.dataset.i])));
    host.querySelectorAll("[data-story-region]").forEach((b) => b.addEventListener("click", () => { worldRegion = b.dataset.storyRegion; seaChart = false; goTo("pet:world"); }));
    host.querySelectorAll("[data-again]").forEach((b) => b.addEventListener("click", async () => {
      const x = d.again[+b.dataset.again];
      if (!x.act) { worldRegion = x.region || ""; seaChart = false; return goTo("pet:world"); }   // to the place, on the map (2026-10-10)
      const r = await act(x.act, Object.assign({roll: Math.random()}, x.opts));
      if (r && r.error) { status = r.error; toast(r.error, true); render(); }
    }));
    host.querySelectorAll("[data-jump]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.jump === "pet:world") worldRegion = ""; goTo(b.dataset.jump); }));
    everySecond("dash", () => {
      if (!host.isConnected || page() !== here) return false;
      let done = false;
      host.querySelectorAll("[data-ends]").forEach((el) => { const left = Math.ceil((+el.dataset.ends - Date.now()) / 1000); if (left <= 0) done = true; el.textContent = clock(Math.max(0, left)); });
      if (done) { render(); return false; }
    });
  }

  // ---- settings (2026-10-08, Cam: "Settings can hide the modder and new game button etc.") -- kept by pet.py
  const SETTING_ROWS = [
    ["sidebar", "Show the sidebar", "Hide it for a cleaner screen -- the ☰ button in the top bar brings it back, and Home and Map stay up there"],
    ["dailySaves", "Show the save slots on the first start of the day", "When NeuroPets has been fully closed: pick a game, or carry on"],
    ["newGame", "Show New game buttons", "On the Save slots page (and Clear)"],
    ["modder", "Show the Modder", "Making mod packs, in the sidebar"],
    ["sandbox", "Show the Sandbox switch", "The developer's copy of the game, at the foot of the sidebar"],
    ["@Accessibility"],
    ["dayNight", "Day and night on the pictures", "The outdoor pictures dim and warm with your clock in the evening and at night (fireflies come out); off: always daylight"],
    ["deepNight", "Deeper night", "A darker, duskier evening and night on the pictures (the original light); off: a gentle dusk"]];
  const SETTING_OFF = {deepNight: true, kit: true};                               // switches that start off
  function renderSettings(host) {
    const st = (window.NP && NP.settings) || {};
    // PT32 x1 (Cam: "the layout of the new UI works really good ... implement this whereever a similar UI is located"): one
    // titled card per group, as in Dev tools
    const groups = [];
    SETTING_ROWS.forEach((r) => { if (r[0].startsWith("@")) groups.push({title: r[0].slice(1), icon: "lantern", rows: []});
      else { if (!groups.length) groups.push({title: "The screen", icon: "obj_map", rows: []}); groups[groups.length - 1].rows.push(r); } });
    host.innerHTML = `
      <div class="pp-page pp-settings-page">
        ${groups.map((g) => `<section class="pp-shop pp-dev-card pp-settings"><h3><img alt="" src="${itemIcon(g.icon, 24)}">${esc(g.title)}</h3>
          ${g.rows.map(([k, name, about]) => `<label class="pp-setting"><input type="checkbox" data-setting="${k}" ${(SETTING_OFF[k] ? st[k] === true : st[k] !== false) ? "checked" : ""}>
            <span><b>${esc(name)}</b><span class="stamp">${esc(about)}</span></span></label>`).join("")}</section>`).join("")}
        <section class="pp-shop pp-dev-card"><h3><img alt="" src="${itemIcon("candle", 24)}">The tutorial</h3>
          <p class="stamp">${esc(Core.GUIDE.name)} walks you through the basics again (her gifts are only given once).</p>
          <div class="pp-dev-row"><span class="pp-dev-label">Again</span><div class="pp-dev-ctl"><button class="btn" id="pp-tutor-again">Start the tutorial</button></div></div></section>
      </div>`;
    const ta = host.querySelector("#pp-tutor-again");
    if (ta) ta.addEventListener("click", async () => { const r = await act("tutorial", {op: "restart"}); if (r && r.error) toast(r.error, true); });
    host.querySelectorAll("[data-setting]").forEach((i) => i.addEventListener("change", () => { if (window.NP && NP.setSetting) NP.setSetting(i.dataset.setting, i.checked); }));
  }

  // ---- save slots and new games (2026-10-07, Cam: "3 save slots to play different characters at a time" ... "3
  //      different game modes" ... "a new game plus mode which gets unlocked when you beat the last boss") ----------
  let newGameSlot = 0, newGameMode = "hardcore", ngFrom = 0, ngPets = [], ngBeast = "", slotData = null, newGameMod = "";
  /** What New Game Plus brings from the finished game (Battle Re-work Part 12): the class's gift, its points, the
   *  techniques, the prestige mark -- and, for a Beast Master, which battle pet comes back. */
  function legacyHTML(L) {
    if (!L) return "";
    const items = Object.keys(L.items).map((k) => `${Core.ITEMS[k] ? esc(Core.ITEMS[k].name) : esc(k)}${L.items[k] > 1 ? ` ×${L.items[k]}` : ""}`);
    return `<div class="pp-label">Your legacy</div>
      <ul class="pp-legacy">
        ${L.cls ? `<li>Your highest class: <b>${esc(L.name)} level ${L.level}</b>${items.length ? ` -- ${items.join(", ")}` : ""}.</li>` : `<li class="stamp">No class in that game, so no class gift.</li>`}
        ${L.points ? `<li><b>${L.points} free talent point${L.points === 1 ? "" : "s"}</b> whenever you're ${esc(L.name === "Arcane" ? "an Arcane" : "a " + L.name)} (one for every 10 levels you had).</li>` : ""}
        ${L.beast ? (L.beasts.length ? `<li>A battle pet from your old Pen, back at battle level ${L.battleLevel}:
            <select class="input" id="pp-ng-beast">${L.beasts.map((b) => `<option value="${esc(b.id)}" ${ngBeast === b.id ? "selected" : ""}>${esc(b.name)} (battle level ${b.level})</option>`).join("")}</select></li>`
          : `<li class="stamp">Your old Pen was empty, so no battle pet comes with you.</li>`) : ""}
        ${(L.oldClasses || []).length ? `<li>The weapons and armour of every class you levelled: <b>${L.oldClasses.map((c) => esc(c.name)).join(", ")}</b> -- change how you fight mid-hunt.</li>` : ""}
        ${L.techs.length ? `<li>Your techniques: ${L.techs.map((t) => esc(t.name)).join(", ")}.</li>` : ""}
        <li>Prestige mark ${L.marks}${L.marks >= L.freeRespecAt ? " -- one respec a game is free" : ` (at ${L.freeRespecAt}, one respec a game is free)`}.</li>
      </ul>`;
  }
  async function renderSaves(host) {
    if (slot === "dev") { host.innerHTML = `<div class="pp-page"><p class="stamp">Save slots are for your real game, not the sandbox.</p></div>`; return; }
    if (!slotData) {
      host.innerHTML = `<div class="pp-page"><p class="stamp">Opening your saves…</p></div>`;
      const r = await call("pet_slots", [], "Reading your saves");
      slotData = r && !r.error ? r : {active: 1, slots: [states.main, null, null]};
      const ms = await call("pet_mods", [], "Reading your mod packs");
      slotData.mods = Array.isArray(ms) ? ms : [];
      if (page() === "pet:saves") renderSaves(host);
      return;
    }
    const now = Date.now(), sums = slotData.slots.map((st) => Core.slotSummary(st, now));
    const ngSources = sums.map((x, i) => x && x.ngUnlocked ? i + 1 : 0).filter(Boolean);
    const when = (t) => t ? new Date(t).toLocaleString([], {day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"}) : "";
    const showNewGame = !(window.NP && NP.settings && NP.settings.newGame === false);
    const card = (x, i) => { const n = i + 1, on = n === slotData.active;
      return `<section class="pp-slot-card${on ? " on" : ""}">
        <div class="pp-label">Slot ${n}${on ? " · playing" : ""}</div>
        ${x ? `<b class="pp-slot-name">${esc(x.name)}</b>
            <div><span class="pp-mode-tag pp-mode-${x.mode}">${esc(x.modeName)}</span>${x.ngPlus ? ` <span class="pp-mode-tag ng">New Game Plus${x.ngPlus > 1 ? " " + x.ngPlus : ""}</span>` : ""}${x.dead ? ` <span class="pp-mode-tag dead">Died</span>` : ""}</div>
            <div class="stamp">Combat ${x.combat} · total level ${x.total} · ${coinTxt(x.coins)}${x.pet ? ` · ${esc(x.pet)}` : ""}</div>
            <div class="stamp">${x.mod ? `Mod pack: ${esc(x.mod)} · ` : ""}${x.ngUnlocked ? "★ Basilisk beaten: New Game Plus unlocked · " : ""}last played ${esc(when(x.last))}</div>`
          : `<p class="stamp">${slotData.slots[i] && !on ? "A game not started yet" : on ? "A new game -- make your character on the Player page" : "Empty"}</p>`}
        <div class="pp-place-btns">
          ${!on && x ? `<button class="btn btn-sm btn-primary" data-play="${n}">Play</button>` : ""}
          ${showNewGame ? `<button class="btn btn-sm" data-new="${n}">New game</button>` : ""}
          ${slotData.slots[i] ? `<button class="btn btn-sm btn-quiet pp-slot-delete" data-clear="${n}" title="${on ? "Delete this game and start afresh here (with the tutorial)" : "Delete this game"}">Delete</button>` : ""}
        </div>
      </section>`; };
    const src = ngFrom && sums[ngFrom - 1], cur = sums[slotData.active - 1];
    // the first start of the day (2026-10-08, Cam: "Happy for save slots to appear when first opening the game for the day")
    const welcome = window.NP && NP.welcome;
    host.innerHTML = `
      <div class="pp-page">
        <p class="pp-status" id="pp-status">${esc(status)}</p>
        ${welcome ? `<section class="pp-shop pp-welcome"><div><b>${new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 18 ? "Good afternoon" : "Good evening"}!</b>
            <span class="stamp">Which game today?</span></div>
            <button class="btn btn-primary" id="pp-carry-on">Carry on${cur ? ` with ${esc(cur.name)}` : ""}</button></section>` : ""}
        <div class="pp-slots">${sums.map(card).join("")}</div>
        ${newGameSlot ? `<section class="pp-shop pp-newgame">
          <b>A new game in slot ${newGameSlot}</b>
          ${slotData.slots[newGameSlot - 1] && sums[newGameSlot - 1] ? `<p class="pp-over">This replaces ${esc(sums[newGameSlot - 1].name)}'s game in slot ${newGameSlot}.</p>` : ""}
          <div class="pp-label">Mod pack</div>
          <select class="input" id="pp-ng-mod"><option value="">None -- the game as it is</option>${(slotData.mods || []).map((m) => `<option value="${esc(m.id)}" ${newGameMod === m.id ? "selected" : ""}>${esc(m.name)}</option>`).join("")}</select>
          <div class="pp-modes">${Object.keys(Core.MODES).map((k) => `<label class="pp-mode-pick${newGameMode === k ? " on" : ""}">
              <input type="radio" name="pp-mode" value="${k}" ${newGameMode === k ? "checked" : ""}><b>${esc(Core.MODES[k].name)}</b><span class="stamp">${esc(Core.MODES[k].about)}</span></label>`).join("")}</div>
          ${ngSources.length ? `<div class="pp-label">New Game Plus</div>
            
            <select class="input" id="pp-ng-from"><option value="0">No -- a plain new game</option>${ngSources.map((n) => `<option value="${n}" ${ngFrom === n ? "selected" : ""}>From slot ${n}: ${esc(sums[n - 1].name)}</option>`).join("")}</select>
            ${src ? `<div class="pp-ng-pets">${src.pets.map((p) => `<label class="pp-need-chip${ngPets.includes(p.id) ? "" : " lack"}"><input type="checkbox" data-pet="${p.id}" ${ngPets.includes(p.id) ? "checked" : ""}
                ${!ngPets.includes(p.id) && ngPets.length >= 3 ? "disabled" : ""}> ${esc(p.name)} (${esc(p.kind)}, level ${p.level})</label>`).join("")}</div>
              <p class="stamp">${ngPets.length}/3 pets chosen.</p>${legacyHTML(src.legacy)}` : ""}` : `<p class="stamp">Beat the Basilisk (the Jungle's boss) in any slot to unlock New Game Plus.</p>`}
          <div class="pp-place-btns"><button class="btn btn-primary" id="pp-ng-go">Start</button><button class="btn btn-quiet" id="pp-ng-cancel">Cancel</button></div>
        </section>` : ""}
      </div>`;
    const reload = async () => { slotData = null; renderSaves(host); };
    const co = host.querySelector("#pp-carry-on");
    if (co) co.addEventListener("click", () => { NP.welcome = false; goTo("pet:estate"); });
    host.querySelectorAll("[data-play]").forEach((b) => b.addEventListener("click", async () => {
      const r = await call("pet_switch", [+b.dataset.play], "Switching games");
      if (!r || r.error) { toast((r && r.error) || "Couldn't switch.", true); return; }
      states.main = r; slotData = null; status = ""; if (window.NP) NP.welcome = false; toast(`Playing slot ${b.dataset.play}.`); goTo("pet:estate");
      checkpoint("main").then(() => render());        // a game left running for days: settle it once (OPT-1)
    }));
    host.querySelectorAll("[data-new]").forEach((b) => b.addEventListener("click", () => { newGameSlot = +b.dataset.new; ngFrom = 0; ngPets = []; renderSaves(host); }));
    // delete a save (2026-10-11, Cam: "Also need an ability to delete saves"): any slot, the one being played too -- that
    // one starts afresh, with the tutorial. Asked twice; the file before it is kept as a .bak.
    host.querySelectorAll("[data-clear]").forEach((b) => b.addEventListener("click", async () => {
      const n = +b.dataset.clear, name = sums[n - 1] ? sums[n - 1].name : `slot ${n}`;
      if (b.dataset.sure !== "1") { b.dataset.sure = "1"; b.textContent = `Delete ${name}'s game — sure?`; b.classList.add("pp-over"); return; }
      if (n === slotData.active) {
        const r = await call("pet_newgame", [n, Core.newGame({mode: (sums[n - 1] && sums[n - 1].mode) || newGameMode}, Date.now())], "Deleting the game");
        if (!r || r.error) { toast((r && r.error) || "Couldn't delete it.", true); return; }
        states.main = r; tutorStarted.delete("main"); slotData = null; status = "";
        toast(`${name}'s game is deleted -- a fresh start in slot ${n}.`); goTo("pet:home"); return;
      }
      const r = await call("pet_clearslot", [n], "Deleting the game");
      if (r && r.error) toast(r.error, true); else toast(`${name}'s game in slot ${n} is deleted.`);
      reload();
    }));
    host.querySelectorAll('input[name="pp-mode"]').forEach((i) => i.addEventListener("change", () => { newGameMode = i.value; renderSaves(host); }));
    const nm = host.querySelector("#pp-ng-mod");
    if (nm) nm.addEventListener("change", () => { newGameMod = nm.value; });
    const nf = host.querySelector("#pp-ng-from");
    if (nf) nf.addEventListener("change", () => { ngFrom = +nf.value; ngPets = []; ngBeast = ""; renderSaves(host); });
    const nb = host.querySelector("#pp-ng-beast");
    if (nb) nb.addEventListener("change", () => { ngBeast = nb.value; });
    host.querySelectorAll("[data-pet]").forEach((c) => c.addEventListener("change", () => {
      const id = c.dataset.pet; ngPets = c.checked ? ngPets.concat([id]).slice(0, 3) : ngPets.filter((x) => x !== id); renderSaves(host); }));
    const cancel = host.querySelector("#pp-ng-cancel");
    if (cancel) cancel.addEventListener("click", () => { newGameSlot = 0; renderSaves(host); });
    const go = host.querySelector("#pp-ng-go");
    if (go) go.addEventListener("click", async () => {
      const from = ngFrom ? slotData.slots[ngFrom - 1] : null;
      if (from && ngPets.length !== 3 && sums[ngFrom - 1].pets.length >= 3) { toast("Choose three pets to bring.", true); return; }
      let mod = null;
      if (newGameMod) { const m = await call("pet_mod_load", [newGameMod], "Reading the mod pack"); if (m && !m.error) mod = Core.cleanMod(m); }
      const st = Core.newGame({mode: newGameMode, from, pets: ngPets, beast: ngBeast, mod}, Date.now());
      const r = await call("pet_newgame", [newGameSlot, st], "Starting a new game");
      if (!r || r.error) { toast((r && r.error) || "Couldn't start it.", true); return; }
      states.main = r; toast(`A new ${Core.MODES[newGameMode].name} game in slot ${newGameSlot}.`);
      newGameSlot = 0; slotData = null; status = ""; goTo("pet:skills");
    });
  }

  // ---- the modder (2026-10-07, Cam: "an inbuilt modders tool where assets can be changed, custom backgrounds for maps
  //      and custom icons can be placed into the game, rates can be changed. These can then be saved and when starting
  //      a new game you should be able to select a mod pack ... A pet modder as well where you can change the color of
  //      pets, their bonus and add or remove buffs. Neuronet already has a tool to handle that.") -- pictures come from
  //      a PNG, or from NeuroNet's Assets (Creative -> Pixel art, saved as a Game asset) -------------------------------
  let modList = null, modDoc = null, modTab = "rates", modKind = "items", modQuery = "", modPet = "cat";
  const PIC_KINDS = {items: "Items", monsters: "Creatures", regions: "Regions and the map"};
  function picEntries(kind) {
    if (kind === "items") return Object.keys(Core.ITEMS).map((id) => ({id, name: Core.ITEMS[id].name, icon: itemIcon(id, 32)}));
    if (kind === "monsters") return Object.keys(Core.MONSTERS).map((id) => ({id, name: Core.MONSTERS[id].name, icon: monsterURL(id, 32)}));
    return [{id: "worldmap", name: "The world map (background)", icon: itemIcon("obj_map", 32)}, {id: "seachart", name: "The sea chart (background)", icon: itemIcon("obj_map", 32)}].concat(Core.REGION_ORDER.filter((r) => r !== "village")
      .map((r) => ({id: r, name: Core.REGIONS[r].name + " (scene)", icon: itemIcon("obj_map", 32)})));
  }
  async function renderModder(host) {
    if (!modList) {
      host.innerHTML = `<div class="pp-page"><p class="stamp">Opening the modder…</p></div>`;
      const r = await call("pet_mods", [], "Reading your mod packs");
      modList = Array.isArray(r) ? r : [];
      if (page() === "pet:modder") renderModder(host);
      return;
    }
    if (!modDoc) {
      host.innerHTML = `
        <div class="pp-page">
          <p class="stamp" style="margin:0 0 12px">A mod pack changes the game's rates, its pictures (items, creatures, the regions' scenes, the world map)
            and its pets (colours, companion buffs). Pick one when you start a new game in <b>Save slots</b> -- a game keeps the pack it began with.
            Draw pictures in NeuroNet (Creative → Pixel art) and save them as <b>Game assets</b>: they're offered here.</p>
          <div class="pp-slots">${modList.map((m) => `<section class="pp-slot-card">
              <b class="pp-slot-name">${esc(m.name)}</b>
              ${m.about ? `<div class="stamp">${esc(m.about)}</div>` : ""}
              <div class="stamp">${Object.keys(m.rates).length ? Object.keys(m.rates).map((k) => `${esc((Core.MOD_RATES[k] || k))} ×${m.rates[k]}`).join(" · ") : "Rates as they are"}
                · ${m.pictures} picture${m.pictures === 1 ? "" : "s"} · ${m.pets} kind${m.pets === 1 ? "" : "s"} of pet changed</div>
              <div class="pp-place-btns"><button class="btn btn-sm btn-primary" data-edit="${esc(m.id)}">Edit</button>
                <button class="btn btn-sm btn-quiet" data-del="${esc(m.id)}">Delete</button></div>
            </section>`).join("")}
            <section class="pp-slot-card"><b>A new mod pack</b><p class="stamp">Start from the game as it is.</p>
              <div class="pp-place-btns"><button class="btn btn-sm" id="pp-mod-new">New mod pack</button></div></section>
          </div>
        </div>`;
      host.querySelector("#pp-mod-new").addEventListener("click", () => { modDoc = {name: "", about: "", rates: {}, pets: {}, items: {}, monsters: {}, regions: {}}; modTab = "rates"; renderModder(host); });
      host.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", async () => {
        const m = await call("pet_mod_load", [b.dataset.edit], "Opening the mod pack");
        if (!m || m.error) { toast((m && m.error) || "Couldn't open it.", true); return; }
        modDoc = Object.assign({rates: {}, pets: {}, items: {}, monsters: {}, regions: {}}, m); modTab = "rates"; renderModder(host);
      }));
      host.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", async () => {
        if (b.dataset.sure !== "1") { b.dataset.sure = "1"; b.textContent = "Delete — sure?"; return; }
        const r = await call("pet_mod_delete", [b.dataset.del], "Deleting the mod pack");
        if (r && r.error) toast(r.error, true); else toast("Mod pack deleted.");
        modList = null; renderModder(host);
      }));
      return;
    }
    const d = modDoc;
    const tabs = [["rates", "Rates"], ["pictures", "Pictures"], ["pets", "Pets"]];
    let body = "";
    if (modTab === "rates") {
      body = `<p class="stamp">1 is the game as it is; 2 is twice as much (or as fast); 0.5 half.</p>
        <div class="pp-mod-rates">${Object.keys(Core.MOD_RATES).map((k) => `<label class="pp-mod-rate"><span>${esc(Core.MOD_RATES[k])}</span>
          <input class="input" type="number" min="0.1" max="10" step="0.05" data-rate="${k}" value="${d.rates[k] || 1}"> <span class="stamp">×</span></label>`).join("")}</div>`;
    } else if (modTab === "pictures") {
      const q = modQuery.trim().toLowerCase(), list = picEntries(modKind).filter((e) => !q || e.name.toLowerCase().includes(q) || e.id.includes(q));
      body = `<div class="pp-place-btns">${Object.keys(PIC_KINDS).map((k) => `<button class="btn btn-sm ${modKind === k ? "btn-primary" : ""}" data-kind="${k}">${PIC_KINDS[k]}</button>`).join("")}
          <input class="input" id="pp-mod-q" type="search" placeholder="Search…" value="${esc(modQuery)}" style="max-width:240px"></div>
        <p class="stamp">${list.length > 60 ? `Showing 60 of ${list.length} -- search to narrow it. ` : ""}A PNG works best: pixel art at 16, 32 or 48 pixels for icons; a wide picture for a scene or the map.</p>
        <div class="pp-mod-pics">${list.slice(0, 60).map((e) => { const mine = d[modKind][e.id];
          return `<div class="pp-mod-pic${mine ? " set" : ""}"><img alt="" src="${mine || e.icon}"><span><b>${esc(e.name)}</b>${mine ? `<span class="stamp">your picture</span>` : ""}</span>
            <span class="pp-place-btns"><label class="btn btn-sm">PNG…<input type="file" accept="image/png,image/webp,image/gif,image/jpeg" data-up="${esc(e.id)}" hidden></label>
              <button class="btn btn-sm" data-nn="${esc(e.id)}">From NeuroNet</button>${mine ? `<button class="btn btn-sm btn-quiet" data-reset="${esc(e.id)}">Reset</button>` : ""}</span></div>`; }).join("")}</div>`;
    } else {
      const species = Object.keys(Core.SPECIES), sp = Core.SPECIES[modPet], pm = d.pets[modPet] || {};
      const buffs = Array.isArray(pm.buffs) ? pm.buffs : Core.petBuffs({}, modPet);
      const skills = Object.keys(Core.SKILLS).map((k) => [k, Core.SKILLS[k].name + " xp"]).concat(Object.keys(Core.FIGHT_BOOSTS).map((k) => [k, Core.FIGHT_BOOSTS[k] + " in a fight"]));
      body = `<div class="pp-place-btns"><select class="input" id="pp-mod-pet" style="max-width:240px">${species.map((k) => `<option value="${k}" ${k === modPet ? "selected" : ""}>${esc(Core.SPECIES[k].name)}${d.pets[k] ? " ✎" : ""}</option>`).join("")}</select></div>
        <div class="pp-label">Colours</div>
        <div class="pp-mod-pets">${sp.colours.map((c) => { const cc = (pm.colours || {})[c] || {}, base = Art.palette(modPet, c) || {};
          return `<div class="pp-mod-pic"><img alt="" src="${petURL(modPet, c, 48, "ok", Object.assign({}, cc))}"><span><b>${esc(c)}</b></span>
            <span class="pp-place-btns">${["b", "l"].filter((k) => base[k]).map((k) => `<label class="stamp">${k === "b" ? "Body" : "Light"} <input type="color" data-col="${c}" data-key="${k}" value="${cc[k] || base[k]}"></label>`).join("")}
              ${(pm.colours || {})[c] ? `<button class="btn btn-sm btn-quiet" data-colreset="${c}">Reset</button>` : ""}</span></div>`; }).join("")}</div>
        <div class="pp-label">Companion buffs ${Array.isArray(pm.buffs) ? "" : "<span class='stamp'>(its own, unchanged)</span>"}</div>
        ${buffs.map((b, i) => `<div class="pp-place-btns"><select class="input" data-buffskill="${i}" style="max-width:240px">${skills.map(([k, n]) => `<option value="${k}" ${b.skill === k ? "selected" : ""}>${esc(n)}</option>`).join("")}</select>
            <input class="input" type="number" min="1" max="100" step="1" data-buffamt="${i}" value="${Math.round(b.amount * 100)}" style="max-width:90px"> <span class="stamp">% (doubled while happy)</span>
            <button class="btn btn-sm btn-quiet" data-buffdel="${i}">Remove</button></div>`).join("") || `<p class="stamp">No buffs.</p>`}
        <div class="pp-place-btns"><button class="btn btn-sm" id="pp-buff-add" ${buffs.length >= 4 ? "disabled" : ""}>Add a buff</button>
          ${d.pets[modPet] ? `<button class="btn btn-sm btn-quiet" id="pp-pet-reset">Back to its own</button>` : ""}</div>`;
    }
    host.innerHTML = `
      <div class="pp-page">
        <section class="pp-shop pp-mod-head">
          <div class="pp-place-btns"><input class="input" id="pp-mod-name" placeholder="The mod pack's name" value="${esc(d.name)}" style="max-width:320px">
            <input class="input" id="pp-mod-about" placeholder="What it does (a line)" value="${esc(d.about || "")}"></div>
          <div class="pp-place-btns">${tabs.map(([k, n]) => `<button class="btn btn-sm ${modTab === k ? "btn-primary" : ""}" data-tab="${k}">${n}</button>`).join("")}
            <span style="flex:1"></span><button class="btn btn-primary" id="pp-mod-save">Save</button><button class="btn btn-quiet" id="pp-mod-close">Close</button></div>
        </section>
        <section class="pp-shop">${body}</section>
      </div>`;
    const keepText = () => { d.name = host.querySelector("#pp-mod-name").value; d.about = host.querySelector("#pp-mod-about").value; };
    const again = () => { keepText(); renderModder(host); };
    host.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => { modTab = b.dataset.tab; again(); }));
    host.querySelector("#pp-mod-close").addEventListener("click", () => { modDoc = null; modList = null; renderModder(host); });
    host.querySelector("#pp-mod-save").addEventListener("click", async () => {
      keepText();
      const r = await call("pet_mod_save", [d], "Saving the mod pack");
      if (!r || r.error) { toast((r && r.error) || "Couldn't save it.", true); return; }
      d.id = r.id; toast(`Saved "${d.name}".`); modList = null;
    });
    host.querySelectorAll("[data-rate]").forEach((i) => i.addEventListener("change", () => {
      const v = Math.max(0.1, Math.min(10, Number(i.value) || 1)); if (v === 1) delete d.rates[i.dataset.rate]; else d.rates[i.dataset.rate] = v; }));
    host.querySelectorAll("[data-kind]").forEach((b) => b.addEventListener("click", () => { modKind = b.dataset.kind; modQuery = ""; again(); }));
    const mq = host.querySelector("#pp-mod-q");
    if (mq) mq.addEventListener("change", () => { modQuery = mq.value; again(); });
    host.querySelectorAll("[data-up]").forEach((inp) => inp.addEventListener("change", () => {
      const f = inp.files && inp.files[0];
      if (!f) return;
      if (f.size > 1024 * 1024) { toast("That picture is over 1 MB -- try a smaller one.", true); return; }
      const rd = new FileReader();
      rd.onload = () => { d[modKind][inp.dataset.up] = String(rd.result); again(); };
      rd.readAsDataURL(f);
    }));
    host.querySelectorAll("[data-reset]").forEach((b) => b.addEventListener("click", () => { delete d[modKind][b.dataset.reset]; again(); }));
    host.querySelectorAll("[data-nn]").forEach((b) => b.addEventListener("click", () => pickGameAsset((url) => { d[modKind][b.dataset.nn] = url; again(); })));
    const ps = host.querySelector("#pp-mod-pet");
    if (ps) ps.addEventListener("change", () => { modPet = ps.value; again(); });
    const petMod = () => { d.pets[modPet] = d.pets[modPet] || {}; return d.pets[modPet]; };
    host.querySelectorAll("[data-col]").forEach((i) => i.addEventListener("change", () => {
      const pm = petMod(); pm.colours = pm.colours || {}; pm.colours[i.dataset.col] = Object.assign(pm.colours[i.dataset.col] || {}, {[i.dataset.key]: i.value}); again(); }));
    host.querySelectorAll("[data-colreset]").forEach((b) => b.addEventListener("click", () => { const pm = petMod(); if (pm.colours) delete pm.colours[b.dataset.colreset]; again(); }));
    const curBuffs = () => { const pm = petMod(); if (!Array.isArray(pm.buffs)) pm.buffs = Core.petBuffs({}, modPet).map((x) => Object.assign({}, x)); return pm.buffs; };
    host.querySelectorAll("[data-buffskill]").forEach((sel) => sel.addEventListener("change", () => { curBuffs()[+sel.dataset.buffskill].skill = sel.value; again(); }));
    host.querySelectorAll("[data-buffamt]").forEach((i) => i.addEventListener("change", () => { curBuffs()[+i.dataset.buffamt].amount = Math.max(0.01, Math.min(1, (Number(i.value) || 10) / 100)); again(); }));
    host.querySelectorAll("[data-buffdel]").forEach((b) => b.addEventListener("click", () => { curBuffs().splice(+b.dataset.buffdel, 1); again(); }));
    const ba = host.querySelector("#pp-buff-add");
    if (ba) ba.addEventListener("click", () => { curBuffs().push({skill: "foraging", amount: 0.1}); again(); });
    const pr = host.querySelector("#pp-pet-reset");
    if (pr) pr.addEventListener("click", () => { delete d.pets[modPet]; again(); });
  }
  // NeuroNet's game assets (Creative -> Pixel art): pick one for the mod pack
  async function pickGameAsset(done) {
    const list = await call("pet_game_assets", [], "Reading NeuroNet's game assets");
    const box = document.createElement("div");
    box.className = "pp-modal pp-item-sheet";
    box.innerHTML = `<div class="pp-modal-card pp-sheet" role="dialog" aria-label="NeuroNet's game assets">
        <button class="btn btn-quiet btn-sm pp-shop-x" aria-label="Close">✕</button>
        <b>From NeuroNet's Assets</b>
        <p class="stamp">Your Game assets (Creative → Pixel art, saved as a Game asset).</p>
        <div class="pp-mod-pics">${Array.isArray(list) && list.length ? list.map((a) => `<button class="pp-mod-pic pp-asset-pick" data-id="${esc(a.id)}"><span class="pp-asset-thumb" data-thumb="${esc(a.id)}"></span>
            <span><b>${esc(a.name)}</b><span class="stamp">${a.w}×${a.h}</span></span></button>`).join("")
          : `<p class="stamp">No game assets yet -- draw one in NeuroNet (Creative → Pixel art) and save it as a Game asset.</p>`}</div>
      </div>`;
    document.body.appendChild(box);
    const close = () => box.remove();
    box.addEventListener("click", (e) => { if (e.target === box) close(); });
    box.querySelector(".pp-shop-x").addEventListener("click", close);
    box.querySelectorAll(".pp-asset-pick").forEach((b) => b.addEventListener("click", async () => {
      const a = await call("pet_game_asset", [b.dataset.id], "Reading the asset");
      if (!a || a.error || !a.dataUrl) { toast((a && a.error) || "Couldn't read it.", true); return; }
      close(); done(a.dataUrl);
    }));
    // the pictures, one by one (a pack can be big)
    for (const el of box.querySelectorAll("[data-thumb]")) {
      const a = await call("pet_game_asset", [el.dataset.thumb], "");
      if (a && a.dataUrl && el.isConnected) el.innerHTML = `<img alt="" src="${a.dataUrl}">`;
    }
  }

  // ---- the world map (2026-10-07, Cam: "Now start work on the neopets like world navigation") --------
  // The map: every region around the village, open or locked, with how much of it you've found. Click
  // one to go there: its places (spots, hunting ground, expedition) on its own scene, its secrets, and
  // Explore -- half an hour out, and now and then something hidden turns up.
  let worldRegion = "";
  // The painted map (2026-10-09, Cam's new picture of the main island: art/worldmap.webp, 2000x1116 -- Frostpeak is an
  // island of its own now, on the sea chart). Each region is a rough outline of where it's painted (the click area,
  // the fog when locked, the glow on hover) and `label` is the middle of its painted scroll [left, right, y] -- the
  // badges sit around that. Later outlines win a click, so the small places (caves, village, tower) come last. A mod
  // pack's own map uses the same layout.
  // (2026-10-16, Cam's new map of the main island -- the estate painted in, by the Mage tower: outlines and scrolls redrawn)
  const WORLD_ART = {
    meadow: {pts: "140,430 260,410 420,400 530,420 520,500 440,540 300,540 150,520", label: [340, 500, 474]},
    pasture: {pts: "140,540 300,540 440,545 560,560 560,650 460,680 320,690 200,670 150,620", label: [258, 398, 607]},
    forest: {pts: "720,170 830,90 1000,60 1200,60 1240,140 1200,280 1100,330 950,360 800,340 720,260", label: [925, 1073, 210]},
    deepforest: {pts: "1220,100 1400,100 1600,140 1740,220 1750,340 1650,440 1500,470 1400,440 1250,330 1210,200", label: [1320, 1508, 200]},
    coast: {pts: "1420,460 1560,420 1680,400 1800,420 1840,520 1800,620 1800,720 1700,680 1560,620 1470,590", label: [1580, 1746, 564]},
    jungle: {pts: "700,780 800,740 1000,620 1200,600 1380,620 1400,700 1380,800 1300,900 1200,1000 900,1000 720,960", label: [1106, 1288, 785]},
    deepjungle: {pts: "1320,760 1450,700 1600,690 1740,720 1760,860 1700,980 1550,1040 1400,1020 1320,900", label: [1422, 1628, 932]},
    farmyard: {pts: "350,720 470,690 600,700 740,760 740,880 640,960 480,960 360,900", label: [480, 670, 857]},
    crystalcaves: {pts: "1030,410 1150,340 1260,340 1360,400 1360,560 1220,580 1080,570 1020,500", label: [1102, 1323, 547]},
    village: {pts: "600,560 640,470 760,430 900,440 1000,500 1040,600 980,700 870,720 740,710 640,680", label: [770, 970, 685]},
    magetower: {pts: "90,250 170,120 300,40 450,50 560,120 700,150 700,230 600,280 500,290 420,330 260,390 200,390 100,300", label: [503, 703, 178]},
    mistyisle: {pts: "70,940 140,850 190,820 300,870 340,960 300,1040 100,1040", label: [108, 305, 993]}};
  const WORLD_W = 2000, WORLD_H = 1116;
  // regions not on the main island's map: the other islands and the Open Sea (on the sea chart, 2026-10-09) -- and in
  // the list under the map
  const WORLD_SOON = ["frostpeak", "desert", "nile", "oasis", "sandport", "frosthaven", "opensea", "icecavern", "summit", "hollowcrypt"];   // (the Hollow Crypt: reached from the Misty Isle)
  // The sea chart (2026-10-09, Cam's picture: art/seachart.webp, 2000x1116): the islands and the sea between them. The
  // Map opens on the main island; "Sea chart" shows this. main = the main island (its map, or sail home), islands =
  // sail there (or go ashore if you're on it), regions (Open Sea, Misty Isle) = go there, shipyard = Hal's page.
  const SEA_ART = {
    main: {pts: "120,560 250,400 500,400 900,380 1300,330 1500,480 1580,700 1520,880 1430,1000 1000,1080 600,1060 350,960 150,780", label: [536, 836, 418]},
    shipyard: {pts: "1350,780 1450,700 1780,720 1800,900 1550,1000 1380,960", label: [1470, 1730, 1040], chip: "The Shipyard"},
    opensea: {pts: "700,200 1250,180 1350,260 1250,380 900,380 700,330", label: [878, 1172, 290]},
    frostpeak: {pts: "70,170 140,60 300,60 500,90 640,170 610,300 450,330 200,340 70,320", label: [239, 528, 64]},
    desert: {pts: "1380,200 1560,70 1800,60 1920,180 1900,330 1750,440 1550,440 1470,330 1380,260", label: [1572, 1808, 420]},
    mistyisle: {pts: "60,960 120,860 190,820 310,880 330,1000 290,1090 80,1080", label: [94, 298, 1025]}};
  const SEA_BLURB = {frostpeak: "Snow, pines and the Yeti's summit. Frosthaven's harbour waits with its inn and an estate for sale.",
    desert: "Sand, the Nile and the Sphinx. Sandport's market never sleeps -- and there's an estate for sale."};
  // ---- painted places (2026-10-08, Cam's pictures: "Here the areas of the map that are unlocked") ---------
  // Where each place's scroll is painted on its scene: art/places.js (window.SCENE_PLACES, moved there 2026-10-15 so
  // Developer -> Place editor can write it; the format is at its top). "//" there holds notes, not a scene.
  const SCENE_ART = Object.assign({}, window.SCENE_PLACES || {});
  delete SCENE_ART["//"];
  // ---- living pictures (2026-10-08, Cam liked "a day/night tint on the pictures that follows your clock" and
  //      "little moving touches on the scenes"): smoke from chimneys and fires, water glinting, fires and lamps
  //      flickering, birds crossing the sky, fireflies after dark. Positions are on the 2000x1116 pictures.
  //      smoke [x,y] · water [x,y] · fire [x,y,r] · glow [x,y,r,colour] · birds n · flies n (after dark; always if `dark`)
  const SCENE_LIFE = {
    ranch: {birds: 3, water: [[150, 1050], [300, 1080]]},                           // the Farm (2026-10-12): the duck pond
    worldmap: {birds: 3, water: [[120, 60], [1850, 150], [1920, 900], [40, 700], [700, 1095], [1300, 1100]], smoke: [[668, 245]]},   // (the estate's chimney, 2026-10-16)
    seachart: {birds: 2, water: [[60, 420], [1650, 560], [1950, 300], [1300, 1090], [700, 40]]},
    // Cam's pictures, 2026-10-09: the day/night light outdoors (and a little life); indoors and underground, none
    "isle-desert": {birds: 3, water: [[80, 300], [1950, 500], [700, 1080]]}, "isle-frostpeak": {birds: 2, water: [[200, 500], [1800, 400], [500, 1050]]},
    desert: {birds: 1}, nile: {birds: 3, water: [[600, 650], [1150, 800], [1550, 900]]}, oasis: {birds: 2, water: [[700, 640], [850, 700]]},
    sandport: {birds: 3, water: [[150, 300], [100, 700], [500, 1080]]}, frosthaven: {birds: 1, smoke: [[575, 165], [860, 300]]},
    frostpeak: {birds: 1}, summit: {birds: 2}, mistyisle: {birds: 2, water: [[300, 1000], [1700, 900], [150, 650]]},
    icecavern: {indoor: true}, crystalcaves: {indoor: true}, nursery: {indoor: true}, storeroom: {indoor: true}, pyramid: {indoor: true},
    opensea: {birds: 3, water: [[900, 700], [1300, 500], [600, 400], [1100, 1000]]}, deepjungle: {flies: 8, dark: true}, shipyard: {birds: 2, water: [[200, 950], [700, 1050]]},
    magetower: {}, graveyard: {flies: 14, dark: true}, camp: {fire: [[1227, 751, 40]], flies: 10}, islandestate: {birds: 2},
    estate: {birds: 2, smoke: [[1140, 320], [975, 715], [205, 660]], water: [[160, 610], [420, 480], [90, 650]], fire: [[200, 770, 40], [970, 935, 25]]},
    village: {birds: 2, smoke: [[1840, 400], [370, 145], [1690, 820]], fire: [[1700, 860, 30]]},
    farmyard: {birds: 3, water: [[230, 620], [330, 690], [1000, 720], [1080, 650]], smoke: [[1890, 560]]},
    pasture: {birds: 3, water: [[300, 560], [1240, 650], [300, 960], [800, 1010], [1000, 300]]},
    meadow: {birds: 2, water: [[250, 1020], [400, 950], [1010, 580], [700, 560]]},
    forest: {birds: 1, water: [[330, 420], [230, 790], [200, 700], [270, 860]], fire: [[1130, 690, 45]], smoke: [[1130, 660]], flies: 12},
    deepforest: {water: [[720, 620], [1040, 570], [1100, 640]], fire: [[1800, 640, 40], [1770, 1000, 35]], smoke: [[1800, 610]],
                 glow: [[680, 330, 120, "#5ff0d8"]], flies: 16, dark: true},
    jungle: {birds: 2, water: [[640, 370], [1100, 620], [1000, 520], [950, 660]], fire: [[215, 290, 40], [1770, 1000, 35]], smoke: [[1770, 970]],
             glow: [[1470, 150, 140, "#d070ff"]], flies: 12},
    coast: {birds: 4, water: [[1500, 500], [1000, 1000], [600, 950], [1650, 200], [150, 600], [1200, 880]], glow: [[1935, 330, 60, "#ffe28a"]]},
    house: {indoor: true, fire: [[1035, 470, 70]], smoke: [[1040, 420]], glow: [[520, 265, 40, "#ffd58a"]]},
    library: {indoor: true, fire: [[650, 880, 60]], glow: [[330, 310, 90, "#b070ff"], [640, 420, 90, "#8a7aff"], [150, 330, 30, "#ffd58a"], [560, 235, 30, "#ffd58a"],
              [795, 285, 30, "#ffd58a"], [1190, 740, 25, "#ffd58a"], [1620, 730, 25, "#ffd58a"], [525, 860, 30, "#ffd58a"], [790, 850, 30, "#ffd58a"]]},
    workshop: {birds: 1, fire: [[1470, 250, 70], [440, 185, 40], [230, 270, 30], [1715, 875, 25], [1805, 830, 25], [1910, 895, 25], [1815, 1020, 25]],
               smoke: [[1430, 40], [310, 330]], glow: [[1550, 640, 60, "#c070ff"], [1770, 1000, 70, "#c070ff"]]}};
  /** The time of day, by the clock: a colour over the picture (none by day), and whether it's dark. */
  // (2026-10-08, Cam: the evening's navy wash looked like the map was "blue highlighted") -- the light now dims the
  // picture by multiplying (its own colours stay, darker and warmer), never a coloured veil over it; Settings can
  // turn it off
  // (2026-10-08, Cam: "maps have darkened since last update" -> a gentle night by default; then "add the other one but as a
  // setting in the settings menu (accessibility)" -> Settings, Accessibility: "Deeper night" brings back the darker light)
  const DAY_LIGHT = {
    gentle: {night: "#dcd6e0", dawn: "#fdf0e4", dusk: "#fef0dc", evening: "#f2e6da"},
    deep: {night: "#8e8794", dawn: "#fbe2cf", dusk: "#fde3bf", evening: "#d9bfa8"}};
  /** The sandbox's sky switch (PT15): "night", "day", or "" for the real clock -- the real game always has "". */
  function sandboxSky() { const d = slot === "dev" && states.dev && states.dev.dev; return d && (d.sky === "night" || d.sky === "day") ? d.sky : ""; }
  function dayPhase(now) {
    const sky = sandboxSky();
    const h = sky === "night" ? 23 : sky === "day" ? 12 : new Date(now || Date.now()).getHours() + new Date(now || Date.now()).getMinutes() / 60;
    const st = (window.NP && NP.settings) || {};
    if (st.dayNight === false) return {fill: "", dark: false, name: "day"};
    const L = DAY_LIGHT[st.deepNight ? "deep" : "gentle"];
    if (h >= 21 || h < 5) return {fill: L.night, dark: true, name: "night"};
    if (h < 7) return {fill: L.dawn, dark: false, name: "dawn"};
    if (h < 17) return {fill: "", dark: false, name: "day"};
    if (h < 19) return {fill: L.dusk, dark: false, name: "dusk"};
    return {fill: L.evening, dark: false, name: "evening"};
  }
  /** The tint and the moving things for scene `id` (an SVG fragment, drawn over the picture, under the places). */
  function lifeSVG(id) {
    const L = SCENE_LIFE[id];
    if (!L) return "";
    const ph = L.indoor ? {fill: "", dark: false} : dayPhase();
    let seed = [...id].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) | 0, 11);
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const out = [];
    if (ph.fill) out.push(`<rect class="pp-tint" width="${WORLD_W}" height="${WORLD_H}" fill="${ph.fill}" style="mix-blend-mode:multiply"/>`);
    (L.water || []).forEach(([x, y]) => { for (let i = 0; i < 3; i++) {
      const dx = Math.round((rnd() - 0.5) * 90), dy = Math.round((rnd() - 0.5) * 30);
      out.push(`<ellipse class="pp-glint" cx="${x + dx}" cy="${y + dy}" rx="${10 + Math.round(rnd() * 10)}" ry="3" style="animation-delay:-${(rnd() * 4).toFixed(1)}s"/>`); } });
    (L.smoke || []).forEach(([x, y]) => { for (let i = 0; i < 4; i++)
      out.push(`<circle class="pp-smoke" cx="${x}" cy="${y}" r="14" style="animation-delay:-${(i * 1.6 + rnd()).toFixed(1)}s"/>`); });
    (L.fire || []).forEach(([x, y, r]) => out.push(`<circle class="pp-fire" cx="${x}" cy="${y}" r="${r * (ph.dark ? 1.5 : 1)}" style="animation-delay:-${(rnd() * 2).toFixed(1)}s"/>`));
    (L.glow || []).forEach(([x, y, r, col]) => out.push(`<circle class="pp-glow" cx="${x}" cy="${y}" r="${r * (ph.dark ? 1.4 : 1)}" fill="${col}" style="animation-delay:-${(rnd() * 3).toFixed(1)}s"/>`));
    for (let i = 0; i < (L.birds || 0) && !ph.dark; i++) {
      const y = 60 + Math.round(rnd() * 240), dur = 40 + Math.round(rnd() * 30);
      out.push(`<g class="pp-bird" style="animation-duration:${dur}s;animation-delay:-${Math.round(rnd() * dur)}s"><g transform="translate(0 ${y})">
        <path class="pp-wings" d="M-14 0 q7 -9 14 0 q7 -9 14 0" style="animation-delay:-${(rnd()).toFixed(2)}s"/></g></g>`);
    }
    if (L.flies && (ph.dark || L.dark)) for (let i = 0; i < L.flies; i++)
      out.push(`<circle class="pp-firefly" cx="${Math.round(100 + rnd() * 1800)}" cy="${Math.round(300 + rnd() * 760)}" r="5" style="animation-delay:-${(rnd() * 6).toFixed(1)}s;animation-duration:${(5 + rnd() * 4).toFixed(1)}s"/>`);
    return `<g class="pp-life" aria-hidden="true">${out.join("")}</g>`;
  }
  /** A painted scene: the picture, a click area on each place (its scroll and the thing it names), fog on what's
   *  locked and a badge for what's going on. places: [{key, name, lock, here, ready, note}] -- keys not painted
   *  are left to the cards under the picture. */
  function paintedHTML(id, places, pic) {
    const art = SCENE_ART[id], cells = [], badges = [];
    places.forEach((p) => {
      [p.key, p.key + "#2"].filter((k) => art[k]).forEach((k) => {
        const a = art[k], [cx, cy, w, h = 56] = a.at, o = a.o;
        const tip = `${p.name}${p.lock ? " -- " + p.lock : ""}`;
        cells.push(`<g class="pp-spot${p.lock ? " locked" : ""}${p.here ? " here" : ""}${p.ready ? " ready" : ""}" data-key="${esc(p.key)}" tabindex="0" role="button" aria-label="${esc(tip)}">
          <title>${esc(tip)}</title>
          ${o ? `<ellipse class="pp-spot-thing" cx="${o[0]}" cy="${o[1]}" rx="110" ry="80"/>` : ""}
          <rect class="pp-spot-label" x="${cx - w / 2 - 8}" y="${cy - h / 2 - 6}" width="${w + 16}" height="${h + 12}" rx="14"/>
          ${a.chip ? `<g class="pp-map-chip find"><rect x="${cx - w / 2}" y="${cy - 24}" width="${w}" height="48" rx="12"/><text x="${cx}" y="${cy + 9}">${esc(a.chip)}</text></g>` : ""}
        </g>`);
        if (k !== p.key) return;
        const top = cy + h / 2 + 44 > WORLD_H ? cy - h / 2 - 40 : cy + h / 2 + 4;     // near the bottom edge: above the scroll
        const chip = (text, cls) => { const cw = 28 + 14 * [...text].length;
          badges.push(`<g class="pp-map-chip ${cls}"><rect x="${cx - cw / 2}" y="${top}" width="${cw}" height="36" rx="18"/><text x="${cx}" y="${top + 26}">${esc(text)}</text></g>`); };
        if (p.lock) chip("🔒 " + (p.lockShort || p.lock), "lock");
        else if (p.here) chip(p.hereText || "You're here", "busy");
        else if (p.note) chip(p.note, "");
        if (p.ready) badges.push(`<g class="pp-quest-mark"><circle cx="${cx + w / 2 + 6}" cy="${cy - h / 2 - 2}" r="22"/><text x="${cx + w / 2 + 6}" y="${cy - h / 2 + 8}">!</text></g>`);
      });
    });
    return `<div class="pp-world pp-painted">
      <svg class="pp-world-map" viewBox="0 0 ${WORLD_W} ${WORLD_H}" role="img" aria-label="${esc(id)}">
        <image href="art/${pic || id}.webp" x="0" y="0" width="${WORLD_W}" height="${WORLD_H}"/>
        ${lifeSVG(id)}${cells.join("")}<g class="pp-map-badges">${badges.join("")}</g>
      </svg></div>`;
  }
  /** Click / Enter on a painted place calls go(key). */
  function wirePainted(host, go) {
    host.querySelectorAll(".pp-spot").forEach((el) => {
      el.addEventListener("click", () => go(el.dataset.key));
      el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(el.dataset.key); } });
    });
  }
  function regionIcon(r, size) {
    // a region's own animal: the painted pet that hides there (2026-10-11, Cam: "why are these still pixel art?" -- the old
    // ids were pixel-only drawings, not creatures, so they had no painting)
    const ownPet = {deepjungle: ["snake", "emerald"], crystalcaves: ["spider", "crystal"], mistyisle: ["crab", "coral"], frostpeak: ["ram", "frost"]};
    if (r.hub) return itemIcon("obj_village", size);
    if (ownPet[r.id]) return petURL(ownPet[r.id][0], ownPet[r.id][1], size, "ok");
    if (r.id === "magetower") return monsterURL("archmagemage", size);
    return r.boss ? monsterURL(r.boss, size) : itemIcon("obj_map", size);
  }
  // the badges under/around a region's painted scroll: lock or secrets found, a quest waiting, who's out there
  function worldBadges(r, art) {
    const [x1, x2, y] = art.label, mid = (x1 + x2) / 2;
    const chip = (text, cls, cx, cy) => { const w = 24 + 15 * [...text].length;
      return `<g class="pp-map-chip ${cls}"><rect x="${cx - w / 2}" y="${cy - 19}" width="${w}" height="38" rx="19"/><text x="${cx}" y="${cy + 9}">${esc(text)}</text></g>`; };
    const busy = r.busy.map((k) => ({gather: "⛏", hunt: "⚔", explore: "🧭", pet: "🐾"})[k] || "").join("");
    return (r.hub || (r.open && !r.total) ? "" : r.open ? chip(`${r.found}/${r.total} secrets`, "", mid, y + 58) : chip("🔒 Locked", "lock", mid, y + 58))
      + (busy ? chip(busy, "busy", x1 + 10, y - 46) : "")
      + (r.questReady ? `<g class="pp-quest-mark"><circle cx="${x2 + 8}" cy="${y - 30}" r="22"/><text x="${x2 + 8}" y="${y - 20}">!</text></g>` : "");
  }
  // ---- the Shipyard (2026-10-08): your ship, the next one in four parts, setting sail -- and Shipwright Hal ------------
  /** Clocks on a page ([data-ends] = when, in ms): they count down, and the page redraws when one runs out. */
  function tickClocks(host, pageKey) {
    everySecond("ship");
    if (!host.querySelector("[data-ends]")) return;
    everySecond("ship", () => {
      if (!host.isConnected || page() !== pageKey) return false;
      let done = false;
      host.querySelectorAll("[data-ends]").forEach((el) => { const left = Math.ceil((+el.dataset.ends - Date.now()) / 1000); if (left <= 0) done = true; el.textContent = clock(Math.max(0, left)); });
      if (done) { render(); return false; }
    });
  }
  const SHIP_ICON = ["obj_map", "boat", "plank", "hardplank", "fineplank"];
  function renderShipyard(host) {
    const {s, now} = current(), sy = Core.shipyardView(s, now);
    const ends = (secs) => `<b data-ends="${now + secs * 1000}">${clock(secs)}</b>`;
    const away = sy.island || sy.voyage;
    host.innerHTML = `
      <div class="pp-page">
        <p class="pp-status" id="pp-status">${esc(status)}</p>
        ${paintedHTML("shipyard", [{key: "ship", name: "Your ship", note: sy.name}, {key: "slipway", name: "The slipway", note: sy.building ? "Building" : sy.next ? "Next: " + sy.next.name : ""},
            {key: "person", name: "Shipwright Hal", ready: !!(sy.person && sy.person.quest && sy.person.quest.can)}, {key: "sail", name: "Set sail", lock: sy.tier >= 1 ? "" : "no ship yet", lockShort: "No ship"}])}
        ${away ? `<section class="pp-shop"><p>${sy.voyage ? `At sea — ${ends(sy.voyage.endsIn)} to go.` : "The Shipyard is back home on the Coast — sail home first."}</p></section>` : ""}
        <section class="pp-shop pp-ship">
          <div class="pp-skill-head"><b>Your ship: ${esc(sy.name)}</b><span class="pp-tier-dots" title="Tier ${sy.tier} of 4">${[1, 2, 3, 4].map((i) => `<span class="pp-tier-dot${i <= sy.tier ? " on" : ""}"></span>`).join("")}</span></div>
          <p class="stamp">${["Old Salt on the Coast will help you build your first boat -- then the Shipyard is yours.", "A rowboat: the Misty Isle and the coast's waters.",
            "A sailboat: your pets can go on ocean expeditions.", "A caravel: the Desert Island and Frostpeak Island are in reach.", "A galleon: the finest ship on the isle."][sy.tier]}</p>
          ${sy.building ? `<p>Building the ${esc(sy.building.part.toLowerCase())} — ${ends(sy.building.endsIn)} left.</p>` : ""}
        </section>
        ${sy.tier >= 1 && sy.next ? `<section class="pp-shop pp-ship-next">
          <b>Next: a ${esc(sy.next.name.toLowerCase())}</b> <span class="stamp">· four parts, one at a time · needs Construction ${sy.next.con}${sy.next.conOk ? " ✓" : ""}</span>
          <div class="pp-areas">${sy.next.parts.map((p) => `<div class="pp-area">
            <div class="pp-skill-head"><b>${esc(p.name)}</b><span class="pp-level">${p.done ? "✓ Done" : p.building ? "Building" : `${p.hours} h · +${p.xp} xp`}</span></div>
            ${p.done ? "" : `<div class="pp-needs"><span class="pp-need-chip${(s.coins || 0) >= p.coins ? "" : " lack"}">${coinTxt(p.coins)}</span>${p.items.map((i) =>
              `<span class="pp-need-chip${i.have >= i.need ? "" : " lack"}" data-iteminfo="${i.id}"><img alt="" src="${itemIcon(i.id, 16)}">${i.have}/${i.need}</span>`).join("")}</div>
              ${p.building ? "" : `<button class="btn btn-sm ${p.can ? "btn-primary" : ""}" data-part="${p.id}" ${p.can && !away ? "" : "disabled"}>Build</button>`}`}
          </div>`).join("")}</div>
        </section>` : ""}
        ${sy.tier >= 1 ? `<section class="pp-shop pp-ship-sail">
          <b>Set sail</b> <span class="stamp">· ${sy.mins} minutes by ${sy.tier >= 3 ? esc(sy.name.toLowerCase()) : "caravel"} -- you stay until you sail home from the island's dock</span>
          ${provisionHTML(sy.provisions)}
          <div class="pp-place-btns">${sy.islands.map((i) => `<button class="btn ${i.can ? "btn-primary" : ""}" data-sail="${i.id}" ${i.can && !away ? "" : "disabled"}
              title="${i.can ? "" : `Needs a ${esc(i.ship.toLowerCase())}`}">Sail to ${esc(i.name)}${i.can ? "" : ` (${esc(i.ship.toLowerCase())})`}</button>`).join("")}</div>
        </section>` : ""}
        ${sy.person ? personHTML(sy.person, !away) : ""}
      </div>`;
    const doIt = async (a, o) => { const r = await act(a, o); if (r && r.error) { status = r.error; toast(r.error, true); render(); } };
    host.querySelectorAll("[data-part]").forEach((b) => b.addEventListener("click", () => doIt("shipbuild", {part: b.dataset.part})));
    host.querySelectorAll("[data-sail]").forEach((b) => b.addEventListener("click", () => doIt("sail", {to: b.dataset.sail, provisions: provOn()})));
    wireProvisions(host);
    const qb = host.querySelector("#pp-quest"); if (qb) qb.addEventListener("click", () => doIt("quest", {region: "shipyard"}));
    wirePainted(host, (k) => {
      const el = k === "ship" ? host.querySelector(".pp-ship") : k === "slipway" ? host.querySelector(".pp-ship-next") : k === "sail" ? host.querySelector(".pp-ship-sail")
        : host.querySelector(".pp-person, #pp-quest");
      if (el) { el.scrollIntoView({block: "center", behavior: "smooth"}); el.classList.add("pp-flash"); setTimeout(() => el.classList.remove("pp-flash"), 1200); }
      else if (k === "slipway") toast(sy.tier ? "That's the finest ship there is." : "Old Salt on the Coast will help you build your first boat.");
    });
    tickClocks(host, "pet:shipyard");
  }
  // ---- the Pyramid (2026-10-09): one run a day, chamber by chamber -- traps, glyph riddles, guardians -- then the
  //      treasure, different every time; after dark the sixth chamber, the Pharaoh's sarcophagus ---------------------------
  function renderPyramid(host) {
    const {s, now} = current(), v = Core.pyramidView(s, now), c = v.current;
    const roman = ["I", "II", "III", "IV", "V", "VI"], icon = {trap: "⚠", riddle: "𓂀", guardian: "⚔"};
    const pct = (x) => Math.round(x * 100) + "%";
    host.innerHTML = `
      <div class="pp-page">
        <p class="pp-status" id="pp-status">${esc(status)}</p>
        ${paintedHTML("pyramid", v.chambers.map((x, i) => ({key: "ch:" + i, name: x.night ? "The sarcophagus" : "Chamber " + roman[i],
            here: i === v.at && !!c && !v.out, hereText: "◀ You're here", note: x.done ? "✓" : "", lock: !x.done && !(i === v.at && c) ? (x.night && !v.night ? "after dark" : "ahead") : "",
            lockShort: x.night && !v.night ? "After dark" : "Ahead"})))}
        <section class="pp-shop">
          <div class="pp-skill-head"><b>The Pyramid</b><span class="pp-level">♥ ${v.hp}/${v.maxHp}</span></div>
          
          <div class="pp-pyr-track">${v.chambers.map((x, i) => `<span class="pp-pyr-room${x.done ? " done" : ""}${i === v.at && c ? " here" : ""}${x.night ? " night" : ""}"
              title="${x.night ? "The sarcophagus (after dark)" : "Chamber " + roman[i]}">${x.done ? "✓" : x.night ? "☾" : roman[i]}</span>`).join("")}</div>
        </section>
        ${v.lock ? `<section class="pp-shop"><p>🔒 ${esc(v.lock)}</p></section>`
          : v.fighting ? `<section class="pp-shop"><p>The fight is on — eat, fire your special or run, round by round.</p><button class="btn btn-primary" data-jump="pet:hunt">To the fight</button></section>`
          : v.out ? `<section class="pp-shop"><p>The Pyramid threw you out today — its doors open again tomorrow.</p></section>`
          : !c ? `<section class="pp-shop"><p>${v.sarcophagus ? "Every chamber cleared — even the Pharaoh's. Come back tomorrow." : `All five chambers cleared today.${v.night ? "" : " The sarcophagus opens after dark (9 pm)."}`}</p></section>`
          : `<section class="pp-shop pp-pyr-room-card">
              <div class="pp-skill-head"><b>${icon[c.kind]} ${c.kind === "guardian" ? esc(c.name) : esc(c.name)}</b><span class="stamp">Chamber ${roman[v.at]}</span></div>
              ${c.kind === "trap" ? `<p>${esc(c.text)}</p><div class="pp-areas">${c.ways.map((w) => `<div class="pp-area">
                  <div class="pp-skill-head"><b>${esc(w.how)}</b><span class="pp-level">${pct(w.chance)}</span></div>
                  <div class="stamp">${esc(w.skillName)} ${w.level} (wants ${w.req})</div>
                  <button class="btn btn-sm btn-primary" data-pyr-way="${w.i}">Try it</button></div>`).join("")}</div>`
                : c.kind === "riddle" ? `<p class="pp-pyr-riddle">“${esc(c.text)}”</p><p class="stamp">Touch the glyph that answers it.</p>
                  <div class="pp-place-btns">${c.choices.map((g) => `<button class="btn" data-pyr-glyph="${g.id}"><img alt="" src="${itemIcon(g.id, 24)}"> ${esc(g.name.replace(/ glyph$/, ""))}</button>`).join("")}</div>`
                : `<div class="pp-pyr-foe"><img alt="" src="${monsterURL(c.mon, 96)}"><div><b>${esc(c.monName)}</b>${c.boss ? ' <span class="pp-level">Boss</span>' : ""}
                    <div class="stamp">Health ${c.hp} · attack ${c.att} · defence ${c.def}</div>
                    <button class="btn btn-primary" id="pp-pyr-fight">Fight</button>${c.boss ? ` <span class="stamp">a live battle — eat, specials, run</span>` : ""}</div></div>`}
            </section>`}
        ${v.crypt && !v.out ? `<section class="pp-shop pp-pyr-crypt"><div class="pp-skill-head"><b>👁 Keen Eye: a sealed crypt</b><span class="stamp">Chamber ${roman[v.crypt.chamber]}</span></div>
            <p>${v.crypt.done === "opened" ? "You've emptied it today." : v.crypt.done === "sealed" ? "It bit back -- sealed for today." : "Behind a loose stone, a lock nobody else would see."}</p>
            ${v.crypt.done ? "" : `<div class="stamp">Larceny ${v.crypt.level} (wants ${v.crypt.req}) · ${pct(v.crypt.chance)}</div>
              <button class="btn btn-sm btn-primary" data-pyr-crypt ${v.crypt.level < v.crypt.req ? "disabled" : ""}>Pick the lock</button>`}</section>` : ""}
        ${v.loot ? `<section class="pp-shop"><b>Today's treasure</b><div class="pp-needs">
            <span class="pp-need-chip">${coinTxt(v.loot.coins)}</span>${Object.keys(v.loot.items).map((k) => `<span class="pp-need-chip" data-iteminfo="${k}"><img alt="" src="${itemIcon(k, 16)}">${v.loot.items[k]}</span>`).join("")}</div></section>` : ""}
        ${v.log.length ? `<section class="pp-shop"><b>Today</b>${v.log.map((t) => `<div class="stamp">· ${esc(t)}</div>`).join("")}</section>` : ""}
        <section class="pp-shop"><b>The Pharaoh's set</b> <span class="stamp">· five pieces, found in the treasure (more often in the Pharaoh's) — all five worn: +10% xp, +6 defence, +6 magic, surer hits</span>
          <div class="pp-needs">${v.set.map((x) => `<span class="pp-need-chip${x.have ? "" : " lack"}" data-iteminfo="${x.id}"><img alt="" src="${itemIcon(x.id, 16)}">${esc(x.name.replace("Pharaoh's ", ""))}</span>`).join("")}</div></section>
      </div>`;
    const go = async (o) => { const r = await act("pyramid", Object.assign({roll: Math.random(), manual: c && c.boss && bossMode && bossMode() === "manual"}, o));
      if (r && r.error) { status = r.error; toast(r.error, true); render(); } else if (r && r.msg) { toast(r.msg); if (c && c.boss) goTo("pet:hunt"); } };
    host.querySelectorAll("[data-jump]").forEach((b) => b.addEventListener("click", () => goTo(b.dataset.jump)));
    host.querySelectorAll("[data-pyr-way]").forEach((b) => b.addEventListener("click", () => go({way: +b.dataset.pyrWay})));
    host.querySelectorAll("[data-pyr-glyph]").forEach((b) => b.addEventListener("click", () => go({glyph: b.dataset.pyrGlyph})));
    const f = host.querySelector("#pp-pyr-fight"); if (f) f.addEventListener("click", () => go({}));
    host.querySelectorAll("[data-pyr-crypt]").forEach((b) => b.addEventListener("click", async () => {   // (its own: never off to a boss fight)
      const r = await act("pyramid", {op: "crypt", roll: Math.random()}); if (r && r.error) { status = r.error; toast(r.error, true); render(); } else if (r && r.msg) toast(r.msg); }));
    wirePainted(host, (k) => {
      const i = +k.slice(3), card = host.querySelector(".pp-pyr-room-card");
      if (i === v.at && card) { card.scrollIntoView({block: "center", behavior: "smooth"}); card.classList.add("pp-flash"); setTimeout(() => card.classList.remove("pp-flash"), 1200); }
      else toast(i < v.at ? "Cleared today." : v.chambers[i] && v.chambers[i].night && !v.night ? "The sarcophagus opens after dark (9 pm)." : "Clear the chambers before it first.");
    });
  }
  // ---- an island estate (2026-10-08, islands stage 4): buy the plot, build its six parts, use its benches and chests ----
  function renderIslandEstate(host) {
    const {s, now} = current(), ev = Core.estateView(s, now);
    if (!ev) { host.innerHTML = `<div class="pp-page"><section class="pp-shop"><p>Your island estates are on the islands -- sail to one (the Shipyard on the Coast).</p></section></div>`; return; }
    const dots = (t) => [1, 2, 3, 4].map((i) => `<span class="pp-tier-dot${i <= t ? " on" : ""}"></span>`).join("");
    const estPlaces = ev.parts.map((p) => ({key: "part:" + p.id, name: p.name, note: p.tier ? p.tierName : ev.bought ? "Not built" : ""}))
      .concat([{key: "town", name: "To " + ev.town}], ev.bought ? [] : [{key: "forsale", name: "For sale", note: coinTxt(ev.price).replace("🪙 ", "") + " coins"}]);
    host.innerHTML = `
      <div class="pp-page">
        <p class="pp-status" id="pp-status">${esc(status)}</p>
        ${paintedHTML("islandestate", estPlaces, `estate-${ev.isle}-${ev.stagePic}`)}
        <section class="pp-shop pp-estate-head">
          <div class="pp-skill-head"><b>Your ${esc(ev.name)} estate</b><span class="pp-level">${esc(ev.stageName)}</span></div>
          ${ev.bought ? `
              <div class="pp-place-btns">
                ${ev.store ? `<button class="btn" id="pp-est-store">Open the bank (${ev.store.used}/${ev.store.cap})</button>` : ""}
                ${ev.gardenIn >= 0 ? (ev.gardenIn ? `<button class="btn" disabled>Garden: <span data-ends="${now + ev.gardenIn * 1000}">${clock(ev.gardenIn)}</span></button>` : `<button class="btn btn-primary" id="pp-est-garden">Pick the garden</button>`) : ""}
                ${ev.benches.map((w) => `<button class="btn" data-bench="${w}">${esc(Core.WORKSHOPS[w].name)}</button>`).join("")}
              </div>`
            : `<p>A plot by ${esc(ev.town)}, for sale: <b>${coinTxt(ev.price)}</b>.</p>
               
               <button class="btn btn-primary" id="pp-est-buy" ${ev.coins >= ev.price ? "" : "disabled"}>Buy the plot</button>`}
        </section>
        ${ev.bought ? `<div class="pp-areas">${ev.parts.map((p) => `<div class="pp-area" id="pp-part-${p.id}">
          <div class="pp-skill-head"><b>${esc(p.name)}</b><span class="pp-tier-dots" title="${esc(p.tierName)}">${dots(p.tier)}</span></div>
          <div class="stamp">${p.tier ? esc(p.perk) : "Not built yet."}</div>
          ${p.next ? `<div class="stamp">Next, ${esc(p.next.tierName.toLowerCase())}: ${esc(p.next.perk)}</div>
            <div class="pp-needs"><span class="pp-need-chip${p.next.conOk ? "" : " lack"}">Construction ${p.next.con}</span><span class="pp-need-chip${ev.coins >= p.next.coins ? "" : " lack"}">${coinTxt(p.next.coins)}</span>
              ${p.next.items.map((i) => `<span class="pp-need-chip${i.have >= i.need ? "" : " lack"}" data-iteminfo="${i.id}"><img alt="" src="${itemIcon(i.id, 16)}">${i.have}/${i.need}</span>`).join("")}</div>
            <button class="btn btn-sm ${p.next.can ? "btn-primary" : ""}" data-estpart="${p.id}" ${p.next.can ? "" : "disabled"}>${p.tier ? "Build up" : "Build"} (+${p.next.xp} xp)</button>`
            : `<div class="stamp">As grand as it gets.</div>`}
        </div>`).join("")}</div>` : ""}
      </div>`;
    const doIt = async (a, o) => { const r = await act(a, o || {}); if (r && r.error) { status = r.error; toast(r.error, true); render(); } };
    const b = host.querySelector("#pp-est-buy"); if (b) b.addEventListener("click", () => doIt("estatebuy"));
    wirePainted(host, (k) => {                                         // the picture: a part's card, the plot's price, back to town
      if (k === "town") { worldRegion = ev.townId; return goTo("pet:world"); }
      const el = k === "forsale" ? host.querySelector(".pp-estate-head") : host.querySelector("#pp-" + k.replace(":", "-"));
      if (el) { el.scrollIntoView({block: "center", behavior: "smooth"}); el.classList.add("pp-flash"); setTimeout(() => el.classList.remove("pp-flash"), 1200); }
      else toast(ev.bought ? "" : "Buy the plot first -- then build it up, part by part.");
    });
    const g = host.querySelector("#pp-est-garden"); if (g) g.addEventListener("click", () => doIt("estategarden"));
    const st = host.querySelector("#pp-est-store"); if (st) st.addEventListener("click", () => showStore());
    host.querySelectorAll("[data-estpart]").forEach((x) => x.addEventListener("click", () => doIt("estatebuild", {part: x.dataset.estpart})));
    host.querySelectorAll("[data-bench]").forEach((x) => x.addEventListener("click", () => { openShop = x.dataset.bench; showShop(); }));
    if (openShop) showShop();
    if (document.querySelector(".pp-store-modal")) showStore();
    tickClocks(host, "pet:islandestate");
  }
  // The islands' painted maps (2026-10-09, Cam's pictures): each place's outline and its scroll [left, right, y], as on the main
  // island's map. A key with a colon is a page (the Pyramid), not a region.
  const ISLE_ART = {
    desert: {pic: "isle-desert", places: {
      desert: {pts: "150,520 400,470 700,330 950,330 1050,480 1000,900 800,1000 400,1000 200,900", label: [639, 898, 647]},
      oasis: {pts: "190,200 300,120 560,110 670,200 670,420 560,470 300,460 190,380", label: [300, 522, 78]},
      nile: {pts: "1000,180 1150,150 1300,250 1420,450 1420,650 1300,800 1200,1000 1000,1000 1000,600", label: [1109, 1333, 300]},
      "pet:pyramid": {pts: "1444,111 1844,111 1844,444 1444,444", label: [1509, 1794, 74], name: "The Pyramid"},
      sandport: {pts: "1255,633 1922,633 1922,1022 1255,1022", label: [1300, 1552, 1041]}}},
    frostpeak: {pic: "isle-frostpeak", places: {
      frostpeak: {pts: "220,600 400,440 650,360 900,380 1100,500 1150,650 1000,800 700,900 450,880 380,750", label: [606, 976, 624]},
      frosthaven: {pts: "790,820 1000,740 1370,760 1370,960 1100,1060 800,1000", label: [847, 1156, 1039]},
      summit: {pts: "1000,420 1100,180 1200,160 1360,300 1300,420", label: [1006, 1358, 330]},
      icecavern: {pts: "1222,367 1500,370 1722,550 1650,711 1300,711 1222,550", label: [1267, 1541, 509]}}}};
  function isleMapHTML(isle, regs) {
    const IA = ISLE_ART[isle], at = {};
    if (!IA || modPics.regions[IA.pic] === false) return "";
    regs.forEach((r) => { at[r.id] = r; });
    const keys = Object.keys(IA.places).filter((k) => k.includes(":") || at[k]);
    const view = (k) => at[k] || {id: k, name: IA.places[k].name, open: true, hub: true, busy: []};
    return `<div class="pp-world">
      <svg class="pp-world-map" viewBox="0 0 ${WORLD_W} ${WORLD_H}" role="img" aria-label="The island's map">
        <defs><filter id="pp-soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="14"/></filter></defs>
        <image href="${modPics.regions[IA.pic] || "art/" + IA.pic + ".webp"}" x="0" y="0" width="${WORLD_W}" height="${WORLD_H}"/>
        ${lifeSVG(IA.pic)}
        ${keys.map((k) => { const r = view(k), a = IA.places[k];
          return `<g class="pp-region${r.open ? "" : " locked"}" data-isle-go="${esc(k)}" tabindex="0" role="button" aria-label="${esc(r.name)}${r.open ? "" : " (locked)"}">
            <title>${esc(r.name)}${r.open ? "" : " -- " + esc(r.lock || "locked")}</title>
            <polygon class="pp-region-area" points="${a.pts}" filter="url(#pp-soft)"/><polygon class="pp-region-hit" points="${a.pts}"/></g>`; }).join("")}
        <g class="pp-map-badges">${keys.map((k) => worldBadges(view(k), IA.places[k])).join("")}</g>
      </svg></div>`;
  }
  /** Away from the main island (or at sea): the Map is the island you're on. */
  function renderIsland(host, wv) {
    const {now} = current();
    const regs = wv.regions.filter((r) => r.isle === wv.here).sort((a, b) => (b.town ? 1 : 0) - (a.town ? 1 : 0));
    host.innerHTML = `
      <div class="pp-page">
        <p class="pp-status" id="pp-status">${esc(status)}</p>
        ${wv.voyage ? `<section class="pp-shop pp-voyage"><b>At sea</b> <span class="stamp">bound for ${esc(wv.voyage.toName)}</span>
            <p>Land in <b data-ends="${now + wv.voyage.endsIn * 1000}">${clock(wv.voyage.endsIn)}</b>.</p></section>`
          : `<section class="pp-shop pp-voyage"><b>${esc(wv.hereName)}</b> <span class="stamp">You're staying here -- the main island's places, your benches and the shops wait at home.</span>
            ${provisionHTML(Core.shipyardView(current().s, now).provisions)}<div class="pp-place-btns"><button class="btn" id="pp-sail-home">Sail home</button></div></section>`}
        ${wv.voyage ? "" : isleMapHTML(wv.here, regs)}
        ${wv.voyage ? "" : `<div class="pp-world-list">${regs.map((r) => `
          <button class="pp-world-row${r.open ? "" : " locked"}" data-region="${r.id}">
            <img alt="" src="${regionIcon(r, 32)}">
            <span><b>${esc(r.name)}</b> <span class="stamp">${r.town ? "The town and its dock" : r.open ? `level ${r.level}+ · ${r.found}/${r.total} secrets found` : esc(r.lock)}</span>

              ${r.person ? `<span class="stamp pp-world-blurb">${r.questReady ? "❗ " : ""}${esc(r.person)}${r.questsLeft ? ` · ${r.questsLeft} quest${r.questsLeft === 1 ? "" : "s"} left` : " · all quests done"}</span>` : ""}</span>
          </button>`).join("")}</div>`}
      </div>`;
    host.querySelectorAll("[data-region]").forEach((el) => el.addEventListener("click", () => { worldRegion = el.dataset.region; status = ""; render(); }));
    const isleGo = (k) => { if (k.includes(":")) return goTo(k); worldRegion = k; status = ""; render(); };
    host.querySelectorAll("[data-isle-go]").forEach((el) => {
      el.addEventListener("click", () => isleGo(el.dataset.isleGo));
      el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); isleGo(el.dataset.isleGo); } });
    });
    wireSeaButton(host);
    wireProvisions(host);
    const sh = host.querySelector("#pp-sail-home");
    if (sh) sh.addEventListener("click", async () => { const r = await act("sail", {to: "home", provisions: provOn()}); if (r && r.error) { status = r.error; toast(r.error, true); render(); } });
    tickClocks(host, "pet:world");
  }
  // ---- the sea chart (2026-10-09, Cam's picture) -------------------------------------------------------------------
  let seaChart = false;
  function wireSeaButton(host) {
    host.querySelectorAll("[data-sea]").forEach((b) => b.addEventListener("click", () => { seaChart = b.dataset.sea === "1"; closeSeaSheet(); status = ""; render(); }));
  }
  function renderSea(host, wv) {
    const {s, now} = current(), sy = Core.shipyardView(s, now), at = {};
    wv.regions.forEach((r) => { at[r.id] = r; });
    const where = wv.voyage ? "" : wv.here || "main";
    const chip = (text, cls, cx, cy) => { const w = 24 + 15 * [...text].length;
      return `<g class="pp-map-chip ${cls}"><rect x="${cx - w / 2}" y="${cy - 19}" width="${w}" height="38" rx="19"/><text x="${cx}" y="${cy + 9}">${esc(text)}</text></g>`; };
    const isle = (id) => sy.islands.find((i) => i.id === id);
    const reg = (id) => !isle(id) && at[id];            // the Open Sea and the Misty Isle are regions; an island (frostpeak too) is a voyage
    const locked = (id) => reg(id) ? !reg(id).open : isle(id) ? !isle(id).can : false;
    const badges = (id) => { const a = SEA_ART[id], [x1, x2, y] = a.label, mid = (x1 + x2) / 2, below = y + 50;
      if (reg(id)) return worldBadges(reg(id), a);
      const bound = wv.voyage && (wv.voyage.to || "main") === id;
      const txt = where === id ? "You're here" : bound ? `Landing in ${clock(wv.voyage.endsIn)}` : isle(id) && !isle(id).can ? `🔒 Needs a ${isle(id).ship.toLowerCase()}` : "";
      return (a.chip ? chip(a.chip, "", mid, y) : "") + (txt ? chip(txt, where === id || bound ? "busy" : "lock", mid, a.chip ? y + 46 : below) : ""); };
    host.innerHTML = `
      <div class="pp-page">
        <p class="pp-status" id="pp-status">${esc(status)}</p>
        ${wv.voyage ? `<p class="pp-world-now">At sea, bound for <b>${esc(wv.voyage.toName)}</b> — land in <b data-ends="${now + wv.voyage.endsIn * 1000}">${clock(wv.voyage.endsIn)}</b></p>` : ""}
        <div class="pp-world">
          <svg class="pp-world-map" viewBox="0 0 ${WORLD_W} ${WORLD_H}" role="img" aria-label="The sea chart">
            <defs><filter id="pp-soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="14"/></filter></defs>
            <image href="${modPics.regions.seachart || "art/seachart.webp"}" x="0" y="0" width="${WORLD_W}" height="${WORLD_H}" preserveAspectRatio="xMidYMid slice"/>
            ${lifeSVG("seachart")}
            ${Object.keys(SEA_ART).map((id) => { const name = reg(id) ? reg(id).name : id === "main" ? "The Main Island" : id === "shipyard" ? "The Shipyard" : isle(id).name;
              return `<g class="pp-region${locked(id) ? " locked" : ""}" data-sea-go="${id}" tabindex="0" role="button" aria-label="${esc(name)}${locked(id) ? " (locked)" : ""}">
                <title>${esc(name)}</title>
                <polygon class="pp-region-area" points="${SEA_ART[id].pts}" filter="url(#pp-soft)"/>
                <polygon class="pp-region-hit" points="${SEA_ART[id].pts}"/>
              </g>`; }).join("")}
            <g class="pp-map-badges">${Object.keys(SEA_ART).map(badges).join("")}</g>
          </svg>
        </div>
      </div>`;
    const go = (id) => {
      if (id === "shipyard") return goTo("pet:shipyard");
      if (reg(id) && !onThisIsland(id)) return toast(wv.voyage ? "You're at sea -- land first." : "That's off the main island -- sail home first.", true);
      if (reg(id)) { seaChart = false; worldRegion = id; status = ""; return render(); }
      if (id === where) { seaChart = false; return render(); }
      showSeaSheet(id);
    };
    host.querySelectorAll("[data-sea-go]").forEach((el) => {
      el.addEventListener("click", () => go(el.dataset.seaGo));
      el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(el.dataset.seaGo); } });
    });
    wireSeaButton(host);
    tickClocks(host, "pet:world");
  }
  function closeSeaSheet() { const m = document.querySelector(".pp-modal.pp-sea-modal"); if (m) m.remove(); }
  /** An island on the sea chart (or the main island, from away): where it is, and Set sail. */
  function showSeaSheet(id) {
    closeSeaSheet();
    const {s, now} = current(), sy = Core.shipyardView(s, now), wv = Core.worldView(s, now);
    const home = id === "main", isle = sy.islands.find((i) => i.id === id);
    const name = home ? "The Main Island" : isle.name;
    const why = wv.voyage ? `You're at sea -- you land in ${clock(wv.voyage.endsIn)}.`
      : !home && !isle.can ? (sy.tier ? `It's too far for your ${sy.name.toLowerCase()} -- it takes a ${isle.ship.toLowerCase()}. Ships are built at the Shipyard on the Coast.`
                                       : "You need a ship first -- Old Salt on the Coast will help you build one.") : "";
    const box = document.createElement("div");
    box.className = "pp-modal pp-sea-modal";
    box.innerHTML = `<div class="pp-modal-card pp-shop-card pp-sec-card" role="dialog" aria-label="${esc(name)}">
      <button class="btn btn-quiet btn-sm pp-shop-x" aria-label="Close">✕</button>
      <section class="pp-shop"><b>${esc(name)}</b>
        
        ${why ? `<p>${esc(why)}</p>` : `<p>${sy.mins} minutes by ${esc(sy.name.toLowerCase())}${home ? ", to the Shipyard" : " -- you stay until you sail home from its dock"}.</p>`}
        <div class="pp-place-btns">
          ${why ? "" : `${sy.provisions ? provisionHTML(sy.provisions) : ""}<button class="btn btn-primary" id="pp-sea-sail">${home ? "Sail home" : `Set sail for ${esc(name)}`}</button>`}
          ${why && sy.tier && !wv.here && !wv.voyage ? `<button class="btn" id="pp-sea-yard">Go to the Shipyard</button>` : ""}
        </div></section></div>`;
    document.body.appendChild(box);
    box.addEventListener("click", (e) => { if (e.target === box) closeSeaSheet(); });
    box.querySelector(".pp-shop-x").addEventListener("click", closeSeaSheet);
    wireProvisions(box);
    const y = box.querySelector("#pp-sea-yard"); if (y) y.addEventListener("click", () => { closeSeaSheet(); goTo("pet:shipyard"); });
    const b = box.querySelector("#pp-sea-sail");
    if (b) b.addEventListener("click", async () => {
      closeSeaSheet();
      const r = await act("sail", {to: home ? "home" : id, provisions: provOn()});
      if (r && r.error) { status = r.error; toast(r.error, true); }
      render();
    });
  }
  /** A region you can open from where you are: one on the island you're on (Cam, 2026-10-09: "I should not be able to
   *  click any foreign location ... underneath the main island"). The Open Sea opens from the sea chart, at home. */
  function onThisIsland(id) {
    const r = Core.REGIONS[id], {s} = current(), here = Core.islandOf(s) || "";
    return !!r && (r.isle || "") === here && !(here && id === "opensea") && !(s.player && s.player.voyage);
  }
  // your estate on the main island's map (2026-10-13, Cam: "the estate on the main island to be located on the main map and
  // not hidden in the village (only for the main island not the desert or frostpeak)"): a drawn marker on the grass between
  // the Mage tower's path and the Village until it's painted in; the island estates stay in their own towns
  // your estate, painted on the map since Cam's new picture (2026-10-16): an outline over it, glowing like a region's
  const ESTATE_ART = {pts: "520,270 600,240 720,240 840,300 840,390 780,460 540,465 505,390"};
  function estateSpotSVG() {
    return `<g class="pp-region pp-estate-spot" data-region="estate" tabindex="0" role="button" aria-label="Your estate: house, workshop, library, store room, graveyard and the Farm">
      <title>Your estate</title>
      <polygon class="pp-region-area" points="${ESTATE_ART.pts}" filter="url(#pp-soft)"/>
      <polygon class="pp-region-hit" points="${ESTATE_ART.pts}"/>
    </g>`;
  }
  function renderWorld(host) {
    everySecond("world");
    if (worldRegion && !onThisIsland(worldRegion)) worldRegion = "";
    if (worldRegion && worldRegion !== "village") return renderLand(host, worldRegion);
    const {s, now} = current();
    const wv = Core.worldView(s, now), at = {};
    wv.regions.forEach((r) => { at[r.id] = r; });
    if (seaChart) return renderSea(host, wv);
    if (wv.here || wv.voyage) return renderIsland(host, wv);              // on an island, or at sea (2026-10-08)
    const drawn = Object.keys(WORLD_ART).filter((id) => at[id]);
    host.innerHTML = `
      <div class="pp-page">
        <p class="pp-status" id="pp-status">${esc(status)}</p>
        ${wv.exploring ? `<p class="pp-world-now">Exploring the <b>${esc(wv.exploring.name)}</b> — back in <span id="pp-explore-clock">${clock(wv.exploring.endsIn)}</span></p>` : ""}
        <div class="pp-world">
          <svg class="pp-world-map" viewBox="0 0 ${WORLD_W} ${WORLD_H}" role="img" aria-label="The world map">
            <defs><filter id="pp-soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="14"/></filter></defs>
            <image href="${modPics.regions.worldmap || "art/worldmap.webp"}" x="0" y="0" width="${WORLD_W}" height="${WORLD_H}" preserveAspectRatio="xMidYMid slice"/>
            ${lifeSVG("worldmap")}
            ${drawn.map((id) => { const r = at[id];
              return `<g class="pp-region${r.open ? "" : " locked"}${wv.exploring && wv.exploring.region === id ? " exploring" : ""}" data-region="${id}" tabindex="0" role="button" aria-label="${esc(r.name)}${r.open ? "" : " (locked)"}">
                <title>${esc(r.name)}${r.open ? "" : " -- " + esc(r.lock || "locked")}</title>
                <polygon class="pp-region-area" points="${WORLD_ART[id].pts}" filter="url(#pp-soft)"/>
                <polygon class="pp-region-hit" points="${WORLD_ART[id].pts}"/>
              </g>`; }).join("")}
            ${estateSpotSVG()}
            <g class="pp-map-badges">${drawn.map((id) => worldBadges(at[id], WORLD_ART[id])).join("")}</g>
          </svg>
        </div>
        <div class="pp-world-list"><button class="pp-world-row" data-region="estate">
            <img alt="" src="${itemIcon("obj_house", 32)}">
            <span><b>Your estate</b> <span class="stamp">home</span>
</span>
          </button>${wv.regions.filter((r) => !r.hub && !WORLD_SOON.includes(r.id)).map((r) => `
          <button class="pp-world-row${r.open ? "" : " locked"}" data-region="${r.id}">
            <img alt="" src="${regionIcon(r, 32)}">
            <span><b>${esc(r.name)}</b> <span class="stamp">${r.open ? `level ${r.level}+ · ${r.found}/${r.total} secrets found${r.explored ? ` · explored ${r.explored}×` : ""}` : esc(r.lock)}</span>

              ${r.person ? `<span class="stamp pp-world-blurb">${r.questReady ? "❗ " : ""}${esc(r.person)}${r.questsLeft ? ` · ${r.questsLeft} quest${r.questsLeft === 1 ? "" : "s"} left` : " · all quests done"}</span>` : ""}</span>
          </button>`).join("")}</div>
      </div>`;
    const go = (id) => { if (id === "village") return goTo("pet:village"); if (id === "estate") return goTo("pet:estate"); worldRegion = id; status = ""; render(); };
    wireSeaButton(host);
    host.querySelectorAll("[data-region]").forEach((el) => {
      el.addEventListener("click", () => go(el.dataset.region));
      el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(el.dataset.region); } });
    });
    exploreClock(host);
  }
  // what this trip has found so far, live (2026-10-10, Cam: "i would like a list of what i have gathered at the current
  // spot to be shown live updating as i gather ... i need to collect more earthworms before i can go to the river")
  function landTripHTML(lv, s, now) {
    const j = lv.job, pj = Core.playerView(s, now).job, bag = s.bag || {};
    const found = pj && !pj.hunt ? pj.items || {} : {};
    const ids = Object.keys(found).filter((k) => Core.ITEMS[k] && found[k] > 0).sort((a, b) => found[b] - found[a]);
    return `<span>${j.hunt ? "Hunting" : "Gathering"} at the <b>${esc(j.name || "")}</b> · ${j.count} ${j.hunt ? "fights" : "finds"} so far${pj && !pj.hunt ? ` · +${pj.xp} xp` : ""}${pj && pj.full ? ` · <b class="pp-trip-full">bag full: no more ${esc(pj.full.toLowerCase())} fits</b>` : ""}</span>
      ${j.hunt ? "" : `<div class="pp-finds pp-land-finds">${ids.length ? ids.map((k) => `<span class="pp-find" title="${esc(Core.ITEMS[k].name)}: ${found[k].toLocaleString()} this trip · ${(bag[k] || 0).toLocaleString()} in your bag">
          <img alt="" src="${itemIcon(k, 20)}">${esc(Core.ITEMS[k].name)} <b>${found[k].toLocaleString()}</b></span>`).join("") : `<span class="stamp">Nothing yet — the first find is on its way.</span>`}</div>`}`;
  }
  function landTripClock(host, id) {
    everySecond("land");
    everySecond("land", () => {
      const box = host.querySelector("#pp-land-trip");
      if (!host.isConnected || !box || page() !== "pet:world" || worldRegion !== id) return false;
      const c = current(), lv = Core.landView(c.s, id, c.now);
      if (!lv || !lv.job) { render(); return false; }     // the trip ended: draw the page again
      const html = landTripHTML(lv, c.s, c.now);
      if (box.dataset.html !== html) { box.innerHTML = html; box.dataset.html = html; }
    });
  }
  function exploreClock(host) {
    everySecond("world", () => {
      if (!host.isConnected || page() !== "pet:world") return false;
      const c = current(), w = Core.worldView(c.s, c.now);
      const el = host.querySelector("#pp-explore-clock");
      if (!w.exploring || w.exploring.endsIn <= 0) { if (el) render(); return false; }
      if (el) el.textContent = clock(w.exploring.endsIn);
    });
  }
  // someone who lives there, and what they'd like
  // ---- one place at a time (2026-10-08, Cam: "when i click on ... the dining table it shows everything else as
  //      well, i want it to just show the options at the dining table") -- a painted place opens this sheet with
  //      only its own options: a home section (sec:...), a room (room:...), the material archive, a region's person
  //      or its secrets. It's redrawn after every render, so what you do in it shows at once.
  let openSec = "", secLand = "";
  function closeSec() { openSec = ""; const m = document.querySelector(".pp-modal.pp-sec-modal"); if (m) m.remove(); }
  // ---- the recycle stash and the recycled materials store (2026-10-11), in the store room by the barrels ----
  const needChips = (list) => list.map((x) => `<span class="pp-need-chip" data-iteminfo="${x.id}" title="${esc(x.name)}"><img alt="" src="${itemIcon(x.id, 16)}">${x.n}</span>`).join("");
  function recycleBuildHTML(part, nx) {
    const {s} = current(), con = Core.recycleView(s, Date.now()).con;
    if (!nx) return `<p class="stamp pp-room-done">As grand as it gets.</p>`;
    return `<div class="pp-room-next">
      <div><b>Build ${esc(nx.name.toLowerCase())} ${part === "store" ? "materials store" : "recycle stash"}</b> <span class="stamp">· ${esc(nx.does)} · +${nx.xp} Construction xp</span></div>
      <div class="pp-needs">
        <span class="pp-need-chip${con >= nx.con ? "" : " lack"}">Construction ${con}/${nx.con}</span>
        <span class="pp-need-chip${(s.coins || 0) >= nx.coins ? "" : " lack"}">${coinTxt(nx.coins)}</span>
        ${nx.needs.map((n) => `<span class="pp-need-chip${n.have >= n.need ? "" : " lack"}" title="${esc(n.name)}" data-iteminfo="${n.id}"><img alt="" src="${itemIcon(n.id, 16)}">${n.have}/${n.need}</span>`).join("")}
      </div>
      <button class="btn btn-sm ${nx.can ? "btn-primary" : ""} pp-rc-build" data-part="${part}" ${nx.can ? "" : "disabled"}>Build</button>
    </div>`;
  }
  // (2026-10-20, Cam: "the recycle UI is the old list format and i dont like that it results in excess scrolling" -- now the
  //  crafting bench's look: tabs and a grid, the one you picked on the right, an amount and the button)
  const rcEach = (x) => x.each.length ? x.each.map((e) => gbMat(e.id, `${e.n} ${esc(e.name.toLowerCase())} each`)).join("") : x.points ? `<div class="pp-bmat"><span>♻ ${x.points} recycling points each</span></div>` : `<div class="pp-bmat no"><span>Worth nothing -- it's thrown away</span></div>`;
  function recycleHTML(rv) {
    const st = rv.stash;
    const can = rv.can.map((x) => ({key: x.id, icon: itemIcon(x.id, 48), name: x.name, badge: ((x.bag || 0) + (x.stored || 0)).toLocaleString(), can: !!(x.each.length || x.points), x}));
    const lots = st.lots.map((l) => ({key: "l" + l.i, icon: itemIcon(l.id, 48), name: `${l.n} × ${l.name}`, badge: l.waiting ? "full" : clock(l.readyIn), l}));
    return `<section class="pp-shop pp-recycle"><b>Recycle stash</b>
      <span class="stamp">· ${esc(st.tierName)} · breaks things down ${esc(st.speed)} · ${st.lots.length}/${st.max} lots · half comes back as materials, or as recycling points</span>
      ${gridBenchHTML("recycle", [{id: "put", label: "Put in", items: can, empty: "Nothing to put in."}, {id: "lots", label: "Breaking down", items: lots, empty: "Nothing breaking down."}], (it, tab) => {
        if (tab === "lots") { const l = it.l;
          return gbHead(itemIcon(l.id, 64), `${l.n} × ${esc(l.name)}`, [l.waiting ? "done -- waiting for room in the materials store" : `ready in ${clock(l.readyIn)}`])
            + `<div class="pp-label">Gives</div>${l.gives.length ? l.gives.map((e) => gbMat(e.id, `${e.n} ${esc(e.name.toLowerCase())}`)).join("") : l.points ? `<div class="pp-bmat"><span>♻ ${l.points} points</span></div>` : `<p class="stamp">Nothing -- it's thrown away.</p>`}
            <button class="btn pp-rc-cancel" data-i="${l.i}">Take it back</button>`; }
        const x = it.x;
        return gbHead(itemIcon(x.id, 64), esc(x.name), [x.bag ? `${x.bag} in your bag` : "", x.stored ? `${x.stored} in the bank` : "", `takes ${esc(x.takes)}`])
          + `<div class="pp-label">Each gives about</div>${rcEach(x)}
          ${x.bag > 1 ? gbAmountHTML("rc:" + x.id, x.bag, x.bag) : ""}
          <div class="pp-row">${x.bag ? `<button class="btn btn-primary pp-bmake pp-rc-put" data-id="${x.id}" data-n="amt" data-from="bag" ${st.lots.length < st.max ? "" : "disabled"}>RECYCLE</button>` : ""}
            ${x.stored ? `<button class="btn pp-rc-put" data-id="${x.id}" data-n="all" data-from="chests" title="Everything of it in the bank">All ${x.stored} from the bank</button>` : ""}</div>
          ${st.lots.length >= st.max ? `<p class="stamp">The stash is full -- wait for a lot to finish, or build it bigger.</p>` : ""}`;
      })}
      ${recycleBuildHTML("stash", st.next)}
    </section>`;
  }
  function recycledHTML(rv) {
    const m = rv.store;
    const mats = m.items.map((x) => ({key: x.id, icon: itemIcon(x.id, 48), name: x.name, badge: x.n.toLocaleString(), can: true, x}));
    const shop = rv.shop.map((x) => ({key: x.id, icon: itemIcon(x.id, 48), name: x.name, badge: x.have ? x.have.toLocaleString() : "", corner: "♻" + x.price, can: !!x.can, x}));
    return `<section class="pp-shop pp-recycled"><b>Recycled materials</b> <span class="stamp">· ${esc(m.tierName)} · ${m.used}/${m.cap} kinds · <b>♻ ${rv.points}</b> recycling points · your benches at home use these</span>
      ${gridBenchHTML("recycled", [{id: "mats", label: "Materials", items: mats, empty: "Empty -- put something in the recycle stash."}, {id: "shop", label: "Exchange", items: shop, empty: "Nothing to buy with points yet."}], (it, tab) => {
        const x = it.x;
        if (tab === "mats") return gbHead(itemIcon(x.id, 64), esc(x.name), [`${x.n.toLocaleString()} in the store`]) + `
          <button class="btn btn-primary pp-bmake pp-rc-take" data-id="${x.id}" data-n="all">TAKE TO BAG</button>`;
        return gbHead(itemIcon(x.id, 64), esc(x.name), [`♻ ${x.price} each`, x.have ? `${x.have.toLocaleString()} in the store` : ""]) + `
          ${x.can > 1 ? gbAmountHTML("pt:" + x.id, x.can, Math.min(x.can, 10)) : ""}
          <p class="stamp pp-bget">${x.can ? `Costs ♻ <b data-gbeach="${x.price}">${(x.price * Math.min(x.can, +(gbAmt["pt:" + x.id] || Math.min(x.can, 10)))).toLocaleString()}</b>` : "Not enough points."}</p>
          <button class="btn btn-primary pp-bmake pp-pt-buy" data-id="${x.id}" data-n="amt" ${x.can ? "" : "disabled"}>BUY</button>`;
      })}
      ${recycleBuildHTML("store", m.next)}
    </section>`;
  }
  function wireRecycle(host) {
    const doIt = async (a, o) => { const r = await act(a, o); if (r && r.error) { status = r.error; toast(r.error, true); } showSec(); };
    host.querySelectorAll(".pp-rc-put").forEach((b) => b.addEventListener("click", () => doIt("recycle", {id: b.dataset.id, n: b.dataset.n === "all" ? "all" : b.dataset.n === "amt" ? gbAmount(b) : +b.dataset.n, from: b.dataset.from})));
    host.querySelectorAll(".pp-rc-cancel").forEach((b) => b.addEventListener("click", () => doIt("recyclecancel", {i: +b.dataset.i})));
    host.querySelectorAll(".pp-rc-take").forEach((b) => b.addEventListener("click", () => doIt("recycletake", {id: b.dataset.id, n: "all"})));
    host.querySelectorAll(".pp-rc-build").forEach((b) => b.addEventListener("click", () => doIt("recyclebuild", {part: b.dataset.part})));
    host.querySelectorAll(".pp-pt-buy").forEach((b) => b.addEventListener("click", () => doIt("recyclebuy", {id: b.dataset.id, n: b.dataset.n === "max" ? "max" : b.dataset.n === "amt" ? gbAmount(b) : +b.dataset.n})));
    host.querySelectorAll(".pp-recycle .pp-gbench, .pp-recycled .pp-gbench").forEach((g) => gridBenchWire(host, g.dataset.gb, showSec));
  }
  // ---- the cart (2026-10-11): load it from the bag, the chests and the recycled materials; Marlow pays when it's back ----
  function cartHTML(cv) {
    const {s} = current(), nx = cv.next;
    const build = nx ? `<div class="pp-room-next">
        <div><b>${cv.tier ? "Build the " + esc(nx.name.toLowerCase()) : "Build a cart shed"}</b> <span class="stamp">· pulled by ${esc(nx.pulled)} · ${nx.kinds} kinds a load · ${nx.hours} hours${nx.bonus > 1 ? ` · +${Math.round((nx.bonus - 1) * 100)}% on every sale` : ""} · +${nx.xp} Construction xp</span></div>
        ${nx.lock ? `<p class="stamp">🔒 ${esc(nx.lock)}.</p>` : `<div class="pp-needs">
          <span class="pp-need-chip${cv.con >= nx.con ? "" : " lack"}">Construction ${cv.con}/${nx.con}</span>
          <span class="pp-need-chip${(s.coins || 0) >= nx.coins ? "" : " lack"}">${coinTxt(nx.coins)}</span>
          ${nx.needs.map((n) => `<span class="pp-need-chip${n.have >= n.need ? "" : " lack"}" title="${esc(n.name)}" data-iteminfo="${n.id}"><img alt="" src="${itemIcon(n.id, 16)}">${n.have}/${n.need}</span>`).join("")}
        </div>
        <button class="btn btn-sm ${nx.can ? "btn-primary" : ""} pp-cart-build" ${nx.can ? "" : "disabled"}>Build</button>`}
      </div>` : `<p class="stamp pp-room-done">As grand as it gets.</p>`;
    if (!cv.tier) return `<section class="pp-shop pp-cart"><b>Cart shed</b>
      ${build}</section>`;
    // (2026-10-20: the crafting bench's look -- Load and On the cart, a grid, the one you picked on the right)
    const can = cv.can.map((x) => ({key: x.id, icon: itemIcon(x.id, 48), name: x.name, badge: ((x.bag || 0) + (x.chests || 0) + (x.recycled || 0)).toLocaleString(), can: true, x}));
    const load = cv.load.map((r) => ({key: "c" + r.id, icon: itemIcon(r.id, 48), name: `${r.n.toLocaleString()} × ${r.name}`, badge: r.n.toLocaleString(), r}));
    return `<section class="pp-shop pp-cart"><b>${esc(cv.name)}</b>
      <span class="stamp">· pulled by ${esc(cv.pulled)} · ${cv.kinds} kinds a load · ${cv.hours} hours to Marlow and back${cv.bonus > 1 ? ` · +${Math.round((cv.bonus - 1) * 100)}%` : ""}</span>
      <div class="pp-row pp-cart-go"><span class="stamp">${cv.out ? `On the road -- back in <b>${clock(cv.out.backIn)}</b> with <b>${coinTxt(cv.out.pay)}</b>. Load the next trip meanwhile.` : `On the cart: ${cv.load.length}/${cv.kinds} kinds · ${coinTxt(cv.total)}`}</span>
        <button class="btn ${cv.load.length && !cv.out ? "btn-primary" : ""}" id="pp-cart-send" ${cv.load.length && !cv.out ? "" : "disabled"}>${cv.out ? "The cart's out" : `Send it to Marlow · ${coinTxt(cv.total)}`}</button></div>
      ${gridBenchHTML("cart", [{id: "load", label: "Load", items: can, empty: "Nothing to sell."}, {id: "on", label: "On the cart", items: load, empty: "Nothing loaded yet."}], (it, tab) => {
        if (tab === "on") { const r = it.r; return gbHead(itemIcon(r.id, 64), `${r.n.toLocaleString()} × ${esc(r.name)}`, [coinTxt(r.pay)]) + `<button class="btn pp-cart-unload" data-id="${r.id}">Take it off</button>`; }
        const x = it.x;
        return gbHead(itemIcon(x.id, 64), esc(x.name), [eachTxt(x.each)]) + `<div class="pp-label">Load all of it from</div>
          <div class="pp-row">${[["bag", "your bag"], ["chests", "the bank"], ["recycled", "recycled"]].filter(([k]) => x[k] > 0)
            .map(([k, label]) => `<button class="btn pp-cart-load" data-id="${x.id}" data-from="${k}">${x[k].toLocaleString()} from ${label}</button>`).join("")}</div>
          ${cv.load.length >= cv.kinds && !cv.load.some((r) => r.id === x.id) ? `<p class="stamp">The cart takes ${cv.kinds} kinds a load -- it's full.</p>` : ""}`;
      })}
      ${build}
    </section>`;
  }
  function wireCart(host) {
    const doIt = async (a, o) => { const r = await act(a, o || {}); if (r && r.error) { status = r.error; toast(r.error, true); } showSec(); };
    host.querySelectorAll(".pp-cart-build").forEach((b) => b.addEventListener("click", () => doIt("cartbuild")));
    host.querySelectorAll(".pp-cart-load").forEach((b) => b.addEventListener("click", () => doIt("cartload", {id: b.dataset.id, from: b.dataset.from, n: "all"})));
    host.querySelectorAll(".pp-cart-unload").forEach((b) => b.addEventListener("click", () => doIt("cartunload", {id: b.dataset.id})));
    const send = host.querySelector("#pp-cart-send"); if (send) send.addEventListener("click", () => doIt("cartsend"));
    if (host.querySelector(".pp-cart .pp-gbench")) gridBenchWire(host, "cart", showSec);
  }
  function openPlace(key, region) { openSec = key; secLand = region || ""; showSec(); }
  /** What a sheet shows: its inner HTML, or "" when there's nothing (the sheet closes). */
  function secSheetHTML(key) {
    const {s, now} = current();
    if (key.startsWith("sec:")) {
      const hv = Core.homeView(s, now), k = key.slice(4);
      const f = {hearth: hearthHTML, dining: diningHTML, archive: archiveHTML, reading: readingHTML, stacks: stacksHTML, observatory: observatoryHTML}[k];
      return f ? f(hv) : "";
    }
    if (key.startsWith("room:")) return roomsHTML((r) => r.id === key.slice(5));
    if (key === "materials") return materialsHTML(true);
    if (key === "recycle") return recycleHTML(Core.recycleView(s, now));
    if (key === "cart") return cartHTML(Core.cartView(s, now));
    if (key === "recycled") return recycledHTML(Core.recycleView(s, now));
    const lv = secLand && Core.landView(s, secLand, now);
    if (!lv) return "";
    if (key === "person") return lv.person ? personHTML(lv.person, lv.open) : "";
    if (key === "contracts") return contractsHTML(Core.contractsView(s, secLand, now));
    if (key === "secrets") return secretsHTML(lv);
    return "";
  }
  /** A harbourmaster's contracts (2026-10-09): goods from the other islands, three a day (four with a galleon). */
  function contractsHTML(cv) {
    return `<section class="pp-shop"><b>${esc(cv.who)}'s contracts</b>
      
      ${gridBenchHTML("contracts:" + cv.port, [{id: "c", label: "Contracts", items: cv.list.map((o) => ({key: String(o.i), icon: itemIcon(o.id, 48), name: `${o.n.toLocaleString()} × ${o.name}`, badge: o.done ? "✓" : `${o.have.toLocaleString()}/${o.n.toLocaleString()}`, corner: o.big ? "G" : "", can: o.can, o}))}], (it) => { const o = it.o;
        return gbHead(itemIcon(o.id, 64), `${o.n.toLocaleString()} × ${esc(o.name)}`, [coinTxt(o.coins), o.xp ? `+${o.xp.toLocaleString()} ${esc(o.skill)} xp` : "", o.big ? "Galleon · an iron crate" : "a crate"])
          + gbMat(o.id, `${o.have.toLocaleString()}/${o.n.toLocaleString()}`, o.have >= o.n)
          + `<button class="btn btn-primary pp-bmake pp-contract" data-port="${cv.port}" data-i="${o.i}" ${o.can ? "" : "disabled"}>${o.done ? "FILLED ✓" : "DELIVER"}</button>`; })}</section>`;
  }
  function showSec() {
    if (!openSec) return;
    const html = secSheetHTML(openSec);
    if (!html) return closeSec();
    let box = document.querySelector(".pp-modal.pp-sec-modal");
    if (!box) {
      box = document.createElement("div");
      box.className = "pp-modal pp-sec-modal";
      box.innerHTML = `<div class="pp-modal-card pp-shop-card pp-sec-card" role="dialog"></div>`;
      document.body.appendChild(box);
      box.addEventListener("click", (e) => { if (e.target === box) closeSec(); });
    }
    box.classList.toggle("pp-bench-modal", ["recycle", "recycled", "cart", "contracts"].includes(openSec));   // (the wide bench window, 2026-10-20)
    const card = box.querySelector(".pp-sec-card"), keep = card.scrollTop;
    card.innerHTML = `<button class="btn btn-quiet btn-sm pp-shop-x" aria-label="Close">✕</button>${html}`;
    card.scrollTop = keep;
    card.querySelector(".pp-shop-x").addEventListener("click", closeSec);
    wireHome(card);
    wireMaterials(card);
    wireRecycle(card);
    wireCart(card);
    // a room: its benches open their own window, the store room its chests
    card.querySelectorAll(".pp-room .pp-villager").forEach((b) => b.addEventListener("click", () => { closeSec(); openShop = b.dataset.ws; showShop(); }));
    card.querySelectorAll(".pp-build").forEach((b) => b.addEventListener("click", async () => {
      const r = await act("build", {room: b.dataset.room});
      if (r && r.error) { status = r.error; toast(r.error, true); render(); }
    }));
    card.querySelectorAll("[data-jump]").forEach((b) => b.addEventListener("click", () => {
      closeSec();
      if (b.dataset.sheetTab) { sheetTab = b.dataset.sheetTab; sheetFrom = b.dataset.jump; }   // straight to a Character sheet tab
      goTo(b.dataset.jump);
    }));
    const st = card.querySelector("#pp-open-store"); if (st) st.addEventListener("click", () => { closeSec(); showStore(); });
    card.querySelectorAll(".pp-gbench[data-gb^='contracts:']").forEach((g) => gridBenchWire(card, g.dataset.gb, showSec));   // (2026-10-20)
    card.querySelectorAll(".pp-contract").forEach((b) => b.addEventListener("click", async () => {
      const r = await act("contract", {port: b.dataset.port, i: +b.dataset.i});
      if (r && r.error) { status = r.error; toast(r.error, true); render(); }
    }));
    const qb = card.querySelector("#pp-quest");
    if (qb) qb.addEventListener("click", async () => {
      const had = !!((current().s.quests || {}).quarry);
      const r = await act("quest", {region: secLand});
      if (r && r.error) { status = r.error; toast(r.error, true); render(); }
      else if (!had && (current().s.quests || {}).quarry) talkPopup("quarry");   // Ranger Ash explains the Bestiary (PT20 b1)
    });
  }
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && openSec) closeSec(); });
  // no dragging a picture off a map, and a double-click doesn't start a selection there (2026-10-08)
  ["dragstart", "selectstart"].forEach((ev) => document.addEventListener(ev, (e) => {
    const el = e.target && e.target.nodeType === 3 ? e.target.parentElement : e.target;
    if (el && el.closest && el.closest(".pp-world, .pp-arena, .pp-land-painted")) e.preventDefault();
  }));
  document.addEventListener("mousedown", (e) => { if (e.detail > 1 && e.target.closest && e.target.closest(".pp-world, .pp-arena")) e.preventDefault(); });
  function secretsHTML(lv) {
    return `<section class="pp-shop">
      <b>Secrets of the ${esc(lv.name)}</b> <span class="stamp">${lv.found}/${lv.total} found</span>
      <div class="pp-beasts">${lv.secrets.map((x) => x.found ? `<div class="pp-beast"><div><b>${x.kind === "egg" ? "🥚" : x.kind === "spot" ? "📍" : "💰"} ${esc(x.name)}</b></div>
          <div class="stamp">${esc(x.text)}</div></div>` : `<div class="pp-beast unknown"><b>???</b><div class="stamp">Still hidden</div></div>`).join("")}</div>
    </section>`;
  }
  function personHTML(pp, open) {
    const q = pp.quest;
    return `<section class="pp-shop pp-person" id="pp-person">
      <div class="pp-shop-head"><img class="pp-npc" alt="" src="${avatarURL(pp.look, 48)}">
        <div><b>${esc(pp.name)}</b> <span class="stamp">${pp.done}/${pp.total} quests done</span><div class="stamp">“${esc(pp.says)}”</div></div></div>
      ${q ? `<div class="pp-quest"><div><b>${esc(q.name)}</b></div><p class="stamp">${esc(q.text)}</p>
          <div class="pp-needs">${q.needs.map((n) => `<span class="pp-need-chip${n.ok ? "" : " lack"}"${n.item ? ` data-iteminfo="${n.item}"` : ""}>${n.item ? `<img alt="" src="${itemIcon(n.item, 16)}">` : ""}${esc(n.text)} ${n.have}/${n.need}</span>`).join("")}</div>
          <p class="stamp">Reward: ${esc(q.reward)}</p>
          <button class="btn ${q.can ? "btn-primary" : ""}" id="pp-quest" ${q.can && open ? "" : "disabled"}>${q.can ? "Hand it in" : "Not ready yet"}</button></div>`
        : `<p class="stamp">“You've done more than enough. Thank you.”</p>`}
    </section>`;
  }
  // ---- illustrated scenes (2026-10-07, Cam OK'd "proper illustrated scenes" for the regions) ---------------
  // One SVG per region behind its pins: sky things, far hills or peaks, and the region's own props, drawn in
  // its palette (the arena's --sky/--hill/--ground colours). Positions come from a seeded roll, so a region
  // always looks the same.
  function sceneSVG(id) {
    if (modPics.regions[id]) return `<svg class="pp-scene" viewBox="0 0 1000 320" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <image href="${modPics.regions[id]}" x="0" y="0" width="1000" height="320" preserveAspectRatio="xMidYMid slice"/></svg>`;
    let seed = [...id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7);
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const H = 154;                                                       // the horizon (the ground starts at 48%)
    const out = [];
    const cloud = (x, y, k, op) => out.push(`<g opacity="${op || 0.85}" fill="#fff"><ellipse cx="${x}" cy="${y}" rx="${46 * k}" ry="${16 * k}"/><ellipse cx="${x - 26 * k}" cy="${y + 4 * k}" rx="${28 * k}" ry="${12 * k}"/><ellipse cx="${x + 24 * k}" cy="${y - 6 * k}" rx="${30 * k}" ry="${14 * k}"/></g>`);
    const hills = (fill, op, amp, y0) => { let d = `M0 ${y0}`; for (let x = 0; x <= 1000; x += 100) d += ` Q${x + 50} ${y0 - amp * (0.5 + rnd())} ${x + 100} ${y0}`; out.push(`<path d="${d} L1000 ${H + 2} L0 ${H + 2} Z" fill="${fill}" opacity="${op}"/>`); };
    const peaks = (fill, snow, n, hmax) => { for (let i = 0; i < n; i++) { const x = (i + 0.3 * rnd()) * (1000 / n), w = 130 + 90 * rnd(), h = hmax * (0.6 + 0.4 * rnd());
      out.push(`<path d="M${x - w / 2} ${H} L${x} ${H - h} L${x + w / 2} ${H} Z" fill="${fill}"/>`);
      if (snow) out.push(`<path d="M${x - w * 0.14} ${H - h * 0.72} L${x} ${H - h} L${x + w * 0.14} ${H - h * 0.72} L${x + w * 0.05} ${H - h * 0.76} L${x - w * 0.04} ${H - h * 0.68} Z" fill="${snow}"/>`); } };
    const tree = (x, y, k, leaf, trunk) => out.push(`<g><rect x="${x - 3 * k}" y="${y - 14 * k}" width="${6 * k}" height="${14 * k}" fill="${trunk || "#6b4a2a"}"/><circle cx="${x}" cy="${y - 22 * k}" r="${13 * k}" fill="${leaf}"/><circle cx="${x - 8 * k}" cy="${y - 16 * k}" r="${9 * k}" fill="${leaf}"/><circle cx="${x + 8 * k}" cy="${y - 16 * k}" r="${9 * k}" fill="${leaf}"/></g>`);
    const pine = (x, y, k, leaf, snow) => out.push(`<g><rect x="${x - 2.5 * k}" y="${y - 8 * k}" width="${5 * k}" height="${8 * k}" fill="#5a3a22"/><path d="M${x - 14 * k} ${y - 6 * k} L${x} ${y - 44 * k} L${x + 14 * k} ${y - 6 * k} Z" fill="${leaf}"/>${snow ? `<path d="M${x - 6 * k} ${y - 30 * k} L${x} ${y - 44 * k} L${x + 6 * k} ${y - 30 * k} Z" fill="${snow}"/>` : ""}</g>`);
    const palm = (x, y, k) => out.push(`<g><path d="M${x} ${y} q${4 * k} ${-26 * k} ${-2 * k} ${-50 * k}" stroke="#8a6a3a" stroke-width="${5 * k}" fill="none"/>${[[-28, -6], [26, -4], [-18, 10], [20, 12], [0, -16]].map(([dx, dy]) => `<path d="M${x - 2 * k} ${y - 50 * k} q${dx * 0.5 * k} ${dy * k - 10 * k} ${dx * k} ${dy * k + 8 * k}" stroke="#3f8a3a" stroke-width="${5 * k}" fill="none" stroke-linecap="round"/>`).join("")}</g>`);
    const fence = (x1, x2, y) => { out.push(`<rect x="${x1}" y="${y - 12}" width="${x2 - x1}" height="3" fill="#8a6a42"/><rect x="${x1}" y="${y - 6}" width="${x2 - x1}" height="3" fill="#8a6a42"/>`); for (let x = x1; x <= x2; x += 22) out.push(`<rect x="${x}" y="${y - 16}" width="4" height="16" fill="#7a5a32"/>`); };
    const sea = (y, col) => { out.push(`<rect x="0" y="${y}" width="1000" height="${H - y + 4}" fill="${col}"/>`); for (let x = 20; x < 1000; x += 70) out.push(`<path d="M${x} ${y + 8 + 6 * rnd()} q8 -5 16 0" stroke="rgba(255,255,255,.6)" stroke-width="2" fill="none"/>`); };
    const flowers = (n, cols) => { for (let i = 0; i < n; i++) out.push(`<circle cx="${1000 * rnd()}" cy="${H + 8 + 150 * rnd()}" r="${2 + 2 * rnd()}" fill="${cols[i % cols.length]}" opacity=".85"/>`); };
    const tufts = (n, col) => { for (let i = 0; i < n; i++) { const x = 1000 * rnd(), y = H + 20 + 140 * rnd(); out.push(`<path d="M${x} ${y} l3 -9 l3 9 l3 -7 l2 7" stroke="${col}" stroke-width="2" fill="none" opacity=".55"/>`); } };
    const sun = (x, y, col) => out.push(`<circle cx="${x}" cy="${y}" r="26" fill="${col || "#fff4b0"}" opacity=".9"/>`);
    const stars = (n) => { for (let i = 0; i < n; i++) out.push(`<circle cx="${1000 * rnd()}" cy="${100 * rnd()}" r="${0.8 + 1.4 * rnd()}" fill="#fff" opacity="${0.4 + 0.5 * rnd()}"/>`); };
    const crystal = (x, y, k, col) => out.push(`<path d="M${x} ${y} l${-7 * k} ${-8 * k} l${7 * k} ${-26 * k} l${7 * k} ${26 * k} Z" fill="${col}" opacity=".9"/><path d="M${x} ${y} l0 ${-34 * k} l${7 * k} ${26 * k} Z" fill="#fff" opacity=".25"/>`);
    const scene = {
      farmyard() { sun(860, 50); cloud(200, 50, 1); cloud(560, 36, 0.8); hills("var(--hill)", 0.7, 30, H);
        out.push(`<g><rect x="640" y="${H - 52}" width="90" height="52" fill="#b8402e"/><path d="M630 ${H - 52} L685 ${H - 88} L740 ${H - 52} Z" fill="#8a2a1e"/><rect x="672" y="${H - 30}" width="26" height="30" fill="#f2e6c8"/><path d="M672 ${H - 30} l26 30 M698 ${H - 30} l-26 30" stroke="#b8402e" stroke-width="3"/></g>`);
        [[150, 0.9], [210, 0.7], [800, 0.8]].forEach(([x, k]) => out.push(`<path d="M${x - 24 * k} ${H} Q${x} ${H - 44 * k} ${x + 24 * k} ${H} Z" fill="#e8c860"/>`));
        fence(40, 400, H + 4); fence(760, 980, H + 4); tufts(30, "#8a7a3a"); },
      pasture() { sun(120, 50); cloud(420, 44, 1.1); cloud(800, 60, 0.8); hills("var(--hill)", 0.8, 40, H);
        out.push(`<g><rect x="760" y="${H - 64}" width="18" height="64" fill="#f2e6c8"/><path d="M754 ${H - 64} L769 ${H - 80} L784 ${H - 64} Z" fill="#a85a3a"/>${[0, 90, 180, 270].map((a) => `<rect x="767" y="${H - 108}" width="4" height="40" fill="#e8dcc0" transform="rotate(${a + 20} 769 ${H - 70})"/>`).join("")}</g>`);
        [80, 300, 520, 900].forEach((x) => tree(x, H, 0.9 + 0.3 * rnd(), "#5aa04a")); fence(0, 1000, H + 6); tufts(40, "#4a8a3a"); },
      meadow() { cloud(260, 40, 1); cloud(700, 56, 1.2); hills("var(--hill)", 0.7, 26, H);
        [140, 680, 860].forEach((x) => tree(x, H, 0.8 + 0.3 * rnd(), "#7cc06a"));
        [420, 470].forEach((x) => out.push(`<g><rect x="${x - 14}" y="${H - 28}" width="28" height="28" fill="#f2c43c"/><rect x="${x - 16}" y="${H - 32}" width="32" height="6" fill="#c8963c"/><rect x="${x - 3}" y="${H - 14}" width="6" height="4" fill="#3a2a10"/></g>`));
        flowers(90, ["#f08ab0", "#fff4b0", "#b9a3e3", "#ffffff", "#f29a2e"]); },
      forest() { cloud(500, 34, 0.9, 0.6); hills("var(--hill)", 0.9, 34, H);
        for (let i = 0; i < 16; i++) tree(20 + i * 64 + 20 * rnd(), H + 2, 1 + 0.5 * rnd(), i % 2 ? "#2f6a3a" : "#3f7a42", "#4a3020");
        tufts(40, "#2f6630"); out.push(`<g fill="#d9604f">${[120, 640, 910].map((x) => `<ellipse cx="${x}" cy="${H + 150}" rx="9" ry="6"/>`).join("")}</g>`); },
      deepforest() { stars(25); out.push(`<circle cx="840" cy="46" r="20" fill="#e8f0d8" opacity=".85"/>`); hills("#14302a", 0.9, 30, H);
        for (let i = 0; i < 22; i++) pine(i * 47 + 18 * rnd(), H + 4, 1.1 + 0.6 * rnd(), i % 2 ? "#123a24" : "#1a4a2e");
        tufts(30, "#0f2a1a"); out.push(`<g fill="#7ad0a0" opacity=".75">${[200, 520, 760].map((x) => `<circle cx="${x}" cy="${H + 130}" r="4"/>`).join("")}</g>`); },
      coast() { sun(150, 46); cloud(520, 40, 1); cloud(860, 30, 0.7); sea(H - 40, "#3a8ab8");
        out.push(`<g><rect x="830" y="${H - 96}" width="26" height="96" fill="#f2ece0"/><rect x="830" y="${H - 72}" width="26" height="12" fill="#c0503a"/><rect x="830" y="${H - 40}" width="26" height="12" fill="#c0503a"/><rect x="826" y="${H - 110}" width="34" height="16" fill="#3a3a44"/><circle cx="843" cy="${H - 102}" r="5" fill="#fff4b0"/></g>`);
        [[120, 30], [300, 18], [620, 24]].forEach(([x, r]) => out.push(`<ellipse cx="${x}" cy="${H - 2}" rx="${r}" ry="${r * 0.55}" fill="#7a7a82"/>`)); tufts(20, "#c8a868"); },
      jungle() { out.push(`<g fill="#ffffff" opacity=".35"><rect x="0" y="${H - 70}" width="1000" height="14"/></g>`); hills("var(--hill)", 0.9, 44, H);
        [60, 220, 470, 760, 940].forEach((x) => palm(x, H + 4, 1 + 0.4 * rnd()));
        out.push(`<g fill="#a8a088"><rect x="590" y="${H - 60}" width="18" height="60"/><rect x="640" y="${H - 44}" width="18" height="44"/><rect x="584" y="${H - 66}" width="80" height="10"/></g>`);
        for (let i = 0; i < 9; i++) out.push(`<path d="M${110 * i + 30} 0 q${-10 + 20 * rnd()} 40 0 ${50 + 50 * rnd()}" stroke="#2f7a2c" stroke-width="4" fill="none"/>`); tufts(40, "#23602a"); },
      deepjungle() { for (let i = 0; i < 14; i++) out.push(`<path d="M${75 * i} 0 q${-12 + 24 * rnd()} 50 ${4} ${70 + 70 * rnd()}" stroke="#0f4a2a" stroke-width="6" fill="none"/>`);
        hills("#0f3a22", 0.95, 30, H);
        out.push(`<g fill="#7a8a6a"><rect x="400" y="${H - 30}" width="200" height="30"/><rect x="430" y="${H - 58}" width="140" height="28"/><rect x="460" y="${H - 82}" width="80" height="24"/><rect x="488" y="${H - 72}" width="24" height="16" fill="#1a2a1a"/></g>`);
        [80, 240, 760, 920].forEach((x) => palm(x, H + 4, 1.3)); tufts(50, "#0c3a1e"); },
      crystalcaves() { out.push(`<path d="M0 0 L1000 0 L1000 70 Q900 110 820 60 Q700 120 600 70 Q480 130 380 64 Q260 120 160 70 Q80 110 0 60 Z" fill="#141a30"/>`);
        for (let i = 0; i < 9; i++) out.push(`<path d="M${60 + i * 110} ${60 + 20 * rnd()} l8 30 l8 -30 Z" fill="#2a3456"/>`);
        hills("#2a3456", 0.9, 30, H);
        for (let i = 0; i < 12; i++) crystal(40 + i * 85 + 20 * rnd(), H + 2, 0.8 + 0.8 * rnd(), ["#9ad0f8", "#c8a0f0", "#80f0d0"][i % 3]);
        flowers(40, ["#9ad0f8", "#c8a0f0"]); },
      mistyisle() { sea(H - 50, "#7a98a8"); out.push(`<g><path d="M260 ${H} Q330 ${H - 70} 420 ${H} Z" fill="#6a8a7a"/></g>`); [600, 700, 860].forEach((x) => palm(x, H + 4, 1.1));
        for (let i = 0; i < 3; i++) out.push(`<rect x="0" y="${60 + i * 34}" width="1000" height="16" fill="#fff" opacity="${0.35 - i * 0.08}"/>`); tufts(20, "#a89460"); },
      magetower() { stars(40); out.push(`<circle cx="160" cy="50" r="22" fill="#f0e8ff" opacity=".9"/>`); hills("var(--hill)", 0.9, 26, H);
        out.push(`<g><rect x="455" y="${H - 150}" width="90" height="150" fill="#5a5070"/><rect x="455" y="${H - 150}" width="90" height="10" fill="#3a3050"/>
          <path d="M440 ${H - 150} L500 ${H - 230} L560 ${H - 150} Z" fill="#6a5ad8"/><circle cx="500" cy="${H - 236}" r="7" fill="#f2c43c"/>
          ${[H - 120, H - 80, H - 40].map((y) => `<rect x="490" y="${y}" width="20" height="24" rx="10" fill="#f2e6a8" opacity=".9"/>`).join("")}<rect x="486" y="${H - 22}" width="28" height="22" fill="#2a2036"/></g>`);
        for (let i = 0; i < 12; i++) out.push(`<circle cx="${380 + 240 * rnd()}" cy="${H - 60 - 200 * rnd()}" r="${1.5 + 2 * rnd()}" fill="#c8a0f0" opacity=".8"/>`); tufts(30, "#3a3060"); },
      frostpeak() { cloud(300, 40, 1, 0.7); peaks("#9ab0c8", "#ffffff", 5, 120); hills("#dfe8f0", 0.95, 18, H);
        for (let i = 0; i < 10; i++) pine(40 + i * 100 + 30 * rnd(), H + 6, 1 + 0.4 * rnd(), "#2f5a4a", "#ffffff");
        for (let i = 0; i < 40; i++) out.push(`<circle cx="${1000 * rnd()}" cy="${320 * rnd()}" r="${1 + 1.6 * rnd()}" fill="#fff" opacity=".8"/>`); },
      // the desert and the Nile (2026-10-08) -- drawn until Cam's own pictures come
      desert() { sun(820, 50, "#fff0b0"); out.push(`<rect x="0" y="0" width="1000" height="${H}" fill="#f6c870" opacity=".25"/>`);
        [[300, 150, 110], [430, 110, 76], [180, 90, 60]].forEach(([x, w, h]) => out.push(`<path d="M${x - w} ${H} L${x} ${H - h} L${x + w} ${H} Z" fill="#d8a858"/><path d="M${x} ${H - h} L${x + w} ${H} L${x + w * 0.3} ${H} Z" fill="#b8883a"/>`));
        for (let i = 0; i < 5; i++) out.push(`<path d="M${i * 230 - 60} ${H + 4} Q${i * 230 + 60} ${H - 30 - 20 * rnd()} ${i * 230 + 180} ${H + 4} Z" fill="#e8c078"/>`);
        out.push(`<ellipse cx="780" cy="${H + 30}" rx="90" ry="16" fill="#4aa8c8"/>`); [720, 830, 870].forEach((x) => palm(x, H + 24, 0.9)); tufts(16, "#c8963c"); },
      oasis() { sun(820, 50, "#fff0b0"); out.push(`<rect x="0" y="0" width="1000" height="${H}" fill="#f6c870" opacity=".2"/>`);
        for (let i = 0; i < 5; i++) out.push(`<path d="M${i * 230 - 60} ${H + 4} Q${i * 230 + 60} ${H - 24 - 16 * rnd()} ${i * 230 + 180} ${H + 4} Z" fill="#e8c078"/>`);
        out.push(`<ellipse cx="500" cy="${H + 46}" rx="260" ry="34" fill="#3a9ac0"/><ellipse cx="470" cy="${H + 40}" rx="150" ry="12" fill="#8ad0e8" opacity=".6"/>`);
        [230, 300, 690, 760, 830].forEach((x, i) => palm(x, H + 30 + (i % 2) * 14, 1 + 0.15 * (i % 3))); tufts(18, "#7aa04a"); },
      hollowcrypt() { out.push(`<rect width="1000" height="320" fill="#1a1622"/><path d="M0 0 L1000 0 L1000 60 Q900 90 800 56 Q700 96 600 60 Q500 96 400 58 Q300 94 200 60 Q100 92 0 58 Z" fill="#2a2434"/>`);
        [180, 400, 620, 840].forEach((x) => out.push(`<path d="M${x - 60} ${H} L${x - 60} ${H - 150} Q${x} ${H - 210} ${x + 60} ${H - 150} L${x + 60} ${H} Z" fill="#3a3248"/><rect x="${x - 6}" y="${H - 120}" width="12" height="16" rx="3" fill="#f2c43c" opacity=".55"/>`));
        for (let i = 0; i < 9; i++) out.push(`<circle cx="${60 + 880 * rnd()}" cy="${H - 40 - 160 * rnd()}" r="${3 + 3 * rnd()}" fill="#bfe8ff" opacity=".55"/>`); tufts(14, "#4a4058"); },
      icecavern() { out.push(`<rect width="1000" height="320" fill="#0e2a44"/><path d="M0 0 L1000 0 L1000 80 Q880 130 760 70 Q640 140 520 76 Q400 140 280 70 Q160 130 0 70 Z" fill="#1e4a6a"/>`);
        for (let i = 0; i < 12; i++) out.push(`<path d="M${40 + i * 85} ${70 + 20 * rnd()} l10 ${40 + 30 * rnd()} l10 ${-40 - 30 * rnd()} Z" fill="#9ad8f8" opacity=".75"/>`);
        hills("#2a6a9a", 0.9, 26, H); out.push(`<ellipse cx="640" cy="${H + 60}" rx="220" ry="30" fill="#0a1a2a" opacity=".85"/>`);
        for (let i = 0; i < 10; i++) crystal(60 + i * 95 + 20 * rnd(), H + 2, 0.8 + 0.7 * rnd(), ["#9ad8f8", "#cfeeff", "#6ab8e8"][i % 3]); },
      summit() { stars(10); cloud(200, 120, 1.2, 0.8); cloud(700, 140, 1.4, 0.8); peaks("#7a90a8", "#ffffff", 3, 170);
        hills("#e8f0f6", 0.95, 14, H); out.push(`<g fill="#8a8a96">${[[480, 30], [500, 22], [492, 14]].map(([x, h]) => `<rect x="${x - 8}" y="${H - h}" width="18" height="10" rx="3"/>`).join("")}</g>`);
        for (let i = 0; i < 60; i++) out.push(`<circle cx="${1000 * rnd()}" cy="${320 * rnd()}" r="${1 + 1.6 * rnd()}" fill="#fff" opacity=".8"/>`); },
      opensea() { sun(860, 50); cloud(300, 40, 1); cloud(620, 56, 0.8); sea(110, "#2a6a9a");
        for (let i = 0; i < 40; i++) out.push(`<path d="M${1000 * rnd()} ${120 + 190 * rnd()} q8 -5 16 0" stroke="rgba(255,255,255,.55)" stroke-width="2" fill="none"/>`);
        out.push(`<g><path d="M420 ${H + 40} q30 -26 70 -8 l-10 10 q-30 -8 -60 -2 Z" fill="#2a3a4a"/><path d="M700 ${H + 20} l14 -22 l6 22 Z" fill="#3a4a5a"/>
          <path d="M230 ${H - 20} l60 0 l-10 18 l-40 0 Z" fill="#6b4a2a"/><path d="M258 ${H - 20} l0 -64 l38 54 Z" fill="#f2ece0"/>
          <path d="M800 ${H - 6} q40 -22 90 0 q-20 10 -45 8 q-25 2 -45 -8 Z" fill="#4a6a8a"/><path d="M845 ${H - 24} l-6 -16 l12 0 Z" fill="#cfe8f6" opacity=".8"/></g>`); },
      sandport() { sun(840, 46, "#fff0b0"); sea(H - 30, "#3a8ab8");
        [[120, 70], [230, 54], [360, 80], [480, 60]].forEach(([x, h]) => out.push(`<g><rect x="${x - 40}" y="${H - h}" width="80" height="${h}" fill="#e0bc80"/><rect x="${x - 44}" y="${H - h - 6}" width="88" height="8" fill="#c8963c"/><rect x="${x - 8}" y="${H - 24}" width="16" height="24" fill="#6b4a2a"/><rect x="${x - 34}" y="${H - h + 14}" width="68" height="8" fill="${["#c8402e", "#2a6ad8", "#e0a020", "#2a8a5a"][x % 4]}" opacity=".8"/></g>`));
        out.push(`<g><rect x="600" y="${H - 34}" width="220" height="10" fill="#8a6a42"/>${[620, 680, 740, 800].map((x) => `<rect x="${x}" y="${H - 26}" width="6" height="30" fill="#6b4a2a"/>`).join("")}<path d="M700 ${H - 40} l60 0 l-10 18 l-40 0 Z" fill="#6b4a2a"/><path d="M728 ${H - 40} l0 -70 l40 60 Z" fill="#f2ece0"/></g>`);
        [560, 900, 960].forEach((x) => palm(x, H + 4, 1)); tufts(14, "#c8963c"); },
      frosthaven() { cloud(300, 40, 1, 0.7); peaks("#9ab0c8", "#ffffff", 4, 100); sea(H - 30, "#5a7a9a");
        [[120, 60], [240, 74], [380, 56], [500, 66]].forEach(([x, h]) => out.push(`<g><rect x="${x - 38}" y="${H - h}" width="76" height="${h}" fill="#7a5a3a"/><path d="M${x - 46} ${H - h} L${x} ${H - h - 34} L${x + 46} ${H - h} Z" fill="#f2f6fa"/><rect x="${x + 14}" y="${H - h - 30}" width="10" height="20" fill="#5a5a64"/><rect x="${x - 10}" y="${H - 30}" width="20" height="30" fill="#3a2a1a"/><rect x="${x - 30}" y="${H - h + 16}" width="14" height="12" fill="#f2d070" opacity=".9"/></g>`));
        out.push(`<g><rect x="620" y="${H - 34}" width="220" height="10" fill="#6a5a4a"/>${[640, 700, 760, 820].map((x) => `<rect x="${x}" y="${H - 26}" width="6" height="30" fill="#4a3a2a"/>`).join("")}</g>`);
        for (let i = 0; i < 6; i++) pine(880 + i * 22, H + 6, 0.9, "#2f5a4a", "#ffffff");
        for (let i = 0; i < 40; i++) out.push(`<circle cx="${1000 * rnd()}" cy="${320 * rnd()}" r="${1 + 1.6 * rnd()}" fill="#fff" opacity=".8"/>`); },
      nile() { sun(160, 46); cloud(560, 40, 0.9); out.push(`<path d="M0 ${H + 40} Q300 ${H + 10} 520 ${H + 50} T1000 ${H + 30} L1000 ${H + 100} Q600 ${H + 80} 300 ${H + 110} T0 ${H + 90} Z" fill="#3a8ab8"/>`);
        hills("#c8b070", 0.6, 20, H); out.push(`<path d="M820 ${H} L900 ${H - 70} L980 ${H} Z" fill="#d8a858"/>`);
        for (let i = 0; i < 30; i++) { const x = 1000 * rnd(); out.push(`<path d="M${x} ${H + 50} l${-4 + 8 * rnd()} -40" stroke="#6a9a3a" stroke-width="3"/><ellipse cx="${x}" cy="${H + 10}" rx="5" ry="8" fill="#8ab04a"/>`); }
        [80, 420, 640].forEach((x) => palm(x, H + 4, 1)); flowers(20, ["#5a7ae8", "#f8a8c0"]); },
    };
    (scene[id] || scene.pasture)();
    return `<svg class="pp-scene" viewBox="0 0 1000 320" preserveAspectRatio="xMidYMax slice" aria-hidden="true">${out.join("")}</svg>`;
  }
  // pages that are places in a region (2026-10-08, Cam: the Forest's camp "is also where the camp will be located")
  // a place inside another: Back steps out to it (2026-10-09)
  const REGION_UP = {nile: "desert", oasis: "desert", icecavern: "frostpeak", summit: "frostpeak", deepjungle: "jungle", hollowcrypt: "mistyisle"};
  const REGION_DOORS = {forest: [["pet:camp", "Camp", "relic", "Lasting upgrades for every pet"]],
    // the Nile is a sub-area of the Desert (2026-10-08): a way down to the river, and back up
    desert: [["pet:pyramid", "The Pyramid", "glyphsun", "Five chambers a day -- and the sarcophagus after dark"], ["@nile", "The Nile", "papyrus", "Down to the river"], ["@oasis", "The Oasis", "dates", "Palms and cool water"], ["@sandport", "Sandport", "obj_village", "Back to town and the dock"]],
    // the Oasis (2026-10-09): rest by the water, and after dark a merchant who may not be there at all
    oasis: [["rest:oasis", "Rest by the water", "lotus", "Heals you and your pets -- once every 4 hours"], ["shop:mirage", "The mirage merchant", "stardust", "After dark only (9 pm to 5 am)"],
            ["@desert", "The Desert", "sand", "Back out into the sands"]],
    nile: [["@desert", "The Desert", "sand", "Back up into the sands"]],
    // the Shipyard and the islands' towns (2026-10-08)
    coast: [["pet:shipyard", "Shipyard", "plank", "Your ship, and Shipwright Hal"]],
    opensea: [["@coast", "Back to the Coast", "boat", "Into the harbour"]],
    sandport: [["shop:bazaar", "The bazaar", "dates", "Tariq's stalls: island goods, rope, eggs"], ["rest:inn", "The inn", "heartystew", "A hot meal and a bed: 60 coins"],
               ["sail:home", "The dock", "boat", "Sail home"], ["sheet:contracts", "Nefer's contracts", "obj_map", "Goods from the other islands, for coins and crates"], ["pet:islandestate", "Your estate", "obj_house", "A home away from home"], ["@desert", "Road to the Desert", "sand", "Out into the sands"]],
    frosthaven: [["shop:tradingpost", "Trading post", "furcoat", "Astrid's furs, rope and lamps"], ["rest:inn", "The inn", "heartystew", "A hot meal and a bed: 60 coins"],
                 ["sail:home", "The dock", "boat", "Sail home"], ["sheet:contracts", "Ingrid's contracts", "obj_map", "Goods from the other islands, for coins and crates"], ["pet:islandestate", "Your estate", "obj_house", "A home away from home"], ["@frostpeak", "Path to the mountains", "climbinggear", "Up into the snow"]],
    frostpeak: [["@frosthaven", "Frosthaven", "obj_village", "Back to town and the dock"], ["@icecavern", "Ice Cavern", "frostcrystal", "Down under the ice"],
                ["@summit", "The Summit", "climbinggear", "Up to the peak"]],
    // Frostpeak's sub-areas (stage 3): the Yeti is earned in the Foothills and fought at the Summit
    icecavern: [["@frostpeak", "Back to the Foothills", "snowberries", "Out into the snow"]],
    summit: [["boss:frostpeak", "The Yeti's lair", "yetifur", "When the Foothills have had enough of you"], ["@frostpeak", "Back to the Foothills", "snowberries", "Down the mountain"]],
    // the Hollow Crypt (Battle Re-work Part 13): down from the Misty Isle; Sexton Hobb's stall
    mistyisle: [["@hollowcrypt", "Hollow Crypt", "bloodessence", "Steps down, under the Isle (bring a lantern)"]],
    hollowcrypt: [["shop:cryptmerchant", "Sexton Hobb's stall", "lifeessence", "A little life essence, dear -- three a day"], ["@mistyisle", "Back up to the Misty Isle", "boat", "Out into the fog"]]};
  function renderLand(host, id) {
    const {s, now} = current();
    const lv = Core.landView(s, id, now);
    if (!lv) { worldRegion = ""; return renderWorld(host); }
    const places = [].concat(
      lv.spots.map((sp) => ({key: sp.skill + ":" + sp.id, kind: "spot", go: "pet:" + sp.skill, skill: sp.skill, spot: sp.id, icon: itemIcon(sp.main, 32), name: sp.name, sub: `${sp.skillName} ${sp.level}`, lock: sp.lock, here: sp.here, secret: sp.secret})),
      lv.hunt ? [{key: "hunt", kind: "hunt", go: "pet:hunt", ground: lv.hunt.id, icon: monsterURL(lv.hunt.boss, 32), name: `${lv.hunt.name} hunting ground`, sub: `Combat ${lv.hunt.level} · ${lv.hunt.bossName}`, lock: lv.hunt.open ? "" : `Combat level ${lv.hunt.level}`,
                  here: lv.doing.includes("hunt"), boss: lv.bossReady}] : [],
      lv.expedition ? [{key: "exp", kind: "exp", go: "pet:expeditions", icon: itemIcon("woodcrate", 32), name: `${lv.expedition.name} expedition`, sub: `For pets, level ${lv.expedition.level}+`, lock: ""}] : [],
      (REGION_DOORS[id] || []).map(([k, name, icon, sub]) => ({key: k, kind: k.startsWith("@") ? "region" : k.startsWith("sail:") ? "sail" : k.startsWith("boss:") ? "lair" : k.startsWith("shop:") ? "shop" : k.startsWith("rest:") ? "rest" : k.startsWith("sheet:") ? "sheet" : "page", go: k, icon: itemIcon(icon, 32), name, sub, lock: ""})),
      lv.person ? [{key: "person", kind: "person", icon: avatarURL(lv.person.look, 32), name: lv.person.name, sub: lv.person.quest ? `Quest: ${lv.person.quest.name}` : "No more quests", lock: "", ready: lv.person.quest && lv.person.quest.can}] : []);
    const pins = places.map((p, i) => {
      const n = places.length, rows = n > 8 ? 3 : n > 3 ? 2 : 1, cols = Math.ceil(n / rows), row = i % rows, col = Math.floor(i / rows);
      const x = 8 + (84 * (col + 0.5 + (row % 2 ? 0.35 : 0))) / cols, y = 42 + row * (rows === 3 ? 19 : 24);
      return `<button class="pp-pin${p.lock ? " locked" : ""}${p.here ? " here" : ""}${p.kind === "person" ? " person" : ""}${p.ready ? " ready" : ""}" style="left:${x}%;top:${y}%" data-i="${i}" title="${esc(p.name)}${p.lock ? " — " + esc(p.lock) : ""}">
        <img alt="" src="${p.icon}"><span>${esc(p.name)}</span></button>`;
    }).join("");
    const ex = lv.exploring, allFound = lv.found >= lv.total;
    // Cam's picture of the region, when there is one (2026-10-08) -- the drawn scene and pins otherwise
    const painted = SCENE_ART[id] && !modPics.regions[id];
    const paintedPlaces = places.map((p) => Object.assign({}, p, {lockShort: p.kind === "spot" || p.kind === "hunt" ? p.sub.replace(/ ·.*/, "") : "",
      hereText: p.kind === "hunt" ? "Hunting here" : "You're here"}))
      .concat(lv.hunt ? [{key: "boss", name: lv.hunt.bossName, lock: lv.bossReady ? "" : "win more hunts here first", lockShort: "Not yet", note: lv.bossReady ? "Fight " + lv.hunt.bossName : ""}] : [])
      .concat(lv.tower ? lv.tower.ranks.filter((r) => r.n).map((r) => ({key: "rank:" + r.n, name: r.name, lock: r.done || r.next ? "" : "a rank at a time", lockShort: "Later",
        note: r.done ? "✓ Yours" : r.next ? (r.ready ? "Duel" : "Not ready yet") : ""})) : []);
    host.innerHTML = `
      <div class="pp-page">
        <p class="pp-status" id="pp-status">${esc(status)}</p>
        ${painted ? `<div class="pp-land-painted">${paintedHTML(id, lv.open ? paintedPlaces : [])}${lv.open ? "" : `<div class="pp-land-locked">🔒 ${esc(lv.lock)}</div>`}</div>`
          : `<div class="pp-arena pp-land arena-${esc(id)}">
          ${sceneSVG(id)}
          <div class="pp-land-title"><b>${esc(lv.name)}</b></div>
          ${lv.open ? pins : `<div class="pp-land-locked">🔒 ${esc(lv.lock)}</div>`}
        </div>`}
        ${lv.job && lv.doing.some((k) => k === "gather" || k === "hunt") ? `<div class="pp-land-now">
            <div class="pp-land-trip" id="pp-land-trip">${landTripHTML(lv, s, now)}</div>
            ${lv.job.hunt ? `<button class="btn btn-sm" data-jump="pet:hunt">Watch</button>` : ""}
            <button class="btn btn-sm" id="pp-land-home">Come home</button></div>` : ""}
        ${painted ? `<div class="pp-land-bar">
            ${ex ? `<span>Out exploring — back in <b id="pp-explore-clock">${clock(ex.endsIn)}</b></span>`
              : `<button class="btn btn-primary" id="pp-explore" ${lv.busy || !lv.open ? "disabled" : ""} title="${esc(lv.busy || `${Math.round(lv.chance * 100)}% chance of finding something hidden`)}">Explore (${Math.round(lv.time / 60)} min)</button>`}
            <button class="btn" id="pp-secrets">Secrets ${lv.found}/${lv.total}</button>
            ${lv.hunt && lv.bossReady && lv.open ? `<button class="btn btn-primary pp-place-card boss" data-ground="${lv.hunt.id}">Fight ${esc(lv.hunt.bossName)}</button>` : ""}
          </div>` : ""}
        <section class="pp-shop pp-explore"${lv.tower || painted || !lv.total ? " hidden" : ""}>
          <div><b>Explore the ${esc(lv.name)}</b>
            <span class="stamp">${lv.found}/${lv.total} secrets found${lv.explored ? ` · explored ${lv.explored}×` : ""}</span></div>
          ${ex ? `<p>Out exploring — back in <b id="pp-explore-clock">${clock(ex.endsIn)}</b>.</p>`
            : `<p class="stamp">${allFound ? "You've found everything hidden here — exploring still turns up a few things from around." :
                `Half an hour out. ${Math.round(lv.chance * 100)}% chance of finding something hidden — better every time you come back empty-handed, and a fox, dog, wolf, mole or hare at your side sniffs things out.`}</p>
              <button class="btn btn-primary" id="pp-explore" ${lv.busy ? "disabled" : ""}>Explore (${Math.round(lv.time / 60)} min)</button>
              ${lv.busy ? `<span class="stamp">${esc(lv.busy)}</span>` : ""}`}
        </section>
        ${lv.person && !painted ? personHTML(lv.person, lv.open) : ""}
        ${lv.tower ? `<section class="pp-shop pp-tower">
            <b>The mage tower</b> <span class="stamp">· you're ${esc(lv.tower.rankName === "Archmage" ? "the Archmage" : "a " + lv.tower.rankName)}</span>
            
            ${lv.tower.ranks.filter((r) => r.n).map((r) => `<div class="pp-recipe${r.done ? "" : r.next ? "" : " short"}">
                <img alt="" src="${monsterURL(r.duel, 32)}">
                <div class="pp-recipe-main"><div><b>${esc(r.name)}</b> <span class="stamp">· duel ${esc(r.mage)}${r.done ? " · ✓ yours" : ""}</span></div>
                  <div class="pp-needs">${r.needs.map((n) => `<span class="pp-need-chip${n.have >= n.need ? "" : " lack"}">${esc(n.skill)} ${n.have}/${n.need}</span>`).join("")}</div></div>
                ${r.next ? `<button class="btn btn-sm ${r.ready ? "btn-primary" : ""} pp-duel" ${r.ready ? "" : "disabled"}>Duel</button>`
                  : r.done ? `<button class="btn btn-sm pp-rematch" data-rematch="${r.n}" title="A practice duel: Magic xp and ${esc(r.rematch)}">Rematch</button>` : "<span></span>"}
              </div>`).join("")}
          </section>` : ""}
        ${lv.tower ? necroOfferHTML(s, now) : ""}
        <section class="pp-shop"${lv.tower || painted ? " hidden" : ""}>
          <b>Places</b>
          ${places.length ? `<div class="pp-village pp-places">${places.map((p, i) => {
            // Cam (2026-10-07): "the places ... to be the cards displayed other places. But just make them simple
            // without the list of what is there" -- an icon, a name, its level, and what a click does
            const line = p.lock ? `🔒 ${p.lock}` : p.here ? (p.kind === "hunt" ? "You're hunting here" : "You're here")
              : p.kind === "page" || p.kind === "shop" || p.kind === "sheet" ? "Go in" : p.kind === "rest" ? "Rest" : p.kind === "region" ? "Go there" : p.kind === "sail" ? "Set sail" : p.kind === "lair" ? "Fight" : p.kind === "spot" ? "Gather here" : p.kind === "hunt" ? "Hunt here" : p.kind === "exp" ? "Send a pet" : p.kind === "person" ? (p.ready ? "❗ A quest is ready" : "Talk") : "";
            return `<button class="pp-villager pp-place-card${p.lock ? " locked" : ""}${p.here ? " here" : ""}${p.kind === "person" ? " person" : ""}" data-i="${i}" ${lv.open ? "" : "disabled"}>
              <img alt="" src="${p.icon}">
              <b>${esc(p.name)}</b>
              <span class="stamp">${esc(p.kind === "person" ? "Lives here" : p.sub)}${p.secret ? " · found" : ""}</span>
              <span class="stamp pp-place-line">${esc(line)}</span></button>`;
          }).join("")}
          ${lv.hunt && lv.bossReady && lv.open ? `<button class="pp-villager pp-place-card boss" data-ground="${lv.hunt.id}">
              <img alt="" src="${monsterURL(lv.hunt.boss, 48)}"><b>${esc(lv.hunt.bossName)}</b><span class="stamp">The boss</span><span class="stamp pp-place-line">Fight</span></button>` : ""}
          </div>` : `<p class="stamp">Nothing here yet but vines.</p>`}
        </section>
        <section class="pp-shop"${lv.tower || painted || !lv.total ? " hidden" : ""}>
          <b>Secrets</b>
          <div class="pp-beasts">${lv.secrets.map((x) => x.found ? `<div class="pp-beast"><div><b>${x.kind === "egg" ? "🥚" : x.kind === "spot" ? "📍" : "💰"} ${esc(x.name)}</b></div>
              <div class="stamp">${esc(x.text)}</div></div>` : `<div class="pp-beast unknown"><b>???</b><div class="stamp">Still hidden</div></div>`).join("")}</div>
        </section>
      </div>`;
    const visit = (i) => { const p = places[i]; if (!p || !lv.open) return;
      if (p.kind === "person") { if (painted) return openPlace("person", id); const el = host.querySelector("#pp-person"); if (el) el.scrollIntoView({block: "center", behavior: "smooth"}); return; }
      if (p.ground && typeof openAreas !== "undefined") openAreas.add(p.ground); goTo(p.go); };
    // the region is where you do things now (2026-10-07): a pin or Gather starts a trip, Hunt here a hunt
    const doIt = async (i) => {
      const p = places[i];
      if (!p || !lv.open) return;
      if (p.kind === "page") return goTo(p.go);
      if (p.kind === "shop") {                                         // the mirage merchant, at the Oasis after dark
        const w = Core.villageView(s, now).find((x) => x.id === p.go.slice(5));
        if (!w) return toast(`${Core.WORKSHOPS[p.go.slice(5)].who} isn't here -- ${p.sub.toLowerCase()}.`, true);
        openShop = w.id; return showShop();
      }
      if (p.kind === "rest") { const r = await (p.go === "rest:inn" ? act("inn", {town: id}) : act("oasisrest")); if (r && r.error) { status = r.error; toast(r.error, true); render(); } return; }
      if (p.kind === "sheet") return openPlace(p.go.slice(6), id);
      if (p.kind === "region") { worldRegion = p.go.slice(1); status = ""; return render(); }
      if (p.kind === "lair") return fightBoss(p.go.slice(5));
      if (p.kind === "sail") { const r = await act("sail", {to: p.go.slice(5)}); if (r && r.error) { status = r.error; toast(r.error, true); render(); } else { worldRegion = ""; render(); } return; }
      // Cam (2026-10-08): a second click mustn't open the old skill page -- say so instead
      if (p.kind === "spot" && p.lock) return toast(`${p.name}: ${p.lock}`, true);
      // Cam (PT3, 2026-10-15): a hunting ground above your level says so -- it doesn't open the battle screen of the last one
      if (p.kind === "hunt" && p.lock) return toast(`${p.name}: needs ${p.lock.charAt(0).toLowerCase() + p.lock.slice(1)} -- you're combat level ${Core.combatLevel(s.player)}.`, true);
      if (p.kind === "spot" && p.here) return toast(`You're already gathering at the ${p.name}. "Come home" stops.`);
      if (p.kind === "person" || p.kind === "exp" || p.lock || p.here) return visit(i);
      const r = p.kind === "spot" ? await act("trip", {skill: p.skill, spot: p.spot, roll: Math.random()})
        : await act("hunt", {ground: p.ground, roll: Math.random()});
      if (r && r.error) { status = r.error; toast(r.error, true); render(); }
      else if (p.kind === "hunt") { if (typeof openAreas !== "undefined") openAreas.add(p.ground); goTo("pet:hunt"); }   // straight to the fight (2026-10-20, Cam: "you cant really idle hunt anymore")
    };
    host.querySelectorAll(".pp-pin, .pp-place-card[data-i]").forEach((b) => b.addEventListener("click", () => doIt(+b.dataset.i)));
    const fightBoss = async (ground) => {
      const r = await act("boss", {ground, roll: Math.random()});
      if (r && r.error) { status = r.error; toast(r.error, true); render(); } else goTo("pet:hunt");
    };
    host.querySelectorAll(".pp-place-card.boss").forEach((b) => b.addEventListener("click", () => fightBoss(b.dataset.ground)));
    if (painted) wirePainted(host, (key) => {
      if (key.startsWith("rank:")) {                                   // the mage tower: a floor's rank
        const r = lv.tower.ranks.find((x) => x.n === +key.slice(5));
        if (r && r.next && r.ready) { const d = host.querySelector(".pp-duel"); if (d) d.click(); return; }
        if (r && r.done) return rematchDuel(r.n);                      // a floor you've won: a practice duel (PT19 b5)
        return toast(r ? (r.done ? `${r.name}: that rank is yours.` : r.next ? `${r.name}: ` + r.needs.filter((n) => n.have < n.need).map((n) => `${n.skill} ${n.need}`).join(", ") + " first." : `${r.name}: win the ranks below first.`) : "", !r || !r.done);
      }
      if (key === "boss") { if (lv.bossReady) fightBoss(lv.hunt.id); else toast(`${lv.hunt.bossName} won't come out yet -- win more hunts here first.`, true); return; }
      const i = places.findIndex((p) => p.key === key);
      if (i >= 0) doIt(i);
    });
    const lh = host.querySelector("#pp-land-home");
    if (lh) lh.addEventListener("click", () => act("home"));
    host.querySelectorAll("[data-jump]").forEach((b) => b.addEventListener("click", () => goTo(b.dataset.jump)));
    host.querySelectorAll(".pp-rematch").forEach((b) => b.addEventListener("click", () => rematchDuel(+b.dataset.rematch)));
    host.querySelectorAll(".pp-duel").forEach((b) => b.addEventListener("click", async () => {
      const r = await act("rank", {roll: Math.random(), manual: bossMode && bossMode() === "manual"});
      if (r && r.error) { status = r.error; toast(r.error, true); render(); } else goTo("pet:hunt");
    }));
    const qb = host.querySelector("#pp-quest");
    if (qb) qb.addEventListener("click", async () => {
      const had = !!((current().s.quests || {}).quarry);
      const r = await act("quest", {region: id});
      if (r && r.error) { status = r.error; toast(r.error, true); render(); }
      else if (!had && (current().s.quests || {}).quarry) talkPopup("quarry");   // Ranger Ash explains the Bestiary (PT20 b1)
    });
    const sb = host.querySelector("#pp-secrets"); if (sb) sb.addEventListener("click", () => openPlace("secrets", id));
    if (painted) showSec();
    const exb = host.querySelector("#pp-explore");
    if (exb) exb.addEventListener("click", async () => {
      const r = await act("explore", {region: id, roll: Math.random()});
      if (r && r.error) { status = r.error; toast(r.error, true); render(); }
    });
    if (ex) exploreClock(host);
    if (lv.job && lv.doing.some((k) => k === "gather" || k === "hunt")) landTripClock(host, id);
    if (lv.tower) wireNecro(host);                                      // the Archmage's offer (Part 13)
  }

  // Cam (PT15 n1): "after beating a mage at the mage tower it should exit the battle screen then a pop up with some dialog from the
  // defeated mage, saying something along the lines of your training is paying off. The Dialogue should fit the mage rank." --
  // the battle screen hands a won duel here once the mage has fallen: back to the tower, and the mage's words (MAGE_RANKS beaten).
  const duelsSaid = new Set();
  function towerWords(lb, now) {
    if (!lb || !lb.duel || !lb.won || duelsSaid.has(lb.at) || now - lb.at < 1800 || now - lb.at > 60000) return false;
    duelsSaid.add(lb.at);
    const n = typeof lb.rank === "number" ? lb.rank : Core.MAGE_RANKS.findIndex((r) => r.duel === lb.mon), rk = Core.MAGE_RANKS[n];
    if (!rk || !rk.beaten) return false;
    worldRegion = "magetower"; seaChart = false; goTo("pet:world");
    const top = n === Core.MAGE_RANKS.length - 1, offerHere = n === (Core.NECRO.offerRank || Core.MAGE_RANKS.length - 1);
    const nv = offerHere && !lb.rematch ? Core.necroView(current().s, now) : null;
    const runes = Object.keys(lb.got || {}).map((k) => `${lb.got[k]} × ${esc(Core.ITEMS[k].name.toLowerCase())}`).join(", ");
    const box = document.createElement("div");
    box.className = "pp-modal";
    box.innerHTML = `<div class="pp-modal-card pp-mage-words" role="dialog" aria-label="${esc(Core.MONSTERS[lb.mon].name)}">
        <img class="pp-mage-pic" alt="" src="${monsterURL(lb.mon, 96)}">
        <div class="pp-label">${esc(Core.MONSTERS[lb.mon].name)}</div>
        ${lb.rematch ? `<p class="pp-said">${esc(rk.again)}</p><p class="stamp">A practice duel: Magic xp${runes ? " and " + runes : ""}.</p>`
          : `<p class="pp-said">${esc(rk.beaten)}</p>
        ${nv && nv.offered && !nv.taught && !nv.accepted ? `<p class="pp-said">${esc(nv.offer)}</p><p class="stamp">Answer her on the tower page -- yes, or no for now.</p>` : `<p class="pp-said">${esc(rk.again)}</p>`}
        <p class="stamp">You're ${top ? "the Archmage" : (/^[AEIOU]/.test(rk.name) ? "an " : "a ") + esc(rk.name)} of the mage tower now.</p>`}
        <div class="pp-row"><button class="btn pp-mage-again">Rematch</button><button class="btn btn-primary pp-modal-close">Close</button></div></div>`;
    document.body.appendChild(box);
    const shut = () => box.remove();
    box.querySelector(".pp-modal-close").addEventListener("click", shut);
    box.querySelector(".pp-mage-again").addEventListener("click", () => { shut(); rematchDuel(n); });
    box.addEventListener("click", (e) => { if (e.target === box) shut(); });
    box.querySelector(".pp-modal-close").focus();
    return true;
  }
  /** A practice duel with a mage you've beaten (PT19 b5). */
  async function rematchDuel(n) {
    const r = await act("rank", {rematch: n, roll: Math.random(), manual: typeof bossMode === "function" && bossMode() === "manual"});
    if (r && r.error) { status = r.error; toast(r.error, true); render(); } else goTo("pet:hunt");
  }
  // ---- the spellbook and the enchant book (2026-10-07, Cam: "spellbook added to the game with a list of spells
  //      that unlock at each level ... need to be equipped before a battle (magic loadout, the runes required)") ----
  function renderSpellbook(host) {                                       // (the Arcane's book, as a page -- the Library opens it as a pop-up; C4 D5)
    host.innerHTML = `<div class="pp-page"><section class="pp-shop gh-book">${classBookHTML("arcane")}</section></div>`;
    host.querySelectorAll("[data-jump]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.sheetTab) sheetTab = b.dataset.sheetTab; sheetFrom = "pet:skills"; goTo(b.dataset.jump); }));
  }
  // ---- the Spellbook as a reference (2026-10-15, Cam, Q1: "keep the spellbook in the library ... have it act like a pop up
  //      with what level each spell unlocks, what element damage it does and what runes it takes ... Setting spells should
  //      all happen on the player page") -- opened from the Library; choosing your three is the Character sheet's Combat tab
  const ELEMENTS = ["fire", "water", "earth", "air"];
  // by its name first ("Wind strike" is air, "Frost nova" water), else the element it takes most runes of
  const NAMED = [[/wind|storm|air/i, "Air"], [/water|frost/i, "Water"], [/earth|petrif|bind/i, "Earth"], [/fire|meteor/i, "Fire"]];
  function spellElement(x) {
    if (x.element) return x.element[0].toUpperCase() + x.element.slice(1) + " — " + elementDoes(x.element);   // the rules' own (Part 6)
    const nm = NAMED.find(([re]) => re.test(x.name));
    if (nm) return nm[1];
    const by = {}; x.runes.forEach((r) => { const e = r.id.replace(/rune$/, ""); if (ELEMENTS.includes(e)) by[e] = (by[e] || 0) + r.n; });
    const top = Object.keys(by).sort((a, b) => by[b] - by[a]), most = top.filter((e) => by[e] === by[top[0]]);
    return most.length ? most.map((e) => e[0].toUpperCase() + e.slice(1)).join(" and ") : "None";
  }
  // what each element does when it lands (Battle Re-work Part 6)
  function elementDoes(el) { return {fire: "may burn", water: "may slow", earth: "may break its guard", air: "may knock it off balance"}[el] || ""; }
  /** Every spell -- one list, in the Arcane's class book (C4 D5, 2026-10-16: the Library's Spellbook and the book were two). */
  /** The spells, for the Arcane's book. from/to: one page of them (the book's pages, 2026-10-17); the head and the button
   *  go on the first and the last page. */
  function spellbookRefHTML(from, to) {
    const {s} = current();
    const sb = Core.spellbookView(s), all = sb.spells.length;
    from = from || 0; to = to === undefined ? all : Math.min(all, to);
    sb.spells = sb.spells.slice(from, to);
    const runes = (x) => x.runes.map((r) => `<span class="pp-need-chip" data-iteminfo="${r.id}"><img alt="" src="${itemIcon(r.id, 16)}">${r.n} ${esc(Core.ITEMS[r.id].name.toLowerCase().replace(/ rune$/, ""))}</span>`).join("");
    return `${from ? "" : `<div class="pp-shop-head"><img class="pp-npc" alt="" src="${itemIcon("tomearcanist", 48)}"><div><b>Spellbook</b>
        <div class="stamp">Magic level ${sb.level} · ${esc(sb.rankName)} of the mage tower. Choose your ${sb.max === 3 ? "three" : sb.max} on your Character sheet (Combat).</div></div></div>`}
      <div class="pp-shop-list">${sb.spells.map((x) => `<div class="pp-recipe${x.lock && !/in hand$/.test(x.lock) ? " short" : ""}">
          <img alt="" src="${itemIcon(x.hidden ? "scrollmeteor" : (x.runes[x.runes.length - 1] || {id: "airrune"}).id, 32)}">
          <div class="pp-recipe-main">
            <div><b>${esc(x.name)}</b> <span class="stamp">· unlocks at Magic ${x.level}${x.hidden ? "" : ` · ${esc(spellElement(x))} · max hit ${x.maxHit} at your level`}${x.equipped ? " · <b>in your three</b>" : ""}</span></div>
            ${x.about ? `<div class="stamp">${esc(x.about)}</div>` : ""}
            ${x.hidden ? "" : `<div class="pp-needs">${runes(x)}</div>`}
            ${x.lock ? `<div class="stamp pp-lock">${esc(x.lock)}</div>` : ""}
          </div><span></span></div>`).join("")}</div>
      ${to < all ? "" : `<div class="pp-row"><button class="btn btn-primary" data-jump="pet:skills" data-sheet-tab="combat">Choose your spells ›</button></div>`}`;
  }
  function renderEnchants(host) {
    const {s} = current();
    const eb = Core.enchantBookView(s);
    host.innerHTML = `
      <div class="pp-page">
        <p class="stamp" style="margin:0 0 12px">Enchants are rare: each is learnt from a tome found only in <b>ancient chests</b>. Put them on things at the
          <b>enchanting table</b> in your library (Enchanting level ${eb.level}) -- tools, armour and weapons, jewellery, or your pet's gear. An enchant goes on every one of that kind of thing you own.</p>
        <div class="pp-beasts">${eb.list.map((e) => e.known ? `<div class="pp-beast"><div><img alt="" src="${itemIcon("tome" + e.id, 24)}" style="vertical-align:middle"> <b>${esc(e.name)}</b></div>
            <div class="stamp">${esc(e.about)} · on ${esc(e.slots.join(", ").toLowerCase())} · Enchanting ${e.level}</div>
            <div class="stamp">${e.on.length ? "On: " + esc(e.on.join(", ")) : "Not on anything yet"}</div></div>`
          : `<div class="pp-beast unknown"><b>???</b><div class="stamp">${esc(e.about)} · Enchanting ${e.level}</div></div>`).join("")}</div>
        <p><button class="btn" data-jump="shop:enchanting">To the enchanting table ›</button></p>
      </div>`;
    host.querySelectorAll("[data-jump]").forEach((b) => b.addEventListener("click", () => goTo(b.dataset.jump)));
  }

  // ---- the Herbarium (2026-10-06, Cam: "Herblore skill can be used to catalog unidentifed herbs ...
  //      Once they are identified you can then use them for potions at the apothacery table.") ----
  function renderHerbarium(host) {
    const {s} = current();
    const hv = Core.herbariumView(s);
    host.innerHTML = `
      <div class="pp-page">
        <p class="stamp" style="margin:0 0 12px">Herbs turn up unidentified — foraging, digging, and in your herb pots. Name them at the
          <b>Herb table</b> (Herblore) and they go in here; then brew with them at the <b>Apothecary table</b> (Alchemy).
          A herb you've identified grows as itself in a pot. Catalogue a whole tier and its herbs come up in twos more often;
          catalogue all ${hv.total} and you're a <b>master herbalist</b> — every 8th potion you brew is free.</p>
        <p class="pp-status">Herblore level ${hv.level} · ${hv.found} of ${hv.total} herbs${hv.master ? " · master herbalist" : ""}${hv.unid ? ` · ${hv.unid} unidentified in your bag` : ""}</p>
        ${hv.tiers.map((t) => `<div class="pp-group"><div class="pp-label">Tier ${ROMAN[t.tier - 1]} · Herblore ${t.level}${t.complete ? " · complete ✓" : ""}</div>
          <div class="pp-beasts">${t.herbs.map((h) => h.known ? `
            <div class="pp-beast"><div><img alt="" src="${itemIcon(h.id, 24)}" style="vertical-align:middle"> <b>${esc(h.name)}</b></div>
              <div class="stamp">Identified ${h.count}</div>
              <div class="stamp">${h.uses.length ? "Brews: " + esc(h.uses.join(", ")) : "Not in any potion — but the merchant likes it"}</div></div>`
            : `<div class="pp-beast unknown"><b>???</b><div class="stamp">Not identified yet</div></div>`).join("")}</div>
          <div class="stamp" style="margin:6px 0 18px">Found: ${esc(t.where.join(" · "))}</div></div>`).join("")}
      </div>`;
  }

  // ---- the Graveyard (2026-10-06, Cam: "Have a graveyard feature that shows dead pets, how they
  //      died and their age. Think rouge like.") ------------------------------------------------
  // ---- the Farm (2026-10-12): Fern and her quest, then Cam's painting of the Farm with a scroll for every place, and below it
  //      a card for each building, the Feed store, and Fern's stall (with Saturday's farmers' market). Animals walk about on the
  //      painting (step 9): each building's own, in its yard.
  const RANCH_WALK = {coop: [[90, 470], [290, 470], 55], pond: [[60, 1062], [300, 1062], 52], barn: [[790, 492], [990, 492], 120],
                      shearing: [[1580, 470], [1760, 470], 92], sty: [[700, 768], [900, 768], 92], stable: [[1330, 345], [1640, 345], 115]};   // the horse field (the lower paddock is the Show ring now)
  const WALK_SIZE = {hen: 1, duck: 1, cow: 1, goat: 0.78, sheep: 1, pig: 1, pony: 0.88, drafthorse: 1.08};
  function ranchWalkers(rv) {
    const out = [];
    rv.buildings.forEach((b) => {
      const z = RANCH_WALK[b.id];
      if (!z || !b.tier) return;
      b.animals.slice(0, 3).forEach((a, i) => {
        const size = Math.round(z[2] * (WALK_SIZE[a.kind] || 1) * (a.young ? 0.6 : 1));
        const span = z[1][0] - z[0][0] - size, x = z[0][0] + Math.round(span * ((i * 0.37 + 0.1) % 0.6)), y = z[0][1] - size + i * 6;
        const pics = (window.LIVESTOCK_PICS || {})[a.art] || {}, pose = pics.walk ? "walk" : "a";
        if (!pics[pose]) return;
        out.push(`<g class="pp-walker" style="--d:${Math.max(30, Math.round(span * 0.4))}px;animation-duration:${14 + i * 5}s;animation-delay:-${i * 4}s">
          <image href="art/livestock/${a.art.replace("/", "-")}-${pose}.webp" x="${x}" y="${y}" width="${size}" height="${size}"/></g>`);
      });
    });
    return out.length ? `<g class="pp-walkers" aria-hidden="true">${out.join("")}</g>` : "";
  }
  /** The painting's places, with what's going on at each. */
  function ranchPlaces(rv) {
    const place = (b) => !b.tier ? (b.lock ? {key: b.id, name: b.name, lock: `opens at ${b.lock}`, lockShort: b.lock} : {key: b.id, name: b.name, note: "Build it", ready: !!(b.next && b.next.can)})
      : b.show ? {key: b.id, name: b.name, note: b.show.done ? "" : b.show.entrants.length ? "A show today" : "", ready: !b.show.done && !!b.show.entrants.length}
      : b.make && !b.kinds.length ? {key: b.id, name: b.name, note: b.make.some((m) => m.times) ? (b.id === "mill" ? "Ready to grind" : "Ready to churn") : ""}
      : b.slots ? {key: b.id, name: b.name, note: b.waiting ? `${b.waiting} ready` : b.slots.length ? `${b.slots.length} setting` : "Empty shelves", ready: !!b.waiting}
      : b.pairs ? {key: b.id, name: b.name, note: b.pairs.length ? `${b.pairs.length} pair${b.pairs.length === 1 ? "" : "s"} out` : rv.pairable.length ? "A pair to put out" : ""}
      : {key: b.id, name: b.name, note: b.waiting ? `${b.waiting} ready` : b.hungry ? "Hungry" : !b.animals.length ? "Empty" : b.clean ? "" : "Needs mucking out", ready: !!b.waiting || !!b.hungry};
    return rv.buildings.map(place).concat([
      {key: "feed", name: "Feed store", note: `${rv.feed} feed · ${rv.hay} hay`},
      {key: "stall", name: "Fern's stall", note: rv.market.open ? "Market day!" : rv.fern && rv.fern.quest && rv.fern.quest.can ? "Fern has an errand" : "", ready: rv.market.open},
      {key: "pet:estate", name: "Back to your estate"}]);
  }
  let ranchPick = {kind: "", a: "", b: ""};
  function renderRanch(host) {
    const {s, now} = current(), rv = Core.ranchView(s, now);
    const away = rv.here ? "" : "The Farm's back home on your estate -- you can't tend it from here.";
    const needChip = (n) => `<span class="pp-need-chip${n.have >= n.need ? "" : " lack"}" data-iteminfo="${n.id}"><img alt="" src="${itemIcon(n.id, 16)}">${esc(n.name)} ${Math.min(n.have, 999)}/${n.need}</span>`;
    const stars = (n) => n ? ` <span class="pp-rarity r-rare" title="Bred for yield: a little more, more often">${"★".repeat(n)}</span>` : "";
    const animalRow = (a) => `<div class="pp-recipe pp-ranch-animal${a.hungry ? " short" : ""}"><img alt="" src="${livestockURL(a.art, a.pic, 32)}"${a.hungry ? ` class="pp-hungry"` : ""}>
        <div class="pp-recipe-main"><div><b>${esc(a.name)}</b> <span class="stamp">${a.young ? "young " : ""}${esc(a.kindName.toLowerCase())}${a.breed ? ` · ${esc(a.breed)}` : ""}</span>${stars(a.stars)}</div>
          <div class="stamp">${a.young ? `Growing up -- ${clock(a.young)} to go` : a.pairing ? "Out in the Paddock" : a.hungry ? "Hungry -- feed and it'll give again"
            : a.free ? (a.full ? "Busy among the flowers · full up -- collect what's waiting" : `Busy among the flowers · more in ${clock(a.nextIn)}`)
            : a.full ? `Fed for ${clock(a.fedFor)} · full up -- collect what's waiting` : `Fed for ${clock(a.fedFor)} · more in ${clock(a.nextIn)}`}${a.wins ? ` · ${a.wins} first${a.wins === 1 ? "" : "s"} in the ring` : ""}</div></div>
        <button class="btn btn-sm btn-quiet" data-ranch-sell="${a.id}" data-name="${esc(a.name)}" title="Fern takes it back for ${a.sell} coins" ${a.pairing ? "disabled" : ""}>Sell · ${coinTxt(a.sell)}</button></div>`;
    const buildCard = (b) => b.next ? `<div class="pp-area"><div class="pp-skill-head"><b>${b.tier ? `Build it ${esc(b.next.name.toLowerCase())}` : `Build the ${esc(b.name.toLowerCase())}`}</b><span class="pp-level">${
            b.next.slots ? `${b.next.cap} ${({glass: "beds", smoke: "racks"})[b.id] || "shelves"} · ` : b.next.pairs ? `room for ${b.next.cap} pair${b.next.cap === 1 ? "" : "s"} · ` : b.next.cap ? `room for ${b.next.cap} · a round every ${b.next.hours} h · ` : ""}+${b.next.xp} Construction xp</span></div>
            <div class="pp-needs"><span class="pp-need-chip${rv.hus >= b.next.hus ? "" : " lack"}">Husbandry ${b.next.hus}</span><span class="pp-need-chip${(Core.levelOf(s.player.skills.construction || 0)) >= b.next.con ? "" : " lack"}">Construction ${b.next.con}</span>
              <span class="pp-need-chip${(s.coins || 0) >= b.next.coins ? "" : " lack"}">${coinTxt(b.next.coins)}</span>${b.next.needs.map(needChip).join("")}</div>
            <button class="btn btn-sm ${b.next.can ? "btn-primary" : ""}" data-ranch="ranchbuild" data-b="${b.id}" ${b.next.can && !away ? "" : "disabled"}>Build</button></div>` : "";
    const head = (b, right) => `<div class="pp-skill-head"><b>${esc(b.name)}</b><span class="pp-level">${right}</span></div>`;
    const unbuiltHTML = (b) => `<section class="pp-shop pp-ranch-b" id="pp-ranch-${b.id}">${head(b, b.lock ? `🔒 ${esc(b.lock)}` : "Not built")}${b.lock ? "" : buildCard(b)}</section>`;
    const BENCH = {dairy: ["the butter churn", "Churn"], hives: ["the candle bench", "Make"], mill: ["the millstones", "Grind"]};   // the Farm's benches
    // the Farm's benches, lists and stall in the crafting bench's look (2026-10-20): a grid, the one you picked, an amount, the button
    const reqs = (m) => m.needs.map((n) => gbMat(n.id, `${esc(n.name)} ${Math.min(n.have, 999)}/${n.need}`, n.have >= n.need)).join("");
    const makeDetail = (m, verb, attrs) => gbHead(itemIcon(m.make, 64), `${m.n} × ${esc(m.name)}`, [m.times ? `enough for ${m.times}` : ""])
      + `<div class="pp-label">Materials</div>${reqs(m)}${m.times > 1 ? gbAmountHTML(attrs + m.i, Math.min(50, m.times), Math.min(50, m.times)) : ""}
      <button class="btn btn-primary pp-bmake" ${attrs}="${m.i}" data-times="amt" ${m.times && !away ? "" : "disabled"}>${verb.toUpperCase()}</button>`;
    const benchList = (b) => gridBenchHTML("ranch:" + b.id, [{id: "make", label: BENCH[b.id][0], items: (b.make || []).map((m) => ({key: String(m.i), icon: itemIcon(m.make, 48), name: `${m.n} × ${m.name}`, badge: m.times || "", can: !!m.times, m}))}],
      (it) => makeDetail(it.m, BENCH[b.id][1], `data-b="${b.id}" data-ranch-churn`));
    const churnHTML = (b) => `<section class="pp-shop pp-ranch-b" id="pp-ranch-${b.id}">${head(b, BENCH[b.id][0])}${benchList(b)}</section>`;
    const showHTML = (b) => `<section class="pp-shop pp-ranch-b" id="pp-ranch-${b.id}">${head(b, b.show.done ? `next show in ${clock(b.show.nextIn)}` : "a show today")}
        ${b.show.shows ? `<p class="stamp">${b.show.shows} show${b.show.shows === 1 ? "" : "s"}, ${b.show.firsts} first${b.show.firsts === 1 ? "" : "s"}</p>` : ""}
        ${b.show.entrants.length ? b.show.entrants.map((a) => `<div class="pp-recipe${b.show.done ? " short" : ""}"><img alt="" src="${livestockURL(a.art, a.pic, 32)}">
          <div class="pp-recipe-main"><div><b>${esc(a.name)}</b> <span class="stamp">${esc(a.kindName.toLowerCase())}${a.champion ? " · champion" : a.wins ? ` · ${a.wins} first${a.wins === 1 ? "" : "s"}` : ""}</span></div>
            <div class="stamp">The judges' eye: ${a.score} · about ${a.odds}% for first</div></div>
          <button class="btn btn-sm" data-ranch-show="${a.id}" ${b.show.done || away ? "disabled" : ""}>Show</button></div>`).join("")
          : `<p class="stamp">Nobody to show yet: a grown animal, not out in the Paddock.</p>`}</section>`;
    const SHELF = {culture: ["Set it", "shelves"], glass: ["Plant", "beds"], smoke: ["Hang it", "racks"]};
    const cultureHTML = (b) => `<section class="pp-shop pp-ranch-b" id="pp-ranch-${b.id}">${head(b, `${esc(b.tierName)} · ${b.slots.length}/${b.cap} ${SHELF[b.id][1]}`)}
        ${b.slots.length ? `<div class="pp-needs">${b.slots.map((x) => `<span class="pp-need-chip"><img alt="" src="${itemIcon(x.make, 16)}">${x.n} × ${esc(x.name)} · ${x.done ? "ready" : clock(x.endsIn)}</span>`).join("")}</div>` : ""}
        <div class="pp-place-btns"><button class="btn ${b.waiting ? "btn-primary" : ""}" data-ranch="ranchcollect" data-b="${b.id}" ${b.waiting && !away ? "" : "disabled"}>${b.waiting ? `Take ${b.waiting} ready` : "Nothing ready yet"}</button></div>
        ${gridBenchHTML("ranch:" + b.id, [{id: "rec", label: "What to " + SHELF[b.id][0].toLowerCase(), items: b.recipes.map((m) => ({key: String(m.i), icon: itemIcon(m.make, 48), name: `${m.n} × ${m.name}`, corner: m.hours + "h", lock: !!m.lock, can: m.can && b.free, m}))}], (it) => { const m = it.m;
          return gbHead(itemIcon(m.make, 64), `${m.n} × ${esc(m.name)}`, [`${m.hours} hours`, m.lock ? "🔒 " + esc(m.lock) : "", b.free ? "" : `no free ${SHELF[b.id][1].replace(/s$/, "")}`])
            + `<div class="pp-label">It takes</div>${reqs(m)}<button class="btn btn-primary pp-bmake" data-ranch-culture="${m.i}" data-b="${b.id}" ${m.can && b.free && !away ? "" : "disabled"}>${SHELF[b.id][0].toUpperCase()}</button>`; })}
        ${buildCard(b)}</section>`;
    const paddockHTML = (b) => {
      const grp = rv.pairable.find((g) => g.kind === ranchPick.kind) || rv.pairable[0];
      if (grp && ranchPick.kind !== grp.kind) ranchPick = {kind: grp.kind, a: "", b: ""};
      const opt = (sel) => grp.animals.map((a) => `<option value="${a.id}" ${sel === a.id ? "selected" : ""}>${esc(a.name)}${a.stars ? " " + "★".repeat(a.stars) : ""}</option>`).join("");
      return `<section class="pp-shop pp-ranch-b" id="pp-ranch-${b.id}">${head(b, `${esc(b.tierName)} · ${b.pairs.length}/${b.cap} pairs`)}
        ${b.pairs.map((p) => `<p>${esc(p.names.join(" and "))} (${esc(p.kindName.toLowerCase())}s) -- ${p.waiting ? "the young one's waiting for room at home" : `a young one in ${clock(p.endsIn)}`}.</p>`).join("")}
        
        ${b.free && grp ? `<div class="pp-place-btns">
            <select class="input" id="pp-pair-kind">${rv.pairable.map((g) => `<option value="${g.kind}" ${g.kind === grp.kind ? "selected" : ""}>${esc(g.plural)} (${g.days} day${g.days === 1 ? "" : "s"})</option>`).join("")}</select>
            <select class="input" id="pp-pair-a"><option value="">First…</option>${opt(ranchPick.a)}</select>
            <select class="input" id="pp-pair-b"><option value="">Second…</option>${opt(ranchPick.b)}</select>
            <button class="btn btn-primary" id="pp-pair-go" ${ranchPick.a && ranchPick.b && ranchPick.a !== ranchPick.b && !away ? "" : "disabled"}>Put them out</button></div>`
          : b.free ? `<p class="stamp">You need two grown animals of a kind that aren't out already.</p>` : ""}
        ${buildCard(b)}</section>`;
    };
    const eatsOf = (b) => [...new Set(b.animals.map((a) => (rv.stall.find((x) => x.kind === a.kind) || {}).eats))].filter(Boolean).map((x) => x.toLowerCase()).join(" or ");
    const buildingHTML = (b) => !b.tier ? unbuiltHTML(b) : b.show ? showHTML(b) : b.make && !b.kinds.length ? churnHTML(b) : b.slots ? cultureHTML(b) : b.pairs ? paddockHTML(b) : `<section class="pp-shop pp-ranch-b" id="pp-ranch-${b.id}">
        ${head(b, `${esc(b.tierName)} · ${b.animals.length}/${b.cap} · a round every ${b.hours} h`)}
        <div class="pp-place-btns">
          <button class="btn ${b.waiting ? "btn-primary" : ""}" data-ranch="ranchcollect" data-b="${b.id}" ${b.waiting && !away ? "" : "disabled"}>${b.waiting ? `Collect ${b.ready.map((x) => `${x.n} ${esc(x.name.toLowerCase())}${x.n > 1 && !/s$|wool|down|hair|milk|cream|butter|cheese|yoghurt|hay|feed|honey|wax/i.test(x.name) ? "s" : ""}`).join(", ")}` : "Nothing to collect yet"}</button>
          ${b.care ? `<button class="btn ${b.hungry ? "btn-primary" : ""}" data-ranch="ranchfeed" data-b="${b.id}" ${b.feedable && !away ? "" : "disabled"}>Feed ${b.feedable ? `(${b.feedable} × ${esc(eatsOf(b))})` : "-- they've eaten"}</button>
          <button class="btn" data-ranch="ranchclean" data-b="${b.id}" ${!b.clean && !away ? "" : "disabled"}>${b.clean ? `Clean for ${clock(b.cleanIn)}` : "Muck out"}</button>
          <button class="btn" data-ranch="ranchbrush" data-b="${b.id}" ${!b.brushed && b.animals.length && !away ? "" : "disabled"}>${b.brushed ? `Brushed for ${clock(b.brushIn)}` : "Brush"}</button>` : ""}
        </div>
        ${b.animals.length ? b.animals.map(animalRow).join("") : `<p class="stamp">Empty. Fern sells ${esc(b.kinds.map((k) => (rv.stall.find((x) => x.kind === k) || {}).name || k).join(" and ").toLowerCase())}s at her stall, below.</p>`}
        ${b.make ? `<div class="pp-label">${esc(BENCH[b.id][0])}</div>${benchList(b)}` : ""}
        ${buildCard(b)}</section>`;
    const painted = rv.open ? paintedHTML("ranch", ranchPlaces(rv)).replace(`<g class="pp-map-badges">`, `${ranchWalkers(rv)}<g class="pp-map-badges">`) : "";
    host.innerHTML = `
      <div class="pp-page">
        <p class="pp-status" id="pp-status">${esc(status)}</p>
        <p class="stamp pp-hub-say">${rv.open ? `Husbandry level ${rv.hus}${rv.helper ? " · " + esc(rv.helper) : ""}`
          : "Past the graveyard, an old farm track runs off into long grass: a fallen fence, a coop with no roof. Someone's leaning on the gate."}</p>
        ${painted}
        ${away ? `<section class="pp-shop"><p>${esc(away)}</p></section>` : ""}
        ${rv.open ? `<div class="pp-place-btns pp-ranch-all">
            <button class="btn ${rv.waiting ? "btn-primary" : ""}" data-ranch="ranchcollect" data-b="all" ${rv.waiting && !away ? "" : "disabled"}>Collect everything${rv.waiting ? ` (${rv.waiting})` : ""}</button>
            <button class="btn ${rv.hungry ? "btn-primary" : ""}" data-ranch="ranchfeed" data-b="all" ${rv.hungry && !away ? "" : "disabled"}>Feed everyone${rv.hungry ? ` (${rv.hungry} hungry)` : ""}</button></div>`
          + rv.buildings.map(buildingHTML).join("") + `
          <section class="pp-shop pp-ranch-feed" id="pp-ranch-feed"><b>Feed store</b> <span class="stamp">· crops from your garden into feed · ${rv.feed} grain feed and ${rv.hay} hay in your bag</span>
            ${gridBenchHTML("ranch:mill", [{id: "feed", label: "Feed", items: rv.mill.map((m) => ({key: String(m.i), icon: itemIcon(m.make, 48), name: `${m.n} × ${m.name}`, badge: m.times || "", can: !!m.times, m}))}], (it) => makeDetail(it.m, "Make", "data-ranch-mill"))}
          </section>
          <section class="pp-shop pp-ranch-stall" id="pp-ranch-stall"><b>Fern's stall</b> <span class="stamp">· “${esc(rv.fern.says)}”</span>
            ${rv.fern.quest ? `<p class="stamp">Fern has an errand: <b>${esc(rv.fern.quest.name)}</b>. ${esc(rv.fern.quest.text)}</p>
              <div class="pp-needs">${rv.fern.quest.needs.map((n) => `<span class="pp-need-chip${n.ok ? "" : " lack"}">${n.item ? `<img alt="" src="${itemIcon(n.item, 16)}">` : ""}${esc(n.text)} ${n.have}/${n.need}</span>`).join("")}</div>
              <p class="stamp">Reward: ${esc(rv.fern.quest.reward)}</p><button class="btn ${rv.fern.quest.can ? "btn-primary" : ""}" id="pp-quest" ${rv.fern.quest.can && !away ? "" : "disabled"}>${rv.fern.quest.can ? "Hand it in" : "Not ready yet"}</button>` : ""}
            ${gridBenchHTML("ranch:stall", [{id: "animals", label: "Animals", items: rv.stall.map((x) => ({key: x.kind, icon: livestockURL(x.art, x.pic, 48), name: x.name, corner: "", can: x.can, x}))},
              {id: "market", label: "The farmers' market", items: rv.market.open ? rv.market.goods.map((x) => ({key: "g" + x.id, icon: itemIcon(x.id, 48), name: x.name, badge: x.have, can: true, g: x})) : [],
               empty: rv.market.open ? "Nothing from the Farm in your bag to sell." : "Saturdays: Fern's stall turns market stall, and pays half as much again as Marlow for what the Farm makes."}], (it, tab) => {
              if (tab === "market") { const x = it.g; return gbHead(itemIcon(x.id, 64), esc(x.name), [`${x.have} in your bag`, eachTxt(x.each)]) + `<button class="btn btn-primary pp-bmake" data-ranch-market="${x.id}">SELL ALL · ${coinTxt(x.all)}</button>`; }
              const x = it.x;
              return gbHead(livestockURL(x.art, x.pic, 64), esc(x.name), [coinTxt(x.price), "lives in the " + esc(x.home.toLowerCase())])
                + `<p class="stamp">${esc(x.gives)} every ${x.every} hours${x.eats ? ` while fed -- eats ${esc(x.eats.toLowerCase())}` : " -- fetches its own flowers"}.</p>${x.why ? `<p class="stamp">${esc(x.why)}</p>` : ""}
                <button class="btn btn-primary pp-bmake" data-ranch-buy="${x.kind}" ${x.can && !away ? "" : "disabled"}>BUY · ${coinTxt(x.price)}</button>`; })}
          </section>` : personHTML(rv.fern, rv.here)}
      </div>`;
    const doIt = async (a, o) => { const r = await act(a, o); if (r && r.error) { status = r.error; toast(r.error, true); render(); } };
    host.querySelectorAll("[data-ranch]").forEach((b) => b.addEventListener("click", () => doIt(b.dataset.ranch, {building: b.dataset.b})));
    host.querySelectorAll("[data-ranch-mill]").forEach((b) => b.addEventListener("click", () => doIt("ranchmill", {i: +b.dataset.ranchMill, times: b.dataset.times === "amt" ? gbAmount(b) : b.dataset.times})));
    host.querySelectorAll("[data-ranch-churn]").forEach((b) => b.addEventListener("click", () => doIt("ranchchurn", {building: b.dataset.b || "dairy", i: +b.dataset.ranchChurn, times: b.dataset.times === "amt" ? gbAmount(b) : b.dataset.times})));
    host.querySelectorAll(".pp-gbench").forEach((g) => gridBenchWire(host, g.dataset.gb, render));   // (2026-10-20)
    host.querySelectorAll("[data-ranch-culture]").forEach((b) => b.addEventListener("click", () => doIt("ranchculture", {building: b.dataset.b || "culture", i: +b.dataset.ranchCulture})));
    host.querySelectorAll("[data-ranch-show]").forEach((b) => b.addEventListener("click", () => doIt("ranchshow", {id: b.dataset.ranchShow, roll: Math.random()})));
    host.querySelectorAll("[data-ranch-market]").forEach((b) => b.addEventListener("click", () => doIt("ranchmarket", {id: b.dataset.ranchMarket, n: "all"})));
    host.querySelectorAll("[data-ranch-buy]").forEach((b) => b.addEventListener("click", () => doIt("ranchbuy", {kind: b.dataset.ranchBuy})));
    host.querySelectorAll("[data-ranch-sell]").forEach((b) => b.addEventListener("click", async () => {
      if (await askYes(`Sell ${b.dataset.name} back to Fern?`)) doIt("ranchsell", {id: b.dataset.ranchSell}); }));
    const pk = host.querySelector("#pp-pair-kind"); if (pk) pk.addEventListener("change", () => { ranchPick = {kind: pk.value, a: "", b: ""}; render(); });
    ["a", "b"].forEach((k) => { const el = host.querySelector("#pp-pair-" + k); if (el) el.addEventListener("change", () => { ranchPick[k] = el.value; render(); }); });
    const pg = host.querySelector("#pp-pair-go"); if (pg) pg.addEventListener("click", () => { const o = {a: ranchPick.a, b: ranchPick.b, roll: Math.random(), roll2: Math.random()}; ranchPick.a = ranchPick.b = ""; doIt("ranchpair", o); });
    const qb = host.querySelector("#pp-quest"); if (qb) qb.addEventListener("click", () => doIt("quest", {region: "ranch"}));
    wirePainted(host, (k) => {                                     // a scroll on the painting: its card below
      if (k === "pet:estate") return goTo(k);
      const el = host.querySelector(k === "feed" ? "#pp-ranch-feed" : k === "stall" ? "#pp-ranch-stall" : "#pp-ranch-" + k);
      if (el) el.scrollIntoView({block: "start", behavior: "smooth"});
    });
  }
  function renderGraveyard(host) {
    const {s} = current();
    const dead = Core.graveyardView(s);
    host.innerHTML = `
      <div class="pp-page">
        ${paintedHTML("graveyard", [{key: "graves", name: "Headstones", note: dead.length ? `${dead.length} remembered` : ""}, {key: "bench", name: "The willow bench"}]
          .concat(Core.necroView(s, Date.now()).taught ? [{key: "circle", name: "The Necromancer's circle", note: "Raise on a headstone"}, {key: "crypt", name: "The crypt", note: "Your risen"}]
            : [{key: "circle", name: "The Necromancer's circle", lock: "a Necromancer's place", lockShort: "Locked"}, {key: "crypt", name: "The crypt", lock: "a Necromancer's place", lockShort: "Locked"}]))}
        <p class="stamp" style="margin:0 0 12px">The pets lost on expeditions. The later areas — the Dungeons and beyond — can take
          a pet that falls; what it wore goes with it. Whatever it found still came home.</p>
        ${dead.length ? `<div class="pp-graves">${dead.map((g, i) => `
          <div class="pp-grave">
            <img class="pp-grave-pet" alt="" src="${petURL(g.species, g.colour, 64)}">
            <div class="pp-grave-text">
              <b>${esc(g.name)}</b> <span class="stamp">${esc(g.kind)} · ${esc(g.rarity)}</span>
              <div>Level ${g.level} · ${g.ageDays} day${g.ageDays === 1 ? "" : "s"} old</div>
              <div class="pp-grave-cause">${esc(g.cause.charAt(0).toUpperCase() + g.cause.slice(1))}.</div>
              <div class="stamp">${esc(new Date(g.at).toLocaleString())}${g.gear && g.gear.length ? ` · lost with it: ${esc(g.gear.join(", "))}` : ""}</div>
              ${graveRaiseHTML(s, i, Date.now())}
            </div>
          </div>`).join("")}</div>`
        : `<p class="pp-why">No graves yet. Every pet you've sent out has come home.</p>`}
        ${necroGroundHTML(s, Date.now())}
      </div>`;
    wireNecro(host);                                                    // the Necromancer's ground (Part 13)
    wirePainted(host, (k) => {
      if (k === "circle" || k === "crypt") { const g = host.querySelector(".pp-necro-ground"); if (g) return g.scrollIntoView({block: "start", behavior: "smooth"}); return toast("An old gate, chained -- this is a Necromancer's place. Sorceress Nyx could teach you."); }   // (Part 13, Cam's repaint)
      if (k === "bench") return toast(dead.length ? "You sit a while under the willow, and remember them." : "You sit a while under the willow. It's quiet -- every pet came home.");
      const el = host.querySelector(".pp-graves") || host.querySelector(".pp-why"); if (el) el.scrollIntoView({block: "center", behavior: "smooth"});
    });
  }

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
  // ---- the Marketplace (2026-10-17) -----------------------------------------------------------------------------------------
  //      V4 + Cam's Q4: a market street off the Village. Everyone buys and sells; a Thief (or anyone with the Pickpocketing
  //      technique) picks pockets in the crowd and lifts goods from the stalls -- Larceny. The UX lead's ask: one map, and a
  //      click on a stall opens ONE card where you buy, sell and steal -- no second shop screen.
  let marketCard = "";
  function renderMarket(host) {
    const {s, now} = current(), mv = Core.marketView(s, now);
    const mins = (ms) => ms >= 60000 ? `${Math.ceil(ms / 60000)} min` : `${Math.ceil(ms / 1000)} s`;
    const spots = mv.stores.map((st) => ({key: st.id, name: `${st.keeper} -- ${st.name}`, here: st.here, hereText: "Working it",
      note: mv.canSteal ? (st.watchLeft ? "Watching you" : st.stock < 1 ? "Picked clean" : "") : st.sellPerk || st.buyPerk ? "A good price for you" : ""}))
      .concat([{key: "crowd", name: "The crowd -- pockets to pick", here: mv.marks.some((m) => m.here), hereText: "Working the crowd", note: mv.canSteal ? "" : ""},
               {key: "fence", name: `${mv.fence.name} -- ${mv.fence.where}`, note: mv.fence.worth ? `Swag: ${mv.fence.pays} for you` : ""},
               {key: "guard", name: `${mv.guard.name} -- the watch post`, note: mv.canSteal && mv.caught ? `Caught ${mv.caught}/${mv.banAfter}` : ""}]);
    host.innerHTML = `
      <div class="pp-page mk-page">
        <p class="pp-status" id="pp-status">${esc(status)}</p>
        ${mv.island ? `<p class="stamp">You're away from the main island -- the Marketplace is here when you're home.</p>` : ""}
        ${mv.banLeft ? `<p class="pp-why"><b>${esc(mv.guard.name)} threw you out of the market</b> -- back in ${mins(mv.banLeft)}. No buying, selling or anything else till then.</p>` : ""}
        ${mv.stunLeft ? `<p class="pp-why">You're still seeing stars -- ${mins(mv.stunLeft)}.</p>` : ""}
        ${paintedHTML("market", spots)}
        <section class="pp-shop mk-head">
          <div class="pp-shop-head"><img class="pp-npc" alt="" src="${avatarURL(mv.guard.look, 64)}">
            <div><b>${esc(mv.guard.name)}</b> <span class="stamp">${esc(mv.guard.title)}</span><div class="stamp">“${esc(mv.guard.says)}”</div></div></div>
          <div class="pp-row">${mv.canSteal ? `<span class="pp-level">Larceny ${mv.level}</span>
              <span class="stamp">Click a stall to buy, sell or steal; the crowd for pockets. Caught: a fine, a stun, and that keeper watches you -- ${mv.banAfter} catches in a quarter of an hour and the watch throws you out for an hour.</span>`
            : `<span class="stamp">Click a stall to buy and sell. ${mv.thief ? "" : "Thieves pick pockets and lift goods here -- or any class with the Pickpocketing technique slotted."}</span>`}</div>
          ${mv.fence.worth ? `<div class="pp-row"><span class="stamp"><b>Your swag sack</b>: worth ${mv.fence.worth} -- ${esc(mv.fence.name)} pays ${mv.fence.pays} (her cut: ${Math.round(mv.fence.cut * 100)}%).</span>
              <button class="btn btn-sm" data-mkcard="fence">To ${esc(mv.fence.where)}</button></div>` : ""}
          ${mv.job ? `<div class="pp-row mk-job"><span class="stamp"><b>Working the ${esc(mv.job.name.replace(/^A /, "").toLowerCase())}</b> while you're away: ${mv.job.count} good tr${mv.job.count === 1 ? "y" : "ies"}, ${mv.job.coins} coins${mv.job.caught ? `, caught ${mv.job.caught}` : ""}.</span>
              <button class="btn btn-sm" id="mk-stop">Stop</button></div>` : ""}
          <div class="pp-row mk-list">${mv.stores.map((st) => `<button class="btn btn-sm" data-mkcard="${st.id}">${esc(st.name)}</button>`).join(" ")}
            <button class="btn btn-sm" data-mkcard="crowd">The crowd</button></div>
        </section>
      </div>`;
    const err = (r) => { if (r && r.error) { status = r.error; toast(r.error, true); const el = host.querySelector("#pp-status"); if (el) el.textContent = status; } return r; };
    wirePainted(host, (k) => openMarketCard(k));
    host.querySelectorAll("[data-mkcard]").forEach((b) => b.addEventListener("click", () => openMarketCard(b.dataset.mkcard)));
    const stop = host.querySelector("#mk-stop"); if (stop) stop.addEventListener("click", async () => err(await act("home", {})));
  }
  /** One card for a stall (buy, sell, steal), the crowd (pockets) or the watch post (the rules). */
  function openMarketCard(key) {
    const {s, now} = current(), mv = Core.marketView(s, now);
    marketCard = key;
    document.querySelectorAll(".pp-item-sheet").forEach((x) => x.remove());
    const st = mv.stores.find((x) => x.id === key);
    const stealRow = (t) => !mv.canSteal ? "" : `<div class="pp-recipe${t.why ? " short" : ""}"><div class="pp-recipe-main">
        <b>${esc(t.name)}</b> <span class="stamp">Larceny ${t.level} · ${t.chance}% · +${t.xp} xp${t.kind === "mark" ? ` · ${t.coins[0]}-${t.coins[1]} coins` : ` · ${t.stock}/${t.cap} goods`} · fine ${t.fine}</span>
        ${t.why ? `<div class="stamp">${esc(t.why)}</div>` : ""}</div>
        <span class="pp-place-btns"><button class="btn btn-sm btn-primary" data-steal="${t.id}" ${t.why ? "disabled" : ""}>${t.kind === "mark" ? "Pick a pocket" : "Lift something"}</button>
          <button class="btn btn-sm" data-stealtrip="${t.id}" ${t.why ? "disabled" : ""} title="Keep trying while you're away -- slower than doing it yourself">${t.here ? "Working it ✓" : "Keep at it"}</button></span></div>`;
    let body = "";
    if (st) {
      body = `<div class="pp-sheet-head"><img alt="" src="${avatarURL(st.look, 64)}"><div><b>${esc(st.keeper)}</b><div class="stamp">${esc(st.name)} -- “${esc(st.says)}”</div></div></div>
        ${st.buyPerk || st.sellPerk ? `<p class="pp-boost">${esc([st.buyPerk, st.sellPerk].filter(Boolean).join(" · "))}</p>` : ""}
        ${mv.canSteal ? `<div class="pp-label">Steal</div>${stealRow(st)}` : ""}
        ${gridBenchHTML("market:" + st.id, [{id: "buy", label: "Buy", items: st.sells.map((x) => ({key: "b" + x.id, icon: itemIcon(x.id, 48), name: x.name, corner: x.price, can: (s.coins || 0) >= x.price, x}))},
          st.buys ? {id: "sell", label: "Sell", items: st.buys.map((x) => ({key: "s" + x.id, icon: itemIcon(x.id, 48), name: x.name, badge: x.have, can: true, x})), empty: `Nothing in your bag ${st.keeper} wants -- ${st.buysWhat}.`} : null], (it, tab) => { const x = it.x;
          if (tab === "buy") { const max = Math.max(0, Math.min(100, Math.floor((s.coins || 0) / Math.max(1, x.price))));
            return gbHead(itemIcon(x.id, 64), esc(x.name), [`${x.price.toLocaleString()} coin${x.price === 1 ? "" : "s"} each`]) + (max > 1 ? gbAmountHTML("mkb:" + st.id + x.id, max, 1) : "")
              + `<p class="stamp pp-bget">${max ? `Cost: <b data-gbeach="${x.price}" data-gbunit="coin">${coinTxt(x.price * Math.min(max, +(gbAmt["mkb:" + st.id + x.id] || 1)))}</b>` : "Not enough coins."}</p>
              <button class="btn btn-primary pp-bmake" data-mkbuy="${x.id}" data-n="amt" ${max ? "" : "disabled"}>BUY</button>`; }
          return gbHead(itemIcon(x.id, 64), esc(x.name), [`${x.have} in your bag`, `${x.each} each`]) + (x.have > 1 ? gbAmountHTML("mks:" + st.id + x.id, x.have, x.have) : "")
            + `<div class="pp-row"><button class="btn btn-primary pp-bmake" data-mksell="${x.id}" data-n="amt">SELL</button><button class="btn" data-mksell="${x.id}" data-n="all">All ${x.have}</button></div>`; })}`;
    } else if (key === "crowd") {
      body = `<div class="pp-sheet-head"><div><b>The crowd</b><div class="stamp">Farmhands, shoppers, merchants -- and their purses.</div></div></div>
        ${mv.canSteal ? mv.marks.map(stealRow).join("") : `<p class="stamp">Only a Thief picks pockets -- or another class with the Pickpocketing technique slotted (the Thief's Light fingers talent teaches it).</p>`}`;
    } else if (key === "fence") {
      const F = mv.fence;
      body = `<div class="pp-sheet-head"><img alt="" src="${avatarURL(F.look, 64)}"><div><b>${esc(F.name)}</b><div class="stamp">${esc(F.where)} -- “${esc(F.says)}”</div></div></div>
        
        ${F.items.length || F.coins ? `<div class="pp-needs">${F.coins ? `<span class="pp-need-chip">${F.coins} coins from purses</span>` : ""}${F.items.map((x) => `<span class="pp-need-chip"><img alt="" src="${itemIcon(x.id, 16)}">${x.n} × ${esc(x.name)}</span>`).join("")}</div>
          <p>Worth ${F.worth} -- she'll give you <b>${F.pays}</b>.</p><button class="btn btn-primary" id="mk-fence">Sell it all to ${esc(F.name.split(" ")[0])}</button>`
          : `<p class="stamp">Your swag sack's empty.</p>`}`;
    } else if (key === "guard") {
      body = `<div class="pp-sheet-head"><img alt="" src="${avatarURL(mv.guard.look, 64)}"><div><b>${esc(mv.guard.name)}</b><div class="stamp">${esc(mv.guard.title)} -- “${esc(mv.guard.says)}”</div></div></div>
        <p>Caught stealing: a fine, a short stun, and that stall's keeper watches you for a while. Caught ${mv.banAfter} times in a quarter of an hour and the watch throws you out of the market for an hour. Nobody gets hurt.</p>
        ${mv.canSteal ? `<p class="stamp">Caught lately: ${mv.caught} of ${mv.banAfter}.</p>` : ""}`;
    } else return;
    const box = document.createElement("div");
    box.className = "pp-modal pp-item-sheet mk-card";
    if (st) box.classList.add("pp-bench-modal");                           // a stall: the crafting bench's wide window (2026-10-20)
    box.innerHTML = `<div class="pp-modal-card pp-sheet${st ? " pp-shop-card" : ""}" role="dialog" aria-label="${esc(st ? st.name : key)}"><button class="btn btn-quiet btn-sm pp-shop-x" aria-label="Close">✕</button>${body}</div>`;
    document.body.appendChild(box);
    const close = () => { marketCard = ""; box.remove(); };
    box.addEventListener("click", (e) => { if (e.target === box) close(); });
    box.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
    box.querySelector(".pp-shop-x").addEventListener("click", close);
    const say = (r) => { if (r && r.error) toast(r.error, true); if (document.body.contains(box)) openMarketCard(key); };
    if (st) gridBenchWire(box, "market:" + st.id, () => openMarketCard(key));
    box.querySelectorAll("[data-mkbuy]").forEach((b) => b.addEventListener("click", async () => say(await act("market", {op: "buy", store: key, item: b.dataset.mkbuy, n: b.dataset.n === "amt" ? gbAmount(b) : +b.dataset.n}))));
    box.querySelectorAll("[data-mksell]").forEach((b) => b.addEventListener("click", async () => say(await act("market", {op: "sell", store: key, item: b.dataset.mksell, n: b.dataset.n === "all" ? "all" : b.dataset.n === "amt" ? gbAmount(b) : 1}))));
    box.querySelectorAll("[data-steal]").forEach((b) => b.addEventListener("click", async () => say(await act("steal", {target: b.dataset.steal}))));
    const fb = box.querySelector("#mk-fence"); if (fb) fb.addEventListener("click", async () => say(await act("fence", {})));
    box.querySelectorAll("[data-stealtrip]").forEach((b) => b.addEventListener("click", async () => say(await act("stealtrip", {target: b.dataset.stealtrip}))));
    const x = box.querySelector(".pp-shop-x"); if (x && !box.contains(document.activeElement)) x.focus();
  }
  // ---- the Kit: a side panel for your bag, gear and spells (Modernize/Reduce Nav, 2026-10-18) -------------------------------
  // Cam (N9): "A new side bar display for gear, spells loadout, ect. Which is changed via buttons on the side bar, also a small
  // version of the bag Think the runescape UI where you can change from each. This will allow a quick way to adjust a gear
  // loadout on the fly, conduct bag actions, now using right click for drop, use with etc (moving closing to rpg mo and
  // runescape) this will reduce navigation." The team's design (collab N10): docked on the right, three tabs; in the bag a
  // left click does the obvious thing and a right click opens the menu; the gear tab is your slots; the magic tab your loadout.
  // N22 (the Bag Overhaul, 2026-10-20, Cam: "The battle stances (Accurate, etc) Should be in a side bar option under the gear,
  // Skills should also be added to the side bar ... same as Old school runescape. So look to remove the buttons from fighting"):
  // a Combat tab (stances, your special, Run and the fight's other moves) and a Skills tab; in a fight the bag is how you eat,
  // change gear, drink and lay traps, and the panel is always there on the Hunting page (a wide window).
  const KIT_TABS = [["bag", "Bag", "obj_chest"], ["gear", "Gear", "bronzehelm"], ["combat", "Combat", "bronzesword"], ["magic", "Magic", "willowwand"], ["skills", "Skills", "tomekeen"]];
  /** The Hunting page on a wide window: the fight's controls live in the kit, so it's open whatever the setting (N22). */
  function kitFight() { return page() === "pet:hunt" && kitWide(); }   // (always open there; since 2026-10-20 on every wide page)
  let kitTab = (() => { try { return localStorage.getItem("np:kitTab") || "bag"; } catch (e) { return "bag"; } })();
  let kitSig = "", kitDragId = "", kitQuery = "";   // kitQuery: the bag's search (it was the Bag page's -- Cam, 2026-10-07: "a feature where i can search my bag")          // kitDragId: what's being dragged out of the bag (onto a quick slot, 2026-10-20)
  /** Is the panel showing? Remembered; open by default on a wide window. */
  // (2026-10-20, Cam: "We can get rid of the old bag interface now and keep the one in the side bar"): the Kit is the bag, so on a
  // wide window it's always there (the Settings switch went); on a narrow one it slides in from the top bar's Kit button
  function kitWide() { return window.innerWidth > 760; }   // (beside the page down to 760px -- slimmer below 1100; Cam's window, 2026-10-20)
  function kitOpen() {
    if (kitWide()) return true;
    let v = null; try { v = localStorage.getItem("np:kit"); } catch (e) { /* private window */ }
    return v === "1";
  }
  /** The bag's search: hide what doesn't match (no redraw, so typing isn't interrupted). */
  function kitFilter(el) {
    const q = kitQuery.trim().toLowerCase();
    el.querySelectorAll(".np-kit-grid:not(.np-kit-worn) [data-kname]").forEach((b) => { b.hidden = !!q && !b.dataset.kname.includes(q); });
    el.querySelectorAll(".np-kit-grid:not(.np-kit-worn) .np-kit-slot.empty").forEach((b) => { b.hidden = !!q; });
  }
  // a skill's unlocks (2026-10-20, Cam: "i dont want the skill icons when clicked to take you to the relevent section for that skill
  // (they are not shortcuts) instead have a pop up appear that shows what you have unlocked simply with the icon and the level it
  // unlocked. Further icons that are greyed out and the level number they will be unlocked at") -- RuneScape's skill guide
  function skillGuide(k) {
    document.querySelectorAll(".pp-skill-guide").forEach((x) => x.remove());
    const {s, now} = current(), reg = Core.SKILL_REG.find((x) => x.id === k), sk = Core.playerView(s, now).skills[k] || {level: 1};
    const cells = [];
    for (let lv = 1; lv <= Core.MAX_LEVEL; lv++) Core.levelUnlocks(k, lv, s, true).forEach((u) => cells.push({lv, icon: u.icon, text: u.text}));
    const box = document.createElement("div");
    box.className = "pp-modal pp-skill-guide";
    box.innerHTML = `<div class="pp-modal-card pp-sheet pp-sg-card" role="dialog" aria-label="${esc(reg.name)}">
        <button class="btn btn-quiet btn-sm pp-shop-x" aria-label="Close">✕</button>
        <div class="pp-sheet-head"><img alt="" src="${itemIcon(reg.icon, 48)}"><div><b>${esc(reg.name)}</b><div class="stamp">Level ${sk.level} / ${Core.MAX_LEVEL}</div></div></div>
        <div class="pp-sg-grid">${cells.map((c) => `<span class="pp-bcell pp-sg-cell${c.lv > sk.level ? " lock" : ""}" title="Level ${c.lv}: ${esc(c.text)}" aria-label="Level ${c.lv}: ${esc(c.text)}${c.lv > sk.level ? " (not yet)" : ""}">
          <img alt="" src="${itemIcon(c.icon, 48)}"><span class="lv">${c.lv}</span></span>`).join("") || `<p class="stamp">Nothing to unlock.</p>`}</div></div>`;
    document.body.appendChild(box);
    const close = () => box.remove();
    box.addEventListener("click", (e) => { if (e.target === box) close(); });
    box.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
    box.querySelector(".pp-shop-x").addEventListener("click", close);
    box.querySelector(".pp-shop-x").focus();
  }
  /** Open the Kit at a tab: the bag's links from anywhere (the old Bag page, the Today board, a tutorial step). */
  function kitShow(tab) {
    if (tab && KIT_TABS.some((t) => t[0] === tab)) { kitTab = tab; try { localStorage.setItem("np:kitTab", tab); } catch (e) { /* fine */ } }
    if (!kitWide()) { try { localStorage.setItem("np:kit", "1"); } catch (e) { /* fine */ } }
    kitSig = ""; kitRender();
    const el = document.getElementById("np-kit"); if (el) { el.classList.remove("np-kit-flash"); void el.offsetWidth; el.classList.add("np-kit-flash"); }
  }
  function kitSet(on) { try { localStorage.setItem("np:kit", on ? "1" : "0"); } catch (e) { /* fine */ } kitSig = ""; kitRender(); }
  /** RuneScape-style counts: 12,345 · 150K · 12M. */
  const kitCount = (n) => n >= 10000000 ? Math.floor(n / 1000000) + "M" : n >= 100000 ? Math.floor(n / 1000) + "K" : n > 1 ? n.toLocaleString() : "";

  // ---- the right-click menu, shared by the panel and the bank ----
  function ctxMenu(x, y, title, items) {
    document.querySelectorAll(".np-ctx").forEach((m) => m.remove());
    const box = document.createElement("div");
    box.className = "np-ctx"; box.setAttribute("role", "menu"); box.setAttribute("aria-label", title || "Menu");
    box.innerHTML = (title ? `<div class="np-ctx-title">${esc(title)}</div>` : "") + items.map((it, i) => it.sep ? `<div class="np-ctx-sep" role="separator"></div>`
      : `<button class="np-ctx-item${it.bad ? " bad" : ""}" role="menuitem" data-i="${i}" ${it.off ? "disabled" : ""}>${esc(it.label)}</button>`).join("");
    document.body.appendChild(box);
    const w = box.offsetWidth || 200, h = box.offsetHeight || 200;
    box.style.left = Math.max(4, Math.min(window.innerWidth - w - 4, x)) + "px";
    box.style.top = Math.max(4, Math.min(window.innerHeight - h - 4, y)) + "px";
    const close = () => { box.remove(); document.removeEventListener("mousedown", out, true); document.removeEventListener("keydown", key, true); window.removeEventListener("blur", close); };
    const out = (e) => { if (!box.contains(e.target)) close(); };
    const key = (e) => {
      const all = [...box.querySelectorAll(".np-ctx-item:not([disabled])")], at = all.indexOf(document.activeElement);
      if (e.key === "Escape") { e.preventDefault(); close(); }
      else if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); const n = all[(at + (e.key === "ArrowDown" ? 1 : all.length - 1)) % all.length]; if (n) n.focus(); }
    };
    setTimeout(() => { document.addEventListener("mousedown", out, true); document.addEventListener("keydown", key, true); window.addEventListener("blur", close); }, 0);
    box.querySelectorAll(".np-ctx-item").forEach((b) => b.addEventListener("click", () => { close(); const it = items[+b.dataset.i]; if (it && it.fn) it.fn(); }));
    const first = box.querySelector(".np-ctx-item:not([disabled])"); if (first) first.focus();
    return box;
  }
  /** Ask for a word or a number, in the game's own style (Cam, PT24 b3: "the pop up to name the tab be the sylized the same way as
   *  the rest of the game") -- a promise of the text, or null if you cancel. o: {title, label, value, number: [min, max], ok}. */
  function askText(o) {
    return new Promise((done) => {
      document.querySelectorAll(".pp-ask").forEach((x) => x.remove());
      const num = o.number, box = document.createElement("div");
      box.className = "pp-modal pp-ask";
      box.innerHTML = `<form class="pp-modal-card pp-ask-card" role="dialog" aria-label="${esc(o.title)}">
          <div class="pp-label">${esc(o.title)}</div>${o.label ? `<label class="pp-ask-label" for="pp-ask-in">${esc(o.label)}</label>` : ""}
          <input class="input pp-ask-in" id="pp-ask-in" ${num ? `type="number" min="${num[0]}" max="${num[1]}"` : `type="text" maxlength="${o.max || 30}"`} value="${esc(o.value == null ? "" : o.value)}" autocomplete="off">
          ${num ? `<div class="pp-row pp-ask-quick">${[1, 5, 10].filter((n) => n <= num[1]).map((n) => `<button type="button" class="btn btn-sm btn-quiet" data-q="${n}">${n}</button>`).join("")}<button type="button" class="btn btn-sm btn-quiet" data-q="${num[1]}">All (${num[1].toLocaleString()})</button></div>` : ""}
          <div class="pp-row"><button type="button" class="btn pp-ask-no">Cancel</button><button type="submit" class="btn btn-primary">${esc(o.ok || "OK")}</button></div></form>`;
      document.body.appendChild(box);
      const inp = box.querySelector("#pp-ask-in"), finish = (v) => { box.remove(); done(v); };
      box.querySelector("form").addEventListener("submit", (e) => { e.preventDefault(); finish(inp.value); });
      box.querySelector(".pp-ask-no").addEventListener("click", () => finish(null));
      box.addEventListener("click", (e) => { if (e.target === box) finish(null); });
      box.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); finish(null); } });
      box.querySelectorAll("[data-q]").forEach((b) => b.addEventListener("click", () => finish(b.dataset.q)));
      inp.focus(); inp.select();
    });
  }
  /** V7 (carried, Cam's yes; PT15 r1: "a stylized pop up ... with a slider to select the amount. This could work the same when
   *  clicking to craft, store or sell anything"): ONE amount picker -- a slider, a number box, 1 · 10 · half · all, and a line
   *  saying what you'd get as you slide. o: {title, max, value, ok, bad, preview(n) -> html, alt: {label, preview(n)}}.
   *  A promise of {n, alt} (alt: the second button was pressed), or null if you cancel. Enter confirms, Escape cancels. */
  function askAmount(o) {
    return new Promise((done) => {
      document.querySelectorAll(".pp-ask").forEach((x) => x.remove());
      const max = Math.max(1, o.max | 0), start = Math.max(1, Math.min(max, o.value || max)), box = document.createElement("div");
      const quick = [[1, "1"], [10, "10"], [Math.max(1, Math.floor(max / 2)), "Half"], [max, `All (${max.toLocaleString()})`]].filter((q, i, a) => q[0] <= max && a.findIndex((x) => x[0] === q[0]) === i);
      box.className = "pp-modal pp-ask";
      box.innerHTML = `<form class="pp-modal-card pp-ask-card pp-amount" role="dialog" aria-label="${esc(o.title)}">
          <div class="pp-label">${esc(o.title)}</div>
          <div class="pp-amount-row"><input type="range" class="pp-amount-slide" min="1" max="${max}" value="${start}" aria-label="How many">
            <input class="input pp-ask-in pp-amount-n" type="number" min="1" max="${max}" value="${start}" aria-label="How many, as a number"></div>
          <div class="pp-row pp-ask-quick">${quick.map((q) => `<button type="button" class="btn btn-sm btn-quiet" data-q="${q[0]}">${esc(q[1])}</button>`).join("")}</div>
          <p class="pp-amount-get" aria-live="polite"></p>
          <div class="pp-row"><button type="button" class="btn pp-ask-no">Cancel</button>
            ${o.alt ? `<button type="button" class="btn pp-amount-alt">${esc(o.alt.label)}</button>` : ""}
            <button type="submit" class="btn ${o.bad ? "btn-danger" : "btn-primary"}">${esc(o.ok || "OK")}</button></div></form>`;
      document.body.appendChild(box);
      const sl = box.querySelector(".pp-amount-slide"), nb = box.querySelector(".pp-amount-n"), get = box.querySelector(".pp-amount-get");
      const val = () => Math.max(1, Math.min(max, Math.floor(+nb.value) || 1));
      const show = () => { const n = val(); get.innerHTML = [o.preview ? o.preview(n) : "", o.alt && o.alt.preview ? `<span class="stamp">${esc(o.alt.label)}: ${o.alt.preview(n)}</span>` : ""].filter(Boolean).join("<br>"); };
      sl.addEventListener("input", () => { nb.value = sl.value; show(); });
      nb.addEventListener("input", () => { sl.value = val(); show(); });
      const finish = (v) => { box.remove(); done(v); };
      box.querySelector("form").addEventListener("submit", (e) => { e.preventDefault(); finish({n: val(), alt: false}); });
      box.querySelector(".pp-ask-no").addEventListener("click", () => finish(null));
      const alt = box.querySelector(".pp-amount-alt"); if (alt) alt.addEventListener("click", () => finish({n: val(), alt: true}));
      box.addEventListener("click", (e) => { if (e.target === box) finish(null); });
      box.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); finish(null); } });
      box.querySelectorAll("[data-q]").forEach((b) => b.addEventListener("click", () => { nb.value = sl.value = b.dataset.q; show(); nb.focus(); }));
      show(); nb.focus(); nb.select();
    });
  }
  /** Yes or no, in the game's own style (PT31 o4, Cam: "all pop ups have to fit games graphic UI style") -- every confirm in the
   *  game comes here, never the browser's box. A promise of true / false. The OK button is red when the text warns of a loss. */
  function askYes(text, o) {
    o = o || {};
    return new Promise((done) => {
      document.querySelectorAll(".pp-ask").forEach((x) => x.remove());
      const bad = o.bad !== undefined ? o.bad : /can't be undone|gone for good|for good|lose|loses|Replace|Empty|Remove|Release|Drop|Graveyard|finish you/i.test(text);
      const m = /^(.*?\?)\s*(.*)$/.exec(String(text)) || [0, text, ""];
      const box = document.createElement("div");
      box.className = "pp-modal pp-ask";
      box.innerHTML = `<div class="pp-modal-card pp-ask-card pp-yesno" role="alertdialog" aria-label="${esc(m[1])}">
          <div class="pp-yesno-q">${esc(m[1])}</div>${m[2] ? `<p class="stamp">${esc(m[2])}</p>` : ""}
          <div class="pp-row"><button type="button" class="btn pp-ask-no">${esc(o.no || "Cancel")}</button><button type="button" class="btn ${bad ? "btn-danger" : "btn-primary"} pp-ask-yes">${esc(o.ok || "Yes")}</button></div></div>`;
      document.body.appendChild(box);
      const finish = (v) => { box.remove(); done(v); };
      box.querySelector(".pp-ask-yes").addEventListener("click", () => finish(true));
      box.querySelector(".pp-ask-no").addEventListener("click", () => finish(false));
      box.addEventListener("click", (e) => { if (e.target === box) finish(false); });
      box.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); finish(false); } if (e.key === "Enter") { e.preventDefault(); finish(true); } });
      box.querySelector(".pp-ask-no").focus();
    });
  }
  /** Ask how many (the X of "Drop X" / "Take X" / "Deposit X"): the amount picker, a number (0 if you cancel). */
  async function askCount(what, max, o) {
    const r = await askAmount(Object.assign({title: `How many ${what}?`, max, value: max}, o || {}));
    return r ? r.n : 0;
  }
  /** Drop from anywhere (V7): the picker, with Recycle offered first when it can go in the stash ("dropping straight away throws
   *  value out" -- the Economist). Precious things ask once more. */
  async function dropAsk(id, max) {
    const {s, now} = current(), it = Core.ITEMS[id], rv = Core.recycleView(s, now), rc = rv.here && rv.can.find((x) => x.id === id);
    const rcGet = (n) => rc.each.length ? rc.each.map((x) => `${Math.floor(x.n * n)} ${esc(Core.ITEMS[x.id].name.toLowerCase())}`).filter((t) => !/^0 /.test(t)).join(", ") + ` in ${esc(rc.takes)}`
      : rc.points ? `${Math.floor(rc.points * n * 100) / 100} recycling points in ${esc(rc.takes)}` : "nothing, but it's tidied away";
    const r = await askAmount({title: `Drop ${it.name.toLowerCase()}`, max, value: max, ok: "Drop", bad: true,
      preview: (n) => `<b>${n.toLocaleString()} × ${esc(it.name.toLowerCase())}</b> gone for good.`,
      alt: rc && rv.stash.lots.length < rv.stash.max ? {label: "Recycle instead", preview: rcGet} : null});
    if (!r) return null;
    if (r.alt) return kitSay(await act("recycle", {id, n: r.n}));
    if ((it.gem >= 6 || it.bound) && !(await askText({title: `Drop ${r.n} ${it.name.toLowerCase()}?`, label: "It's gone for good -- type DROP to be sure.", value: ""}) || "").trim().toUpperCase().startsWith("DROP")) return null;
    return kitSay(await act("drop", {item: id, n: r.n}));
  }
  const kitSay = (r) => { if (r && r.error) toast(r.error, true); return r; };
  /** Drop, after a word when it's precious (a gem 6 thing, or a keepsake). */
  async function kitDrop(id, n) {
    const it = Core.ITEMS[id];
    if ((it.gem >= 6 || it.bound) && !await askYes(`Drop ${n === "all" ? "all your" : n} ${it.name.toLowerCase()}? It's gone for good.`)) return;
    kitSay(await act("drop", {item: id, n}));
  }
  /** The bag's right-click menu for a thing (also the bank's bag side). */
  // ---- what you're wearing, under the bag (I7, 2026-10-19, Cam: "have the equiped equipment show there. Underneath the main
  //      bag. Then i can still use them in the right click and use with, rather then having to take it off") -- gear and the
  //      tools you carry, once each; not the arrows (the bag shows their stack)
  function wornList(s) {
    const pl = s.player || {}, g = pl.gear || {}, ids = Object.keys(g).filter((k) => k !== "ammo").map((k) => g[k]).concat(Object.values(pl.tools || {}));
    return ids.filter((id, i) => id && Core.ITEMS[id] && ids.indexOf(id) === i && ((s.bag || {})[id] || 0) > 0)
      .map((id) => ({id, name: Core.ITEMS[id].name, gem: Core.ITEMS[id].gem, count: 1, kind: Core.ITEMS[id].tool && !Core.ITEMS[id].gear ? "tool" : "gear", worn: true}));
  }
  function wornMenu(it, x, y) {
    const {s, v, now} = current(), off = (s.player.gear || {}).offhand === it.id;
    const use = bagActs(it, Core.playerView(s, now), v.has && v.stage !== "egg", v).some((a) => a.act === "usewith");
    ctxMenu(x, y, it.name + " (wearing)", [
      {label: "Use with…", off: !use, fn: async () => kitSay(await doBagAct("usewith", it.id))},
      {label: off ? "Put away" : "Take off", fn: async () => kitSay(off ? await act("offhand", {item: ""}) : await act("unequip", {item: it.id}))},
      {label: "Examine", fn: () => showItem(it.id)}]);
  }
  function bagMenu(id, x, y) {
    const {s, v, now} = current(), pv = Core.playerView(s, now), it = Core.bagList(s).find((b) => b.id === id);
    if (!it) { const w = wornList(s).find((b) => b.id === id); if (w) wornMenu(w, x, y); return; }
    const items = [], bank = !!document.querySelector(".pp-store-modal"), canBank = Core.houseView(s, now).storage.cap > 0;
    if (bank) {
      items.push({label: "Deposit 1", fn: () => storeIt(id, 1)});
      if (it.count > 1) { if (it.count > 5) items.push({label: "Deposit 5", fn: () => storeIt(id, 5)}); items.push({label: "Deposit all", fn: () => storeIt(id, "all")}); }
      if (it.count > 1) items.push({label: "Deposit X…", fn: async () => { const n = await askCount(it.name.toLowerCase(), it.count); if (n) storeIt(id, n); }});
      items.push({sep: true});
    }
    bagActs(it, pv, v.has && v.stage !== "egg", v).forEach((a) => { if (a.act) items.push({label: a.label, fn: async () => kitSay(await doBagAct(a.act, id))}); });
    if (!bank && canBank && id !== "unidherb" && atBank()) items.push({label: "Put in the bank", fn: () => storeIt(id, "all")});   // (I8: only at the bank)
    if (Core.quickFits(id)) items.push({label: "Put on a quick slot…", fn: () => quickMenu(id, x, y)});   // (N22: a trap on a shortcut too)
    items.push({sep: true});
    items.push({label: "Drop 1", bad: true, fn: () => kitDrop(id, 1)});
    if (it.count > 1) { items.push({label: "Drop all", bad: true, fn: () => kitDrop(id, "all")}); items.push({label: "Drop X…", bad: true, fn: () => dropAsk(id, it.count)}); }
    items.push({label: "Examine", fn: () => showItem(id)});
    ctxMenu(x, y, it.name + (it.count > 1 ? ` (${it.count.toLocaleString()})` : ""), items);
  }
  /** Which quick slot (Shift+1 to 4) a thing goes on: what's on each now. */
  function quickMenu(id, x, y) {
    const q = current().s.player.quick || [];
    ctxMenu(x, y, `${Core.ITEMS[id].name} on…`, [0, 1, 2, 3].map((i) => ({label: `Slot ${i + 1} (Shift+${i + 1})${q[i] && Core.ITEMS[q[i]] ? " -- now " + Core.ITEMS[q[i]].name.toLowerCase() : " -- empty"}`,
      fn: async () => kitSay(await act("quick", {op: "set", i, item: id}))})));
  }
  // ---- the Combat tab (N22): your stance, your special, and the fight's moves that aren't in the bag ----
  function kitCombatHTML(s, pv, now) {
    const b = pv.battle, cls = pv.cls ? Core.CLASSES[pv.cls] : null, me = s.player, fitsNow = pv.specFitsNow || {};
    // V18: your side bar's specials that suit the weapon in hand (Q5: the rest hidden); the bar fires your chosen one, or the
    // first that fits when you've changed weapon
    const specs = b ? (b.specials || []).filter((x) => x.fits)
      : (pv.specLoadout || []).filter((id) => fitsNow[id]).map((id) => { const x = Core.specOf(me, id); return {id, name: x.name, cost: (pv.specCosts || {})[id] || x.cost, lock: (pv.specLocks || {})[id] || "", about: x.about || ""}; });
    const curId = specs.some((x) => x.id === pv.combat.special) ? pv.combat.special : (specs[0] || {}).id || "";
    const sp = curId ? Core.specOf(me, curId) : null;
    const btn = (cls2, label, sub, data, off, title) => `<button class="np-kit-cbtn ${cls2}" ${data} ${off ? "disabled" : ""}${title ? ` title="${esc(title)}"` : ""}><b>${label}</b>${sub ? `<small>${sub}</small>` : ""}</button>`;
    const w = pv.weapon, wt = Core.WEAPONS[w && w.id] || ["crush"], using = b && b.using && b.using !== (w && w.name) ? b.using : "";
    if (b && b.pack) return `<div class="np-kit-head"><b>Combat</b><span>Your pack</span></div>${b ? btn("run", "Run", "Back to hunting", 'data-krun="1"') : ""}`;
    const nextFight = !b && !!pv.combat.queued, spCost = sp ? (pv.specCosts || {})[curId] || sp.cost : 0;
    const ready = b ? !!((specs.find((x) => x.id === curId) || {}).ready) : !!(pv.job && pv.job.hunt && sp && (pv.fury ? pv.furyNow : pv.spec) >= spCost && !nextFight && !(pv.specLocks || {})[curId]);
    const meter = pv.fury ? (pv.furyNow || 0) : pv.spec, meterName = pv.fury ? (pv.meter === "devotion" ? "Devotion" : "Fury") : "Special";
    const manual = !!(b && b.manual);
    return `<div class="np-kit-head"><b>Combat</b><span>Combat ${pv.combatLevel}</span></div>
      <div class="np-kit-weapon">${w ? `<img alt="" src="${itemIcon(w.id, 32)}">` : ""}<div><b>${esc(using || (w ? w.name : "Fists"))}</b>
        <small>${using ? "your bow's dry" : w ? (w.style === "ranged" ? "ranged" : w.style === "magic" ? "magic" : "melee") : "melee"} · hits with ${esc(Core.DTYPES[wt[0]].toLowerCase())}</small></div></div>
      <div class="np-kit-sub">Stance</div>
      <div class="np-kit-stances">${Object.keys(Core.STYLES).map((k) => btn("stance" + (pv.combat.style === k ? " on" : ""), esc(Core.STYLES[k].name), "", `data-kstyle="${k}" aria-pressed="${pv.combat.style === k}"`, false, Core.STYLES[k].about)).join("")}</div>
      ${cls || specs.length ? `<div class="np-kit-sub">${meterName}</div>
        <button class="np-kit-spec${ready ? " ready" : ""}${(b && b.queued) || nextFight ? " queued" : ""}" ${curId === pv.combat.special ? 'data-kspec="1"' : `data-kspecpick="${esc(curId)}"`} ${!sp || !ready || (b && b.queued) || nextFight ? "disabled" : ""}
          title="${sp ? esc(sp.name + ": " + (sp.about || "")) : "Choose a special below"}"><span class="np-kit-specfill" style="width:${Math.max(0, Math.min(100, meter))}%"></span>
          <b>${sp ? esc(sp.name) : "No special"}</b><small>${!sp ? "" : b && b.queued ? "next attack!" : nextFight ? "next fight!" : ready ? "ready -- click to fire" : `${spCost}${pv.fury ? "" : "%"} · ${Math.floor(meter)}${pv.fury ? "" : "%"} now`}</small></button>
        ${specs.length > 1 ? `<div class="np-kit-specs">${specs.map((x) => `<button class="np-kit-spick${pv.combat.special === x.id ? " on" : ""}" data-kspecpick="${esc(x.id)}" ${x.lock ? "disabled" : ""} title="${esc(x.lock || x.about)}"><img alt="" src="${specIcon(x.id, "", 20)}">${esc(x.name)}<small>${x.cost}${pv.fury ? "" : "%"}</small></button>`).join("")}</div>` : ""}`
        : ``}
      ${b ? `<div class="np-kit-sub">This fight</div><div class="np-kit-moves">
          ${manual ? btn("go" + (b.danger ? " danger" : ""), "Attack", b.danger ? "one blow could finish you" : "", 'data-kattack="1"' + (b.danger ? ' data-risky="1"' : "")) : ""}
          ${b.bash && pv.paladin && pv.offItem && pv.offItem.shield ? btn("bash" + (b.bash.next ? " on" : ""), "Shield bash", b.bash.next ? "next turn" : b.bashCd ? `${b.bashCd} round${b.bashCd === 1 ? "" : "s"}` : "", 'data-kbash="1"', !!b.bash.why && !b.bash.next) : ""}
          ${pv.weapons && pv.weapons.off ? btn("swap", "Swap hands", `to your ${esc(pv.weapons.off.name.toLowerCase())}`, 'data-kswap="1"') : ""}
          ${b.boss ? (manual ? btn("auto", "Auto", "", 'data-kmode="auto"') : btn("manual", "Manual", "", 'data-kmode="manual"')) : ""}
          ${btn("run", "Run", b.boss ? "counts as a loss" : "", 'data-krun="1"')}</div>`
        : pv.job && pv.job.hunt ? `<div class="np-kit-moves">${pv.weapons && pv.weapons.off ? btn("swap", "Swap hands", "", 'data-kswap="1"') : ""}${btn("run", "Home", "", 'data-khome="1"')}</div>` : ""}
      ${kitPlanHTML(s, pv)}`;
  }
  // the hunt plan, here and uncluttered (2026-10-20, Cam: "it would be great if the combat tab could contain the hunt plan stuff in a
  // non cluttered way ... i can change everything from that side bar") -- the words that explained it are for the tutorial and the book
  function kitPlanHTML(s, pv) {
    const row = (label, ctl, title) => `<div class="np-kit-prow"${title ? ` title="${esc(title)}"` : ""}><span>${label}</span><span class="np-kit-pctl">${ctl}</span></div>`;
    const tools = pv.toolPlan && pv.toolPlan.can ? toolPlanHTML(pv.toolPlan, row).replace(/<p class="stamp">[\s\S]*?<\/p>/g, "") : "";
    return `<div class="np-kit-sub">Quick slots</div><div class="pp-quick np-kit-quick">${quickSlotsHTML(s)}</div>
      ${tools ? `<div class="np-kit-sub">Traps and nets</div><div class="np-kit-plan">${tools}</div>` : ""}
      ${pv.paladin ? `<div class="np-kit-sub">Shield</div><div class="np-kit-plan">${row("Bash", `<label><input type="checkbox" class="pp-bashauto" ${pv.bashAuto ? "checked" : ""}> when ready</label>`, "On any creature, whenever your shield arm is ready")}</div>` : ""}`;
  }
  function kitCombatWire(el) {
    if (el.querySelector(".np-kit-plan, .np-kit-quick")) wirePlan(el, kitSay);
    const on = (sel, f) => el.querySelectorAll(sel).forEach((b) => b.addEventListener("click", () => f(b)));
    on("[data-kstyle]", async (b) => kitSay(await act("combat", {style: b.dataset.kstyle})));
    on("[data-kspec]", async () => kitSay(await act("battle", {cmd: "special"})));
    on("[data-kspecpick]", async (b) => {                               // yours now -- and fired, in a fight, if it's ready
      const id = b.dataset.kspecpick, {s, now} = current(), fb = s.player.battle ? Core.playerView(s, now).battle : null, x = fb && (fb.specials || []).find((y) => y.id === id);
      const r = await act("combat", {special: id});
      if (r && r.error) return kitSay(r);
      if (x && x.ready) kitSay(await act("battle", {cmd: "special"}));
    });
    on("[data-krun]", async () => kitSay(await act("battle", {cmd: "run"})));
    on("[data-khome]", async () => kitSay(await act("home")));
    on("[data-kswap]", async () => kitSay(await act("battle", {cmd: "swap"})));
    on("[data-kbash]", async () => kitSay(await act("battle", {cmd: "bash"})));
    on("[data-kmode]", async (b) => kitSay(await act("battle", {cmd: b.dataset.kmode})));
    on("[data-kattack]", async (b) => {
      if (b.dataset.risky && !await askYes("One more blow could finish you -- and a fall loses everything you carry: bag, coins, armour and tools. Attack anyway? (Eat or Run instead?)")) return;
      kitSay(await act("battle", {cmd: "attack"}));
    });
  }
  async function storeIt(id, n, tab) {
    const r = await act("store", {item: id, n, tab: typeof tab === "number" ? tab : bankTab > 0 ? bankTab - 1 : undefined});
    kitSay(r); if (document.querySelector(".pp-store-modal")) showStore();
  }

  // ---- the panel ----
  function kitRender() {
    const el = document.getElementById("np-kit");
    if (!el) return;
    const on = kitOpen();
    if (document.body.classList.contains("np-kit-on") !== on) document.body.classList.toggle("np-kit-on", on);   // (only changes: OPT-A)
    const tg = document.getElementById("np-kit-toggle"); if (tg && tg.getAttribute("aria-pressed") !== String(on)) { tg.setAttribute("aria-pressed", on); tg.classList.toggle("on", on); }
    if (!on) { if (!el.hidden) el.hidden = true; if (el.innerHTML) el.innerHTML = ""; kitSig = ""; return; }
    if (el.hidden) el.hidden = false;
    const {s, v, now} = current();
    if (!s.player || !s.player.made) { el.innerHTML = ""; return; }
    const pv = Core.playerView(s, now);
    const fb = pv.battle;
    const fightSig = kitTab === "combat" || kitTab === "magic" ? [pv.combat, pv.spec, pv.furyNow, pv.cls, !!pv.job, fb && [fb.manual, fb.boss, fb.castNext, fb.danger, fb.queued, fb.skip, fb.bashCd, fb.bash, fb.style, (fb.specials || []).map((x) => x.id + x.ready + x.lock).join(), !!fb.pack]]
      : kitTab === "skills" ? Object.keys(pv.skills).map((k) => pv.skills[k].level + ":" + Math.round(pv.skills[k].progress * 20)) : "";
    const sig = JSON.stringify([kitTab, s.bag, s.player.gear, s.player.quiverN, s.player.tools, s.player.loadout, s.player.gearSets, s.player.quick, bagUse, Core.bagCap(s), slot, !!fb, fightSig, kitFight()]);
    if (sig === kitSig && el.firstChild) return;
    if (el.contains(document.activeElement) && document.activeElement !== el && kitSig) { /* keep focus where it was */ }
    const focused = document.activeElement && el.contains(document.activeElement) ? document.activeElement.dataset.kfocus : "";
    kitSig = sig;
    const tabs = `<nav class="np-kit-tabs" role="tablist" aria-label="Your kit">${KIT_TABS.map(([k, n, ic]) =>
      `<button class="np-kit-tab${kitTab === k ? " on" : ""}" role="tab" aria-selected="${kitTab === k}" data-kittab="${k}" data-kfocus="tab-${k}" title="${n}"><img alt="" src="${itemIcon(ic, 24)}"><span>${n}</span></button>`).join("")}
      ${kitWide() ? "" : `<button class="np-kit-x" data-kitclose title="Hide the kit" aria-label="Hide the kit">›</button>`}</nav>`;
    let body = "";
    if (kitTab === "bag") {
      const list = Core.bagList(s), cap = Core.bagCap(s), used = Core.bagUsed(s);
      const partners = bagUse ? Core.fieldPartners(s, bagUse).map((x) => x.id) : [], qw = questWants(s);   // (quest faces here too: PT30 l3)
      const cells = list.map((it) => `<button class="np-kit-slot${bagUse === it.id ? " using" : ""}${bagUse && partners.includes(it.id) ? " use-ok" : ""}${bagUse && bagUse !== it.id && !partners.includes(it.id) ? " dim" : ""}"
          draggable="true" data-kitem="${esc(it.id)}" data-kname="${esc(it.name.toLowerCase())}" data-kfocus="i-${esc(it.id)}" title="${esc(it.name)}${it.count > 1 ? " × " + it.count.toLocaleString() : ""} -- right-click for more">
          <img alt="" src="${itemIcon(it.id, 32)}"><span class="np-kit-n">${kitCount(it.count)}</span>${qw[it.id] ? `<span class="np-kit-qface" data-qperson="${esc(qw[it.id].person)}" title="${esc(qw[it.id].name)} wants ${qw[it.id].need} for “${esc(qw[it.id].quest)}”"><img alt="" src="${avatarURL(qw[it.id].look, 20)}"></span>` : ""}</button>`).join("");
      const empty = Math.max(0, cap - used), worn = wornList(s);
      body = `<div class="np-kit-head"><b>Bag</b><input class="np-kit-search" type="search" placeholder="Search" aria-label="Search your bag" value="${esc(kitQuery)}" data-kfocus="search"><span>${used}/${cap}</span></div>
        ${bagUse ? `<div class="np-kit-use">Use ${esc(Core.ITEMS[bagUse].name.toLowerCase())} with… <button class="btn btn-sm btn-quiet" data-kituse="-">Cancel</button></div>
          ${partners.length ? "" : `<ul class="np-kit-why">${Core.fieldWhy(s, bagUse).map((t) => `<li>${esc(t)}</li>`).join("")}</ul>`}` : ""}
        <div class="np-kit-grid">${cells}${"<span class=\"np-kit-slot empty\" aria-hidden=\"true\"></span>".repeat(Math.min(empty, 60))}</div>
        ${worn.length ? `<div class="np-kit-sub">Wearing</div><div class="np-kit-grid np-kit-worn">${worn.map((it) => `<button class="np-kit-slot worn${bagUse === it.id ? " using" : ""}${bagUse && partners.includes(it.id) ? " use-ok" : ""}${bagUse && bagUse !== it.id && !partners.includes(it.id) ? " dim" : ""}"
            data-kitem="${esc(it.id)}" data-kworn="1" data-kfocus="w-${esc(it.id)}" title="${esc(it.name)} (wearing) -- right-click for more"><img alt="" src="${itemIcon(it.id, 32)}"></button>`).join("")}</div>` : ""}`;
    } else if (kitTab === "gear") {
      const by = {}; (pv.gear || []).forEach((g) => { by[g.slot] = g; });
      const off = (pv.weapons && pv.weapons.off) || pv.offItem;
      const cell = (k) => {
        if (!k) return `<span></span>`;
        const g = by[k], it = k === "offhand" ? (off ? {id: off.id, name: off.name} : null) : g && g.item, name = k === "offhand" ? "Off hand" : (g ? g.name : k);
        return `<button class="np-kit-gslot${it ? " full" : ""}" data-kgear="${k}" data-kfocus="g-${k}" title="${esc(name)}: ${it ? esc(it.name) : "empty"}">
          ${it ? `<img alt="" src="${itemIcon(it.id, 32)}">` : `<span class="np-kit-gempty">${esc(name)}</span>`}${(k === "ammo" || k === "quiver") && it && pv.ammo ? `<span class="np-kit-n">${pv.ammo.count >= 999 ? "∞" : pv.ammo.count}</span>` : ""}</button>`;   // (N24: what's loaded)
      };
      // RuneScape's equipment shape: head on top, the body down the middle, hands either side
      const rows = [[null, "helmet", null], ["cloak", "necklace", "ammo"], ["weapon", "torso", "offhand"], ["arms", "legs", "quiver"], ["ring", "feet", null]];
      const tools = Object.values(pv.tools || {}).filter(Boolean);
      body = `<div class="np-kit-head"><b>Gear</b><span>Combat ${pv.combatLevel}</span></div>
        <div class="np-kit-gear">${rows.map((r) => r.map(cell).join("")).join("")}</div>
        <div class="np-kit-sub">Gear sets</div>
        <div class="np-kit-sets">${Core.gearSetsView(s).map((g) => g.empty ? `<button class="np-kit-set empty" data-kset="${g.n}" data-kfocus="set-${g.n}" title="Save what you're wearing as set ${g.n + 1}">Save set ${g.n + 1}</button>`
          : `<button class="np-kit-set${g.on ? " on" : ""}" data-kset="${g.n}" data-kfocus="set-${g.n}" data-full="1" title="Put on ${esc(g.name)} -- right-click to save over it, rename or clear">${esc(g.name)}<small>${g.on ? "wearing" : g.items.filter((x) => x.have).length + "/" + g.items.length + " pieces"}</small></button>`).join("")}</div>
        ${tools.length ? `<div class="np-kit-sub">Carrying</div><div class="np-kit-tools">${tools.map((t) => `<span class="np-kit-tool" title="${esc(t.name)}"><img alt="" src="${itemIcon(t.id, 24)}"></span>`).join("")}</div>` : ""}
        <button class="btn btn-sm btn-quiet np-kit-more" data-kitgo="pet:gear">Character sheet ›</button>`;
    } else if (kitTab === "combat") {
      body = kitCombatHTML(s, pv, now);
    } else if (kitTab === "skills") {
      body = `<div class="np-kit-head"><b>Skills</b><span>Total level ${pv.totalLevel}</span></div>
        <div class="np-kit-skills">${Core.SKILL_REG.map((k) => { const sk = pv.skills[k.id] || {level: 1, progress: 0}, top = sk.level >= Core.MAX_LEVEL;
          // the hover (Cam, 2026-10-20: "the current xp ... and the next level exp and exp left"), RuneScape's little box
          const xp = (sk.xp || 0).toLocaleString(), nextXp = top ? "" : ((sk.xp || 0) + (sk.toNext || 0)).toLocaleString(), left = top ? "" : (sk.toNext || 0).toLocaleString();
          const tip = `<b>${esc(k.name)}</b> level ${sk.level}<br>XP: ${xp}${top ? "<br>The top level" : `<br>Next level at: ${nextXp}<br>Remaining: ${left}`}`;
          return `<button class="np-kit-skill" data-kskill="${k.id}" data-kfocus="sk-${k.id}" aria-label="${esc(k.name)} level ${sk.level}: ${xp} xp${top ? "" : `, ${left} to level ${sk.level + 1}`}">
            <img alt="" src="${itemIcon(k.icon, 24)}"><span class="np-kit-lv"><b>${sk.level}</b><small>${Core.MAX_LEVEL}</small></span>
            <span class="np-kit-xp" aria-hidden="true"><span style="width:${Math.round((top ? 1 : sk.progress) * 100)}%"></span></span>
            <span class="np-kit-tip" aria-hidden="true">${tip}</span></button>`; }).join("")}</div>`;
    } else {
      const sb = Core.spellbookView(s), known = sb.spells.filter((x) => !x.hidden && !x.lock);
      const castFight = fb && fb.magic && !fb.pack;                      // N22: in a fight, a loaded spell is your next cast
      const slots = Array.from({length: sb.max}, (_, i) => { const id = sb.loadout[i], sp = id && sb.spells.find((x) => x.id === id);
        return sp ? `<button class="np-kit-spell on${castFight && fb.castNext === sp.id ? " next" : ""}" data-kspell="${esc(sp.id)}" ${castFight ? 'data-kcast="1"' : ""} data-kfocus="sp-${esc(sp.id)}" title="${esc(sp.name)} -- ${castFight ? "click to cast it next" : "click to take it out"}">${esc(sp.name)}<small>${castFight && fb.castNext === sp.id ? "next cast · " : ""}${sp.casts >= 999 ? "∞" : sp.casts} casts</small></button>`
          : `<span class="np-kit-spell empty">Empty slot</span>`; }).join("");
      const runes = sb.runes.filter((r) => r.have > 0);
      body = `<div class="np-kit-head"><b>Magic</b><span>Level ${sb.level}${sb.magicWeapon ? "" : " · no wand or staff"}</span></div>
        <div class="np-kit-sub">${castFight ? "Cast next (click one)" : `In your fights (${sb.loadout.length}/${sb.max})`}</div><div class="np-kit-load">${slots}</div>
        <div class="np-kit-sub">Your spells</div>
        <div class="np-kit-book">${known.map((sp) => `<button class="np-kit-spell${sp.equipped ? " on" : ""}" data-kspell="${esc(sp.id)}" data-kfocus="sb-${esc(sp.id)}"
            title="${esc(sp.name)}: ${esc(sp.about)} -- ${sp.runes.map((r) => r.n + " " + Core.ITEMS[r.id].name.toLowerCase()).join(", ")}">${esc(sp.name)}<small>${sp.element ? esc(sp.element) + " · " : ""}${sp.casts >= 999 ? "∞" : sp.casts}</small></button>`).join("") || ``}</div>
        ${runes.length ? `<div class="np-kit-sub">Runes</div><div class="np-kit-tools">${runes.map((r) => `<span class="np-kit-tool" title="${esc(r.name)}"><img alt="" src="${itemIcon(r.id, 24)}"><small>${kitCount(r.have) || 1}</small></span>`).join("")}</div>` : ""}
        <button class="btn btn-sm btn-quiet np-kit-more" data-kitgo="pet:library">The spellbook ›</button>`;
    }
    el.innerHTML = tabs + `<div class="np-kit-body" role="tabpanel">${body}</div>`;
    const sq = el.querySelector(".np-kit-search");
    if (sq) { kitFilter(el); sq.addEventListener("input", () => { kitQuery = sq.value; kitFilter(el); }); }
    if (focused) { const f = el.querySelector(`[data-kfocus="${CSS.escape(focused)}"]`); if (f) f.focus(); }
    el.querySelectorAll("[data-kittab]").forEach((b) => b.addEventListener("click", () => { kitTab = b.dataset.kittab; try { localStorage.setItem("np:kitTab", kitTab); } catch (e) { /* fine */ } kitRender(); }));
    const kx = el.querySelector("[data-kitclose]"); if (kx) kx.addEventListener("click", () => kitSet(false));
    kitCombatWire(el);
    el.querySelectorAll("[data-kskill]").forEach((b) => b.addEventListener("click", () => skillGuide(b.dataset.kskill)));   // (2026-10-20: not a shortcut -- what it unlocks)
    el.querySelectorAll("[data-kitgo]").forEach((b) => b.addEventListener("click", () => goTo(b.dataset.kitgo)));
    const cu = el.querySelector("[data-kituse]"); if (cu) cu.addEventListener("click", () => { bagUse = ""; kitSig = ""; kitRender(); });
    // the bag: left click does the obvious thing; right click (or the menu key) opens the menu; drag onto the bank
    el.querySelectorAll("[data-kitem]").forEach((b) => {
      const id = b.dataset.kitem;
      b.addEventListener("click", async () => {
        if (bagUse) {
          if (bagUse === id) { bagUse = ""; kitSig = ""; return kitRender(); }
          if (!Core.fieldPartners(current().s, bagUse).some((x) => x.id === id)) return;   // a dim one does nothing (as the old Bag page)
          const r = await act("usewith", {item: bagUse, on: id}); bagUse = ""; kitSig = ""; kitSay(r); return kitRender();
        }
        if (b.dataset.kworn) return showItem(id);                         // (I7) what you wear: its sheet
        if (document.querySelector(".pp-store-modal")) return storeIt(id, 1);   // at the bank: a click puts one in
        const {s, v, now} = current(), it = Core.bagList(s).find((x) => x.id === id), first = it && bagActs(it, Core.playerView(s, now), v.has && v.stage !== "egg", v).find((a) => a.act && !a.on);
        if (first) kitSay(await doBagAct(first.act, id)); else showItem(id);
      });
      b.addEventListener("contextmenu", (e) => { e.preventDefault(); bagMenu(id, e.clientX, e.clientY); });
      b.addEventListener("keydown", (e) => { if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) { e.preventDefault(); const r = b.getBoundingClientRect(); bagMenu(id, r.left, r.bottom); } });
      if (!b.dataset.kworn) {
        b.addEventListener("dragstart", (e) => { e.dataTransfer.setData("text/plain", "store:" + id); e.dataTransfer.effectAllowed = "copyMove"; storeDrag = "store"; kitDragId = id; document.body.classList.add("np-kit-dragging"); });
        b.addEventListener("dragend", () => { kitDragId = ""; document.body.classList.remove("np-kit-dragging"); });
      }
    });
    // gear: a click opens the slot's picker (the Character sheet's); right click takes it off
    el.querySelectorAll("[data-kgear]").forEach((b) => {
      const k = b.dataset.kgear;
      b.addEventListener("click", () => openSlotPicker(b, "player", k));
      b.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        const {s, now} = current(), pv = Core.playerView(s, now), g = (pv.gear || []).find((x) => x.slot === k), off = (pv.weapons && pv.weapons.off) || pv.offItem;
        const it = k === "offhand" ? off : g && g.item;
        ctxMenu(e.clientX, e.clientY, it ? it.name : "Empty", [
          {label: "Change…", fn: () => openSlotPicker(b, "player", k)},
          {label: k === "offhand" ? "Put away" : "Take off", off: !it, fn: async () => kitSay(k === "offhand" ? await act("offhand", {item: ""}) : await act("unequip", {item: it.id}))},
          {label: "Examine", off: !it, fn: () => showItem(it.id)}]);
      });
    });
    // gear sets: a click puts one on (or saves an empty one); right click to save over, rename or clear
    el.querySelectorAll("[data-kset]").forEach((b) => {
      const n = +b.dataset.kset;
      b.addEventListener("click", async () => kitSay(await act("gearset", {op: b.dataset.full ? "load" : "save", n})));
      b.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        const full = !!b.dataset.full;
        ctxMenu(e.clientX, e.clientY, full ? b.firstChild.textContent : "Set " + (n + 1), [
          {label: full ? "Put it on" : "Save what I'm wearing", fn: async () => kitSay(await act("gearset", {op: full ? "load" : "save", n}))},
          {label: "Save what I'm wearing over it", off: !full, fn: async () => kitSay(await act("gearset", {op: "save", n}))},
          {label: "Rename…", off: !full, fn: async () => { const nm = await askText({title: "Name this gear set", value: b.firstChild.textContent.trim(), max: 16, ok: "Save"}); if (nm) kitSay(await act("gearset", {op: "save", n, name: nm})); }},
          {label: "Clear", bad: true, off: !full, fn: async () => kitSay(await act("gearset", {op: "clear", n}))}]);
      });
    });
    // magic: a click puts a spell in your fights or takes it out
    el.querySelectorAll("[data-kspell]").forEach((b) => b.addEventListener("click", async () => {
      if (b.dataset.kcast) return kitSay(await act("battle", {cmd: "cast", spell: b.dataset.kspell}));   // (N22: a fight's next cast)
      const {s} = current(), lo = (s.player.loadout || []).slice(), id = b.dataset.kspell, i = lo.indexOf(id), max = Core.spellbookView(s).max;
      if (i >= 0) lo.splice(i, 1); else if (lo.length >= max) return toast(`Your fights take ${max} spells -- take one out first.`, true); else lo.push(id);
      kitSay(await act("loadout", {spells: lo}));
    }));
  }
  everySecond("kit", () => { kitRender(); return true; });                 // a trip filling the bag shows as it happens
  window.addEventListener("resize", () => { let v = null; try { v = localStorage.getItem("np:kit"); } catch (e) { /* fine */ } if (v === null) { kitSig = ""; kitRender(); } });
  // ---- someone explains something, in their own words (PT20, 2026-10-18; the words are Core.TALKS) ----------------------
  /** Show a talk; mark it seen so it doesn't come by itself again. auto: only if it hasn't been seen. */
  async function talkPopup(key, auto) {
    const {s} = current(), t = Core.talkView(s, key);
    if (!t || (auto && t.seen) || document.querySelector(".pp-talk")) return;
    const pic = t.look && t.look.pic && window.PEOPLE_PICS && window.PEOPLE_PICS[t.look.pic] ? `art/people/${t.look.pic}.webp` : t.look ? avatarURL(t.look, 128) : "";
    const box = document.createElement("div");
    box.className = "pp-modal pp-talk";
    box.innerHTML = `<div class="pp-modal-card pp-talk-card" role="dialog" aria-label="${esc(t.title)}">
        ${pic ? `<img class="pp-talk-pic" alt="" src="${pic}">` : ""}
        <div class="pp-talk-body"><div class="pp-label">${esc(t.title)}</div>${t.name ? `<b class="pp-talk-who">${esc(t.name)}</b>` : ""}
          ${t.lines.map((l) => `<p class="pp-said">${esc(l)}</p>`).join("")}
          ${t.show.length ? `<div class="pp-talk-show">${t.show.map((id) => `<figure><img alt="" src="${itemIcon(id, 64)}"><figcaption>${esc(Core.ITEMS[id].name)}</figcaption></figure>`).join("")}</div>` : ""}
          <div class="pp-row">${t.go ? `<button class="btn" data-talkgo="${esc(t.go[0])}">${esc(t.go[1])}</button>` : ""}<button class="btn btn-primary pp-modal-close">Got it</button></div></div></div>`;
    document.body.appendChild(box);
    const shut = () => box.remove();
    box.querySelector(".pp-modal-close").addEventListener("click", shut);
    box.addEventListener("click", (e) => { if (e.target === box) shut(); });
    box.addEventListener("keydown", (e) => { if (e.key === "Escape") shut(); });
    const g = box.querySelector("[data-talkgo]"); if (g) g.addEventListener("click", () => { shut(); goTo(g.dataset.talkgo); });
    box.querySelector(".pp-modal-close").focus();
    if (!t.seen) await act("seen", {key});
  }
  // ---- I5 b3 (2026-10-19, kept in Q6): the bag fills on a trip -- help, not a wall. The cheapest stacks, to drop or recycle (no bank, N20);
  //      make room and the trip carries on collecting (it never stopped: it kept going for the xp).
  const bagFullSeen = {};
  function bagFullPop() {
    const {s, now} = current(), j = s.player && s.player.job;
    if (!j || !j.full || bagFullSeen[j.since + ":" + j.full] || document.querySelector(".pp-modal")) return true;
    bagFullSeen[j.since + ":" + j.full] = true;
    const draw = () => {
      // (N20, 2026-10-19, Cam: "Remove bank option from pop up when the bag is full ... less hand holding") -- drop or recycle
      const st = current().s, at = current().now, rv = Core.recycleView(st, at), home = rv.here;
      const list = Core.bagList(st).filter((x) => x.id !== j.full && !Core.ITEMS[x.id].bound && !Core.ITEMS[x.id].egg && !Core.ITEMS[x.id].learn)
        .map((x) => Object.assign(x, {worth: Core.priceOf(x.id) * x.count})).sort((a, b) => a.worth - b.worth).slice(0, 6);
      box.innerHTML = `<div class="pp-modal-card pp-sheet" role="dialog" aria-label="Your bag is full"><button class="btn btn-quiet btn-sm pp-shop-x" aria-label="Close">✕</button>
        <div class="pp-sheet-head"><img alt="" src="${itemIcon(j.full, 64)}"><div><b>Your bag is full</b><div class="stamp">No room for more ${esc(Core.ITEMS[j.full].name.toLowerCase())}. Make room and your trip carries on collecting.</div></div></div>
        <div class="pp-label">The least valuable stacks</div>
        ${list.map((x) => `<div class="pp-recipe"><img alt="" src="${itemIcon(x.id, 32)}"><div class="pp-recipe-main"><b>${esc(x.name)}</b> <span class="stamp">×${x.count.toLocaleString()} · worth about ${Math.round(x.worth).toLocaleString()} coins</span></div>
          <span class="pp-place-btns">${home ? `<button class="btn btn-sm" data-bf="recycle" data-id="${x.id}">Recycle</button>` : ""}<button class="btn btn-sm btn-danger" data-bf="drop" data-id="${x.id}">Drop</button></span></div>`).join("") || `<p class="stamp">Nothing cheap to clear.</p>`}
        <div class="pp-row"><button class="btn btn-quiet pp-bf-close">Leave it for now</button></div></div>`;
      const close = () => box.remove();
      box.querySelector(".pp-shop-x").addEventListener("click", close); box.querySelector(".pp-bf-close").addEventListener("click", close);
      box.querySelectorAll("[data-bf]").forEach((b) => b.addEventListener("click", async () => {
        const id = b.dataset.id, a = b.dataset.bf;
        const r = a === "drop" ? await act("drop", {item: id, n: "all"}) : await act("recycle", {id, n: "all"});
        if (r && r.error) toast(r.error, true); else { toast(r.msg); if (!Core.bagUsed(current().s) || Core.bagUsed(current().s) < Core.bagCap(current().s)) return close(); draw(); }
      }));
    };
    const box = document.createElement("div"); box.className = "pp-modal pp-item-sheet pp-bagfull";
    document.body.appendChild(box); draw();
    box.addEventListener("click", (e) => { if (e.target === box) box.remove(); });
    box.addEventListener("keydown", (e) => { if (e.key === "Escape") box.remove(); });
    return true;
  }
  everySecond("bagfull", bagFullPop);
  // ---- Expeditions as runs (2026-10-06): the pet's own battle stats, a pack, stages, injuries ----
  let pack = {};                       // what to carry: {item: count}
  let party = [{id: "", role: "scout"}, {id: "", role: "fighter"}];   // who goes along (2026-10-10): up to two den pets, a role each
  // the party picker (2026-10-10): two places, a den pet and a role each
  function haulers() { return party.filter((m) => m.id && m.role === "hauler").length; }
  function partyHTML(s, now) {
    const pets = Core.partyView(s, "", now);
    party.forEach((m) => { if (m.id && !pets.some((p) => p.id === m.id && !p.lock)) m.id = ""; });
    if (!pets.length) return `<div class="pp-group"><div class="pp-label">Party</div></div>`;
    const row = (m, i) => `<div class="pp-party-row">
        <select class="input pp-party-pet" data-i="${i}" aria-label="Who goes along"><option value="">Nobody</option>
          ${pets.map((p) => `<option value="${p.id}" ${m.id === p.id ? "selected" : ""} ${p.lock || party.some((o, j) => j !== i && o.id === p.id) ? "disabled" : ""}>${esc(p.name)} · level ${p.level}${p.nature ? " · " + esc(p.nature) : ""}${p.lock ? " — " + esc(p.lock.replace(p.name + " ", "")) : ""}</option>`).join("")}</select>
        <select class="input pp-party-role" data-i="${i}" aria-label="Their role">${Object.keys(Core.ROLES).map((r) => `<option value="${r}" ${m.role === r ? "selected" : ""}>${esc(Core.ROLES[r].name)}</option>`).join("")}</select>
        <span class="stamp">${esc(Core.ROLES[m.role].says)}</span></div>`;
    return `<div class="pp-group"><div class="pp-label">Party: up to ${Core.PARTY_MAX} pets from the den go along, sharing the xp</div>${party.map(row).join("")}</div>`;
  }
  function renderExpeditions(host) {
    const {s, v, now} = current();
    const areas = Core.expeditionsView(s, now);
    const inf = s.dev && s.dev.infinite;
    const why = !v.has ? ((s.graveyard || []).length ? "No companion — choose one from Pets (the den), or hatch an egg in the Hatchery." : "Hatch a pet first.")
      : v.stage === "egg" ? "Your egg hasn't hatched yet."
      : v.stage === "hatchling" ? `${v.name} can go exploring at ${Core.EXPEDITION_DAYS || 3} days old — in ${v.daysToExpeditions} day${v.daysToExpeditions === 1 ? "" : "s"}.`
      : v.away ? "" : v.injury && !v.injury.treated ? `${v.name} has ${v.injury.name} and won't heal until it's treated.`
      : v.injuredFor ? `${v.name} is healing for ${v.injuredFor} more minutes.`
      : v.asleep ? `${v.name} is asleep.` : v.sick ? `${v.name} is poorly.` : "";
    const have = (k) => inf ? 99 : (s.bag[k] || 0);
    const usable = Object.keys(s.bag).filter((k) => have(k) > 0 && Core.ITEMS[k] && (Core.ITEMS[k].heal || Core.ITEMS[k].petbrew || Core.ITEMS[k].treats));
    Object.keys(pack).forEach((k) => { if (!have(k)) delete pack[k]; else pack[k] = Math.min(pack[k], have(k), 10); });
    const kinds = Object.keys(pack).filter((k) => pack[k] > 0);
    const what = (k) => { const it = Core.ITEMS[k]; return it.petbrew ? "drunk at the start" : it.treats ? `treats ${it.treats} injuries on the spot` : `heals ${Math.round(it.heal * 1.5)}`; };
    const f = v.fight || {};
    const meds = v.injury && !v.injury.treated ? Object.keys(s.bag).filter((k) => have(k) && Core.ITEMS[k] && Core.ITEMS[k].treats
      && Core.INJURIES[Core.ITEMS[k].treats].rank >= Core.INJURIES[v.injury.sev].rank) : [];
    const awayBox = v.away ? `
      <div class="pp-trip pp-run">
        <div class="pp-label">${esc(v.name)} at the ${esc(v.away.areaName)} — stage ${Math.min(v.away.stage + 1, v.away.stages)} of ${v.away.stages}</div>
        ${(v.away.party || []).length ? `<div class="stamp">With ${v.away.party.map((m) => `${esc(m.name)} (${esc(m.role.toLowerCase())})`).join(" and ")}</div>` : ""}
        <div class="pp-runhp"><span style="width:${v.away.maxHp ? Math.round(100 * v.away.hp / v.away.maxHp) : 0}%"></span><b>${v.away.hp} / ${v.away.maxHp}</b></div>
        <ol class="pp-runlog">${(v.away.log || []).map((l) => `<li>${esc(l.text)} <small>(${l.hp} hp)</small></li>`).join("") || "<li>On the way…</li>"}</ol>
        <div class="stamp">Next stage in <span id="pp-next">${clock(v.away.backIn)}</span> · carrying ${Object.keys(v.away.pack).filter((k) => v.away.pack[k] > 0).map((k) => `${esc(Core.ITEMS[k].name)} ×${v.away.pack[k]}`).join(", ") || "nothing"}</div>
        <button class="btn btn-sm" id="pp-recall2">Call back (keeps what it found)</button>
      </div>` : "";
    const last = v.lastExp && v.lastExp.how ? `
      <div class="pp-trip"><div class="pp-label">Last expedition</div>
        <div>${esc(Core.AREAS[v.lastExp.area].name)}: ${v.lastExp.how === "cleared" ? "cleared" : v.lastExp.how === "fell" ? "fell" : v.lastExp.how === "retreated" ? "came home hurt" : "called back"}
          (${v.lastExp.reached}/${v.lastExp.stages} stages)${v.lastExp.injury ? ` — ${esc(Core.INJURIES[v.lastExp.injury].name)}` : ""} · +${v.lastExp.xp} xp</div>
        <div class="pp-finds">${items(v.lastExp.items)}</div>
        ${(v.lastExp.log || []).length ? `<ol class="pp-runlog">${v.lastExp.log.map((l) => `<li>${esc(l.text)} <small>(${l.hp} hp)</small></li>`).join("")}</ol>` : ""}</div>` : "";
    host.innerHTML = `
      <div class="pp-page">
        ${v.has && v.stage !== "egg" ? `<div class="np-panel np-statstrip">
          ${badge("Health", f.hp, "good")}${badge("Attack", f.att)}${badge("Defence", f.def)}${badge("Dodge", Math.round((f.dodge || 0) * 100) + "%")}
          <span class="stamp">${esc(v.name)}'s fighting strength: its level and kind, what it wears, how happy and fed it is.</span></div>` : ""}
        ${v.injury ? `<div class="pp-injury"><b>${esc(v.name)} has ${esc(v.injury.name)}.</b>
          ${v.injury.treated ? ` Treated — fit again in ${v.injury.healIn} minutes.`
            : ` It won't start to heal until it's treated: ${v.injury.sev === "light" ? "a herbal poultice or stronger" : v.injury.sev === "serious" ? "a healing salve or stronger" : "a strong salve or a restorative balm"} (Apothecary table, Alchemy).
              <div class="pp-row">${meds.map((k) => `<button class="btn btn-sm pp-treat" data-item="${k}"><img alt="" src="${itemIcon(k, 16)}"> ${esc(Core.ITEMS[k].name)} <span class="pp-count">${have(k)}</span></button>`).join("") || `<span class="stamp">None in the bag.</span>`}</div>`}</div>` : ""}
        ${awayBox}${last}
        ${why ? `<p class="pp-why">${esc(why)}</p>` : ""}
        ${!v.away && v.has && v.stage !== "egg" ? partyHTML(s, now) : ""}
        ${!v.away ? `<div class="pp-group"><div class="pp-label">Pack (${kinds.length} of ${Core.packSlots(s) + haulers()} kinds): food heals on the road, draughts are drunk at the start, medicine treats an injury at once</div>
          <div class="pp-row">${usable.length ? usable.map((k) => `<span class="pp-packitem${pack[k] ? " on" : ""}" title="${esc(what(k))}">
              <img alt="" src="${itemIcon(k, 16)}"> ${esc(Core.ITEMS[k].name)} <small>(${have(k)})</small>
              <button class="pp-pk" data-k="${k}" data-d="-1" ${pack[k] ? "" : "disabled"}>−</button><b>${pack[k] || 0}</b>
              <button class="pp-pk" data-k="${k}" data-d="1" ${(pack[k] || 0) >= Math.min(10, have(k)) || (!pack[k] && kinds.length >= Core.packSlots(s) + haulers()) ? "disabled" : ""}>+</button></span>`).join("")
            : `<span class="stamp">Nothing to carry yet — cooked food, draughts and salves (Kitchen and Apothecary table).</span>`}</div></div>` : ""}
        <p class="pp-status" id="pp-status">${esc(status)}</p>
        <div class="pp-areas">${areas.map((a) => a.later ? `
          <div class="pp-area later"><b>${esc(a.name)}</b><div class="stamp">Pet level ${a.level}${a.note ? ` · ${esc(a.note)}` : ""} · coming in a later update</div></div>` : `
          <div class="pp-area${a.open ? "" : " locked"}">
            <div class="pp-skill-head"><b>${esc(a.name)}</b><span class="pp-level">${a.open ? `${a.stages} stages` : `Level ${a.level}`}</span></div>
            <div class="pp-mastery" title="Area level">${[1, 2, 3, 4, 5].map((i) => `<span class="${i <= a.mastery ? "on" : ""}"></span>`).join("")}
              <small>${a.mastery >= 5 ? "Mastered" : `${a.toNextMastery} more clears to area level ${a.mastery + 1}`}</small></div>
            <div class="stamp">${a.minutes >= 60 ? (a.minutes / 60) + " h" : a.minutes + " min"} · pet level ${a.level} · ${esc(a.foes.join(", "))}; guardian: ${esc(a.guardian)}</div>
            <div class="stamp pp-danger">If ${v.has ? esc(v.name) : "your pet"} falls here: ${a.deadly
              ? `${Math.round(a.deadly * 100)}% it dies, otherwise ${esc(a.fallName)}` : esc(a.fallName)}</div>
            ${a.lock ? `<div class="stamp pp-lock">🔒 ${esc(a.lock)}</div>` : ""}
            ${a.flying && !a.canFly ? `<div class="stamp pp-lock">Only a flying pet can reach it — a chicken, a duck or a gull.</div>` : ""}
            <div class="pp-finds">${a.loot.map((k) => `<img alt="" title="${esc(Core.ITEMS[k].name)}" src="${itemIcon(k, 20)}">`).join("")}
              <img alt="" title="${esc(Core.ITEMS[a.crate].name)} (on a clear, sometimes)" src="${itemIcon(a.crate, 20)}">
              <img alt="" title="${esc(Core.ITEMS[a.egg].name)} (on a clear, rarely)" src="${itemIcon(a.egg, 20)}"></div>
            <button class="btn btn-sm pp-send" data-area="${a.id}" ${a.open && !why && !v.away ? "" : "disabled"}>Send ${v.has && v.stage !== "egg" ? esc(v.name) : ""}</button>
          </div>`).join("")}</div>
      </div>`;
    const err = (r) => { if (r && r.error) { status = r.error; toast(r.error, true); const el = host.querySelector("#pp-status"); if (el) el.textContent = status; } };
    host.querySelectorAll(".pp-pk").forEach((b) => b.addEventListener("click", () => {
      const k = b.dataset.k; pack[k] = Math.max(0, (pack[k] || 0) + Number(b.dataset.d)); if (!pack[k]) delete pack[k]; render();
    }));
    host.querySelectorAll(".pp-treat").forEach((b) => b.addEventListener("click", async () => err(await act("treat", {item: b.dataset.item}))));
    const rc = host.querySelector("#pp-recall2");
    if (rc) rc.addEventListener("click", () => act("recall"));
    host.querySelectorAll(".pp-send").forEach((b) => b.addEventListener("click", async () => {
      const r = await act("expedition", {area: b.dataset.area, pack: Object.assign({}, pack), party: party.filter((m) => m.id).map((m) => ({id: m.id, role: m.role})), roll: Math.random()});
      if (r && r.error) err(r); else { pack = {}; party.forEach((m) => { m.id = ""; }); }
    }));
    host.querySelectorAll(".pp-party-pet").forEach((sel) => sel.addEventListener("change", () => { party[+sel.dataset.i].id = sel.value; render(); }));
    host.querySelectorAll(".pp-party-role").forEach((sel) => sel.addEventListener("change", () => { party[+sel.dataset.i].role = sel.value; render(); }));
    everySecond("exp");
    if (v.away) everySecond("exp", () => {
      if (!host.isConnected || page() !== "pet:expeditions") return false;
      const c = current();
      if (!c.v.away || c.v.away.stage !== v.away.stage) render();
      else { const w = host.querySelector("#pp-next"); if (w) w.textContent = clock(c.v.away.backIn); }
    });
  }

  // ---- the bench, redesigned (2026-10-19; Cam, with RuneScape's Cooking screen: "reinvent it to look like this but with our
  //      design ... and still have the ability to click something and then click the work bench"; Q6: every bench, split by
  //      what it's made from, a click picks, Use with... lights the benches). Left: the bench's whole list as painted icons
  //      under tabs, locked ones greyed with their level. Right: the one you picked -- what it does, what it needs (ticked or
  //      crossed), the amount and Make. From the bag, "From your bag: X" shows what X makes here first.
  let benchTab = {}, benchSel = {}, benchFrom = "", benchQuery = {};
  const METALS = ["bronze", "iron", "steel", "mithril", "adamant", "rune", "gold", "silver", "copper", "tin"];
  const WOODS = ["oak", "willow", "maple", "yew", "magic", "teak", "mahogany", "pine", "birch", "ash", "palm"];
  const GEMS = ["opal", "jade", "topaz", "sapphire", "emerald", "ruby", "diamond", "amethyst", "quartz", "obsidian", "pearl", "onyx"];
  const FISHY = ["shrimp", "sardine", "herring", "trout", "salmon", "tuna", "pike", "perch", "lobster", "swordfish", "shark", "monkfish", "crab", "eel", "cod", "mackerel", "bass", "carp", "ray", "fish"];
  const MEATY = ["pork", "beef", "chicken", "mutton", "venison", "meat", "rabbit", "duck", "boar", "bear", "egg", "steak"];
  /** Which tab a recipe goes under: what it's made from (Q6 q2). */
  function benchGroup(w, r) {
    const ids = [r.make].concat(r.needs.map((n) => n.id)), has = (list) => list.find((x) => ids.some((k) => k.includes(x)));
    if (w.skill === "cooking") {
      const it = Core.ITEMS[r.make] || {};
      if (it.food && !it.heal) return "Pet treats";
      if (has(["tea", "juice", "milk", "cider", "coffee"])) return "Drinks";
      if (has(FISHY)) return "Fish";
      if (has(MEATY)) return "Meat and eggs";
      return "Baking and sweets";
    }
    const m = has(METALS) || has(WOODS) || has(GEMS);
    if (m) return m.charAt(0).toUpperCase() + m.slice(1);
    const n0 = r.needs[0]; return n0 ? n0.name : "Other";
  }
  /** The bench's tabs: [name, recipes], biggest first, at most 8 (+ Other). */
  function benchGroups(w) {
    const g = {};
    w.recipes.forEach((r) => { const k = benchGroup(w, r); (g[k] = g[k] || []).push(r); });
    let list = Object.entries(g).sort((a, b) => Math.min(...a[1].map((r) => r.level)) - Math.min(...b[1].map((r) => r.level)));
    if (list.length > 9) {
      const big = list.slice().sort((a, b) => b[1].length - a[1].length).slice(0, 8).map((x) => x[0]);
      const other = list.filter((x) => !big.includes(x[0])).flatMap((x) => x[1]);
      list = list.filter((x) => big.includes(x[0])).concat([["Other", other]]);
    }
    return list;
  }
  const benchVerb = (w) => w.skill === "cooking" ? "Cook" : w.npc ? "Transmute" : w.id === "furnace" ? "Smelt" : w.id === "tanner" ? "Tan" : "Make";
  /** Is a recipe one this bench can draw this way (not the grindstone, trades, orders...)? */
  function benchPlain(w) { return !w.grind && !w.trade && !w.reskin && !w.identify && !w.orders && !w.altar && (w.recipes || []).length > 0; }
  function benchHTML(w) {
    const groups = benchGroups(w), q = (benchQuery[w.id] || "").trim().toLowerCase();
    const from = benchFrom && w.recipes.some((r) => r.needs.some((n) => n.id === benchFrom)) ? benchFrom : "";
    let tab = benchTab[w.id];
    if (from) tab = "@from";
    else if (!tab || (tab !== "All" && !groups.some((g) => g[0] === tab))) tab = "All";   // (opens on the whole list)
    let shown = tab === "@from" ? w.recipes.filter((r) => r.needs.some((n) => n.id === from)) : tab === "All" ? w.recipes.slice() : (groups.find((g) => g[0] === tab) || [0, []])[1].slice();
    if (q) shown = w.recipes.filter((r) => [r.name, r.does || "", ...r.needs.map((n) => n.name)].join(" ").toLowerCase().includes(q));
    shown.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
    let sel = w.recipes.find((r) => r.i === benchSel[w.id]);
    if (!sel || !shown.includes(sel)) sel = shown.find((r) => r.can) || shown.find((r) => r.open && !r.roomLock) || shown[0];
    const cell = (r) => `<button class="pp-bcell${r === sel ? " on" : ""}${r.open && !r.roomLock ? "" : " lock"}${r.can ? " can" : ""}" data-bsel="${r.i}" title="${esc(r.name)}${r.open ? "" : ` -- level ${r.level}`}">
        <img alt="" src="${itemIcon(r.make, 48)}"><span class="lv">${r.level}</span>${r.open && !r.roomLock ? "" : `<span class="pad">locked</span>`}${r.have ? `<span class="have">${r.have}</span>` : ""}</button>`;
    const tick = (ok) => `<i class="${ok ? "ok" : "no"}">${ok ? "✓" : "✕"}</i>`;
    const right = !sel ? `<p class="stamp">Nothing here matches.</p>` : (() => {
      const lacking = sel.needs.filter((n) => n.have < n.need).map((n) => n.name.toLowerCase());
      const feeOk = !sel.fee || w.coins >= sel.fee, max = Math.min(1000, sel.times || 0);
      return `<div class="pp-bdetail-top"><img alt="" src="${itemIcon(sel.make, 64)}"><div><b>${sel.n > 1 ? sel.n + " × " : ""}${esc(sel.name)}</b>
          <div class="pp-bdoes">${(sel.does || "").split(" · ").filter(Boolean).map((t) => `<span>${esc(t)}</span>`).join("")}${sel.xp ? `<span>+${sel.xp} xp each</span>` : ""}${sel.have ? `<span>${sel.have} in your bag</span>` : ""}</div></div></div>
        <div class="pp-label">Requirements</div>
        <div class="pp-breq${sel.open ? " ok" : " no"}"><span>${esc(w.skill ? Core.SKILLS[w.skill].name : w.name)} level ${sel.level}</span><b>yours: ${w.level || "—"}</b>${tick(sel.open)}</div>
        ${sel.roomLock ? `<div class="pp-breq no"><span>${esc(sel.roomLock)}</span><b></b>${tick(false)}</div>` : w.room ? `<div class="pp-breq ok"><span>${esc(w.roomName || "The room")}</span><b></b>${tick(true)}</div>` : ""}
        ${sel.fee ? `<div class="pp-breq${feeOk ? " ok" : " no"}"><span>A fee of ${coinTxt(sel.fee)}</span><b>${coinTxt(w.coins)}</b>${tick(feeOk)}</div>` : ""}
        <div class="pp-label">Materials</div>
        ${sel.needs.map((n) => `<div class="pp-bmat${n.have >= n.need ? " ok" : " no"}" data-iteminfo="${n.id}" title="${esc(n.name)}${n.stored ? ` (${n.stored.toLocaleString()} in the bank)` : ""}"><img alt="" src="${itemIcon(n.id, 24)}"><span>${esc(n.name)}</span><b>${n.have.toLocaleString()}/${n.need}</b>${tick(n.have >= n.need)}</div>`).join("")}
        <div class="pp-bamt"><button class="btn btn-sm" data-bstep="-1" ${max ? "" : "disabled"} aria-label="One fewer">−</button>
          <input type="range" class="pp-bslide" min="${max ? 1 : 0}" max="${max}" value="${max ? Math.min(max, +(benchAmt[w.id + sel.i] || max)) : 0}" ${max ? "" : "disabled"} aria-label="How many">
          <button class="btn btn-sm" data-bstep="1" ${max ? "" : "disabled"} aria-label="One more">+</button>
          <input class="input pp-bnum" type="number" min="${max ? 1 : 0}" max="${max}" value="${max ? Math.min(max, +(benchAmt[w.id + sel.i] || max)) : 0}" ${max ? "" : "disabled"} aria-label="How many, as a number"></div>
        <p class="stamp pp-bget">${max ? `Enough for ${max.toLocaleString()}.` : !sel.open ? `Train ${esc(w.skill ? Core.SKILLS[w.skill].name : "it")} to level ${sel.level} first.` : sel.roomLock ? esc(sel.roomLock) + "." : lacking.length ? `Enough for none -- missing ${esc(lacking.join(", "))}.` : !feeOk ? "Not enough coins for the fee." : "You can't make it yet."}</p>
        <button class="btn btn-primary pp-bmake" data-bmake="${sel.i}" ${max ? "" : "disabled"}>${benchVerb(w).toUpperCase()}</button>`;
    })();
    return `<div class="pp-bench">
      <div class="pp-bleft">
        ${from ? `<div class="pp-bfrom">From your bag: <b>${esc(Core.ITEMS[from].name.toLowerCase())}</b> -- what it makes here. <button class="btn btn-sm btn-quiet" data-bfromx>Show everything</button></div>` : ""}
        ${groups.length > 1 ? `<div class="pp-btabs">${(from ? [["@from", []]] : []).concat([["All", w.recipes]], groups).map(([k, v]) => k === "@from" ? `<button class="pp-btab on" data-btab="@from">${esc(Core.ITEMS[from].name)}</button>`
          : `<button class="pp-btab${k === tab ? " on" : ""}" data-btab="${esc(k)}">${esc(k)} <small>${v.length}</small></button>`).join("")}</div>` : ""}
        <input class="input pp-bq" type="search" placeholder="Find a recipe or an ingredient…" value="${esc(benchQuery[w.id] || "")}" aria-label="Find a recipe">
        <div class="pp-bgrid">${shown.map(cell).join("") || `<p class="stamp">Nothing here matches.</p>`}</div>
      </div>
      <div class="pp-bright">${right}</div></div>`;
  }
  let benchAmt = {};
  /** Wire a bench drawn by benchHTML inside `card`; `run(action, opts)` acts and redraws. */
  function benchWire(card, w, run, redraw) {
    card.querySelectorAll("[data-bsel]").forEach((b) => b.addEventListener("click", () => { benchSel[w.id] = +b.dataset.bsel; redraw(); }));
    card.querySelectorAll("[data-btab]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.btab !== "@from") { benchFrom = ""; benchTab[w.id] = b.dataset.btab; } benchQuery[w.id] = ""; redraw(); }));
    const fx = card.querySelector("[data-bfromx]"); if (fx) fx.addEventListener("click", () => { benchFrom = ""; redraw(); });
    const bq = card.querySelector(".pp-bq");
    if (bq) bq.addEventListener("input", () => { benchQuery[w.id] = bq.value; const at = bq.selectionStart; redraw(); const n = card.querySelector(".pp-bq"); if (n) { n.focus(); n.setSelectionRange(at, at); } });
    const sl = card.querySelector(".pp-bslide"), nb = card.querySelector(".pp-bnum"), mk = card.querySelector(".pp-bmake");
    const set = (v) => { if (!sl) return; const n = Math.max(+sl.min, Math.min(+sl.max, Math.floor(+v) || 0)); sl.value = nb.value = n; if (mk) benchAmt[w.id + mk.dataset.bmake] = n; };
    if (sl) { sl.addEventListener("input", () => set(sl.value)); nb.addEventListener("input", () => set(nb.value)); }
    card.querySelectorAll("[data-bstep]").forEach((b) => b.addEventListener("click", () => set(+nb.value + +b.dataset.bstep)));
    if (mk) mk.addEventListener("click", () => { const r = w.recipes.find((x) => x.i === +mk.dataset.bmake); if (r) run("craft", {workshop: w.id, make: r.make, i: r.i, times: Math.max(1, +nb.value || 1)}); });
  }
  /** Which of your own benches (the estate's) make something from `id`: [bench id]. */
  function benchesUsing(id) {
    const {s, now} = current();
    return Core.villageView(s, now).filter((w) => !w.npc && benchPlain(w) && w.recipes.some((r) => r.needs.some((n) => n.id === id))).map((w) => w.id);
  }
  /** Is `id` an ingredient at one of your own benches? (static: the recipes, worked out once -- cheap enough for every bag card) */
  let BENCH_USES = null;
  function benchUses(id) {
    if (!BENCH_USES) { BENCH_USES = new Set(); Object.values(Core.WORKSHOPS).forEach((w) => { if (!w.npc) (w.recipes || []).forEach((r) => Object.keys(r.needs || {}).forEach((k) => BENCH_USES.add(k))); }); }
    return BENCH_USES.has(id);
  }
  // ---- I5 b6 (kept in Q6): quest items show who wants them -- each person's quest in hand (the first not done that's open)
  function questWants(s) {
    const out = {}, done = s.quests || {};
    Object.keys(Core.PEOPLE).forEach((p) => {
      const P = Core.PEOPLE[p], q = (P.quests || []).find((x) => !done[x.id] && Core.questOpen(s, x));
      if (!q) return;
      (q.needs || []).forEach((n) => Object.keys(n.bring || {}).forEach((k) => { out[k] = out[k] || {person: p, name: P.name, look: P.look, quest: q.name, need: n.bring[k]}; }));
    });
    return out;
  }
  document.addEventListener("click", (e) => {
    const f = e.target.closest && e.target.closest("[data-qperson]"); if (!f) return;
    e.preventDefault(); e.stopPropagation();
    const r = f.dataset.qperson; if (Core.REGIONS[r]) { worldRegion = r; goTo("pet:world"); } else goTo("pet:world");
  }, true);
  // ---- the How to Play book (2026-10-20) ------------------------------------------------------------------------------------
  //      Amunet's guide, read from the bag in the class books' reader: a contents page, then a page a chapter with its photo
  //      (art/guide/<shot>.webp, made by tools/make_guide.js -- the same chapters print to the PDF on Scribe's Ebooks shelf).
  function guidePages() {
    const G = Core.HOW_TO_PLAY, shot = (k) => k && window.GUIDE_SHOTS && window.GUIDE_SHOTS[k] ? `<img class="gh-shot" alt="" src="art/guide/${k}.webp">` : "";
    const contents = `<h2 class="gh-title">${esc(G.title)}</h2><p class="gh-sub">${esc(G.subtitle)}</p>
      <ol class="gh-contents">${G.chapters.map((c, i) => `<li><button class="gh-link" data-bookto="${i + 1}">${esc(c.title)}</button></li>`).join("")}</ol>
      <p class="gh-note">This book is also on NeuroNet's Scribe shelf, under Ebooks.</p>`;
    return [{head: G.title, html: contents}].concat(G.chapters.map((c) => ({head: G.title, html: `<h3 class="gh-chapter">${esc(c.title)}</h3>${shot(c.shot)}
      ${c.paras.map((p) => `<p>${esc(p)}</p>`).join("")}
      ${c.tips && c.tips.length ? `<div class="gh-tips"><b>Good to know</b><ul>${c.tips.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div>` : ""}
      <button class="gh-link gh-tocback" data-bookto="0">Contents</button>`})));
  }
  let guideShelved = false;
  /** Put the PDF on Scribe's Ebooks shelf (once a run; NeuroNet adds it or refreshes it in place). */
  async function guideToScribe() {
    if (guideShelved || slot === "dev") return;
    guideShelved = true;
    try { await SS.Store.call("guide_to_scribe", []); } catch (e) { /* NeuroNet's shelf is a nicety: the book's in the bag anyway */ }
  }
  function openGuide() { openPages(guidePages(), Core.HOW_TO_PLAY.title, 0, "gh-guide"); guideToScribe(); }
  everySecond("guideshelf", () => { const s = current().s; if (s && s.player && s.player.made && Core.hasGuide(s)) { guideToScribe(); return false; } return true; });
  // ---- every bench-like window looks like the crafting bench (2026-10-20, Cam: "i want the recycle UI and all the other benches
  //      to match the UI for crafting benches now please ... the recycle UI is the old list format and i dont like that it
  //      results in excess scrolling. Please fix all instances of these types of menus"). One layout for the merchants, the
  //      Grindstone, the herb table, the notice board, the altar, the recycle stash and the cart: tabs, a search and a grid of
  //      icons on the left; the one you picked on the right -- what it is, what it takes, an amount and the button.
  //   gridBenchHTML(key, tabs, detail): tabs = [{id, label, items: [{key, icon, name, find?, badge?, corner?, lock?, can?, note?}],
  //   empty?}]; detail(item, tab) -> the right-hand side. gridBenchWire(card, key, redraw) wires tabs, picks, search and the amount.
  const gbTab = {}, gbSel = {}, gbQuery = {}, gbAmt = {};
  function gridBenchHTML(key, tabs, detail) {
    tabs = tabs.filter(Boolean);
    let tab = tabs.find((t) => t.id === gbTab[key]) || tabs.find((t) => t.items.length) || tabs[0];
    const q = (gbQuery[key] || "").trim().toLowerCase();
    let shown = tab.items;
    if (q) shown = shown.filter((x) => (x.find || x.name).toLowerCase().includes(q));
    let sel = shown.find((x) => x.key === gbSel[key]) || shown.find((x) => x.can) || shown[0] || null;
    const cell = (x) => `<button class="pp-bcell${x === sel ? " on" : ""}${x.lock ? " lock" : ""}${x.can ? " can" : ""}" data-gbsel="${esc(x.key)}" title="${esc(x.name)}${x.note ? " -- " + esc(x.note) : ""}">
        <img alt="" src="${x.icon}">${x.corner ? `<span class="lv">${esc(String(x.corner))}</span>` : ""}${x.badge ? `<span class="have">${esc(String(x.badge))}</span>` : ""}${x.lock ? `<span class="pad">${esc(x.lockWord || "locked")}</span>` : ""}</button>`;
    return `<div class="pp-bench pp-gbench" data-gb="${esc(key)}">
      <div class="pp-bleft">
        ${tabs.length > 1 ? `<div class="pp-btabs">${tabs.map((t) => `<button class="pp-btab${t === tab ? " on" : ""}" data-gbtab="${esc(t.id)}">${esc(t.label)} <small>${t.items.length}</small></button>`).join("")}</div>` : ""}
        ${tab.items.length > 10 ? `<input class="input pp-bq pp-gbq" type="search" placeholder="Find…" value="${esc(gbQuery[key] || "")}" aria-label="Find">` : ""}
        <div class="pp-bgrid">${shown.map(cell).join("") || `<p class="stamp">${esc(q ? "Nothing here matches." : tab.empty || "Nothing here yet.")}</p>`}</div>
      </div>
      <div class="pp-bright">${sel ? detail(sel, tab.id) : `<p class="stamp">${esc(tab.empty || "Nothing to pick.")}</p>`}</div></div>`;
  }
  /** The amount row of a detail (the crafting bench's): − slider + and a number, up to max. */
  function gbAmountHTML(key, max, start) {
    const v = max ? Math.max(1, Math.min(max, +(gbAmt[key] || start || max))) : 0;
    return `<div class="pp-bamt"><button class="btn btn-sm" data-bstep="-1" ${max ? "" : "disabled"} aria-label="One fewer">−</button>
      <input type="range" class="pp-bslide" min="${max ? 1 : 0}" max="${max}" value="${v}" ${max ? "" : "disabled"} aria-label="How many" data-gbamt="${esc(key)}">
      <button class="btn btn-sm" data-bstep="1" ${max ? "" : "disabled"} aria-label="One more">+</button>
      <input class="input pp-bnum" type="number" min="${max ? 1 : 0}" max="${max}" value="${v}" ${max ? "" : "disabled"} aria-label="How many, as a number"></div>`;
  }
  /** How many the amount row says (1 if there's none): el is the button pressed (its own grid) or the window around one. */
  function gbAmount(el) { const g = el.closest && el.closest(".pp-gbench"), nb = g ? g.querySelector(".pp-bnum") : el.querySelector(".pp-gbench .pp-bnum"); return nb ? Math.max(1, Math.floor(+nb.value) || 1) : 1; }
  function gridBenchWire(card, key, redraw) {
    const root = card.querySelector(`.pp-gbench[data-gb="${CSS.escape(key)}"]`);
    if (!root) return;
    root.querySelectorAll("[data-gbtab]").forEach((b) => b.addEventListener("click", () => { gbTab[key] = b.dataset.gbtab; gbQuery[key] = ""; redraw(); }));
    root.querySelectorAll("[data-gbsel]").forEach((b) => b.addEventListener("click", () => { gbSel[key] = b.dataset.gbsel; redraw(); }));
    const q = root.querySelector(".pp-gbq");
    if (q) q.addEventListener("input", () => { gbQuery[key] = q.value; const at = q.selectionStart; redraw();
      const n = card.querySelector(`.pp-gbench[data-gb="${CSS.escape(key)}"] .pp-gbq`); if (n) { n.focus(); n.setSelectionRange(at, at); } });
    const sl = root.querySelector(".pp-bslide"), nb = root.querySelector(".pp-bnum");
    const set = (v) => { if (!sl) return; const n = Math.max(+sl.min, Math.min(+sl.max, Math.floor(+v) || 0)); sl.value = nb.value = n; gbAmt[sl.dataset.gbamt] = n; root.querySelectorAll("[data-gbeach]").forEach((e) => { e.textContent = e.dataset.gbunit === "coin" ? coinTxt(Math.floor(n * +e.dataset.gbeach)) : (Math.round(n * +e.dataset.gbeach * 100) / 100).toLocaleString(); }); };
    if (sl) { sl.addEventListener("input", () => set(sl.value)); nb.addEventListener("input", () => set(nb.value)); }
    root.querySelectorAll("[data-bstep]").forEach((b) => b.addEventListener("click", () => set(+nb.value + +b.dataset.bstep)));
  }
  /** A detail's head: the picture, the name, a line or two of chips. */
  const gbHead = (icon, title, chips) => `<div class="pp-bdetail-top"><img alt="" src="${icon}"><div><b>${title}</b><div class="pp-bdoes">${(chips || []).filter(Boolean).map((t) => `<span>${t}</span>`).join("")}</div></div></div>`;
  const gbMat = (id, txt, ok) => `<div class="pp-bmat${ok === false ? " no" : ok ? " ok" : ""}" data-iteminfo="${id}" title="${esc(Core.ITEMS[id] ? Core.ITEMS[id].name : id)}"><img alt="" src="${itemIcon(id, 24)}"><span>${txt}</span></div>`;
  // ---- the place editor (2026-10-15, audit FUT-2; Cam: "start working on the place editor") ------------------
  // Scene positions were measured by hand (`at: [x, y, width]`), an hour a new painting. Here, in the sandbox: pick a
  // scene, drag a place's scroll where it's painted, drag its dot onto the painted thing it names (or Alt/Shift-click
  // there), pull the corner for its size -- then Save writes art/places.js (pet.places_write) and the game uses it at
  // once. Places the game expects but the painting doesn't have yet are listed: click one to drop it in the middle.
  const PE_PIC = {islandestate: "estate-desert-4"};                  // scenes whose picture isn't art/<scene>.webp
  const pe = {scene: "", sel: "", doc: null, dirty: false};
  function peDoc() {
    if (!pe.doc) pe.doc = JSON.parse(JSON.stringify(window.SCENE_PLACES || {"//": {}}));
    if (!pe.doc["//"]) pe.doc["//"] = {};
    return pe.doc;
  }
  const peScenes = () => Object.keys(peDoc()).filter((k) => k !== "//").sort();
  /** The places a scene should have, from the rules: a region's spots, ground, expedition and person; a scene's benches. */
  function peExpected(id) {
    const out = [];
    if (Core.REGIONS[id]) {
      Core.GATHERING.forEach((k) => Core.SKILLS[k].spots.forEach((sp) => { if (sp.area === id && !sp.essence) out.push(k + ":" + sp.id); }));
      if (Core.HUNTS[id]) out.push("hunt");
      if (Core.REGIONS[id].expedition) out.push("exp");
      if (Core.PEOPLE[id]) out.push("person");
    }
    if (id === "workshop") Object.keys(Core.WORKSHOPS).filter((k) => !Core.WORKSHOPS[k].npc && !Core.WORKSHOPS[k].region).forEach((k) => out.push(k));
    if (id === "village") Object.keys(Core.WORKSHOPS).filter((k) => Core.WORKSHOPS[k].npc && !Core.WORKSHOPS[k].region).forEach((k) => out.push(k));
    if (id === "ranch") Core.RANCH_ORDER.forEach((k) => out.push(k));
    return out;
  }
  function pePlaces(id) {
    const places = peDoc()[id] || {};
    return Object.keys(places).map((k) => {
      const a = places[k], [cx, cy, w, h = 56] = a.at, o = a.o, on = k === pe.sel;
      return `<g class="pp-pe-place${on ? " on" : ""}" data-pe="${esc(k)}">
        ${o ? `<line class="pp-pe-link" x1="${cx}" y1="${cy}" x2="${o[0]}" y2="${o[1]}"/>
          <circle class="pp-pe-dot" data-pe-drag="o" cx="${o[0]}" cy="${o[1]}" r="${on ? 22 : 16}"/>` : ""}
        <rect class="pp-pe-scroll" data-pe-drag="at" x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" rx="10"/>
        <text class="pp-pe-name" x="${cx}" y="${cy - h / 2 - 10}">${esc(a.chip || k)}</text>
        ${on ? `<rect class="pp-pe-size" data-pe-drag="size" x="${cx + w / 2 - 14}" y="${cy + h / 2 - 14}" width="28" height="28" rx="6"/>` : ""}
      </g>`;
    }).join("");
  }
  function peSVG(id) {
    return `<svg class="pp-world-map pp-pe-map" viewBox="0 0 ${WORLD_W} ${WORLD_H}" role="application" aria-label="Place editor: ${esc(id)}">
      <image href="art/${PE_PIC[id] || id}.webp" x="0" y="0" width="${WORLD_W}" height="${WORLD_H}"/><g class="pp-pe-places">${pePlaces(id)}</g></svg>`;
  }
  function peFields() {
    const a = pe.sel && (peDoc()[pe.scene] || {})[pe.sel];
    if (!a) return `<p class="stamp">Pick a place on the picture or in the list.</p>`;
    const [x, y, w, h = 56] = a.at, o = a.o || [];
    const num = (f, v, label) => `<label class="pp-pe-field"><span>${label}</span><input class="input pp-num" type="number" data-pe-f="${f}" value="${v === undefined ? "" : v}"></label>`;
    return `<b class="pp-pe-key">${esc(pe.sel)}</b>
      <div class="pp-pe-fields">${num("x", x, "Scroll x")}${num("y", y, "Scroll y")}${num("w", w, "Width")}${num("h", h, "Height")}
        ${num("ox", o[0], "Thing x")}${num("oy", o[1], "Thing y")}</div>
      <label class="pp-pe-field wide"><span>Not painted yet? A little scroll saying</span><input class="input" data-pe-f="chip" maxlength="40" value="${esc(a.chip || "")}" placeholder="(painted -- leave empty)"></label>
      <div class="pp-row"><button class="btn btn-sm" id="pe-noo"${a.o ? "" : " disabled"}>No painted thing</button>
        <button class="btn btn-sm" id="pe-del">Remove this place</button></div>`;
  }
  function renderPlaces(host) {
    const scenes = peScenes();
    if (!pe.scene || !scenes.includes(pe.scene)) pe.scene = scenes[0] || "";
    const places = peDoc()[pe.scene] || {}, missing = peExpected(pe.scene).filter((k) => !places[k]);
    host.innerHTML = `
      <div class="pp-page pp-pe">
        <div class="pp-pe-bar">
          <select class="input" id="pe-scene" aria-label="Scene">${scenes.map((k) => `<option value="${esc(k)}"${k === pe.scene ? " selected" : ""}>${esc(k)}</option>`).join("")}</select>
          <button class="btn btn-primary" id="pe-save"${pe.dirty ? "" : " disabled"}>Save places</button>
          <button class="btn" id="pe-copy">Copy this scene</button>
          <button class="btn" id="pe-undo"${pe.dirty ? "" : " disabled"}>Undo changes</button>
          <span class="stamp">${pe.dirty ? "Not saved yet." : "Saved."} Drag a scroll or its dot · click the picture to move the chosen scroll there, Alt/Shift-click for its dot · arrows nudge (Shift: 10)</span>
        </div>
        <div class="pp-pe-main">
          <div class="pp-world pp-painted pp-pe-pic">${peSVG(pe.scene)}</div>
          <aside class="pp-shop pp-pe-side">
            ${peFields()}
            <b>Places (${Object.keys(places).length})</b>
            <div class="pp-pe-list">${Object.keys(places).map((k) => `<button class="np-chip${k === pe.sel ? " on" : ""}" data-pe-pick="${esc(k)}">${esc(k)}</button>`).join("")}</div>
            ${missing.length ? `<b>Not on the picture yet</b><div class="pp-pe-list">${missing.map((k) => `<button class="np-chip" data-pe-add="${esc(k)}">+ ${esc(k)}</button>`).join("")}</div>` : ""}
            <div class="pp-row"><input class="input" id="pe-newkey" placeholder="another place (e.g. pet:camp)" maxlength="60"><button class="btn btn-sm" id="pe-add">Add</button></div>
          </aside>
        </div>
      </div>`;
    peWire(host);
  }
  function peChanged(host) { pe.dirty = true; renderPlaces(host); }
  function peWire(host) {
    const q = (s) => host.querySelector(s), places = () => peDoc()[pe.scene] || (peDoc()[pe.scene] = {});
    q("#pe-scene").addEventListener("change", (e) => { pe.scene = e.target.value; pe.sel = ""; renderPlaces(host); });
    host.querySelectorAll("[data-pe-pick]").forEach((b) => b.addEventListener("click", () => { pe.sel = b.dataset.pePick; renderPlaces(host); }));
    const add = (k) => {
      k = String(k || "").trim();
      if (!/^[A-Za-z0-9:@#_.-]{1,60}$/.test(k)) { toast("A place's key is letters, numbers and : @ # _ . - only.", true); return; }
      if (!places()[k]) places()[k] = {at: [WORLD_W / 2, WORLD_H / 2, 220]};
      pe.sel = k; peChanged(host);
    };
    host.querySelectorAll("[data-pe-add]").forEach((b) => b.addEventListener("click", () => add(b.dataset.peAdd)));
    q("#pe-add").addEventListener("click", () => add(q("#pe-newkey").value));
    host.querySelectorAll("[data-pe-f]").forEach((i) => i.addEventListener("change", () => {
      const a = places()[pe.sel]; if (!a) return;
      const f = i.dataset.peF, n = Math.round(Number(i.value));
      if (f === "chip") { if (i.value.trim()) a.chip = i.value.trim().slice(0, 40); else delete a.chip; }
      else if (!Number.isFinite(n)) return;
      else if (f === "x" || f === "y" || f === "w") a.at[{x: 0, y: 1, w: 2}[f]] = n;
      else if (f === "h") { if (n === 56) a.at.length = 3; else a.at[3] = n; }
      else { a.o = a.o || [a.at[0], a.at[1] + 120]; a.o[f === "ox" ? 0 : 1] = n; }
      peChanged(host);
    }));
    const noo = q("#pe-noo"); if (noo) noo.addEventListener("click", () => { delete places()[pe.sel].o; peChanged(host); });
    const del = q("#pe-del"); if (del) del.addEventListener("click", () => { delete places()[pe.sel]; pe.sel = ""; peChanged(host); });
    q("#pe-undo").addEventListener("click", () => { pe.doc = null; pe.dirty = false; pe.sel = ""; renderPlaces(host); });
    q("#pe-copy").addEventListener("click", async () => {
      const text = JSON.stringify({[pe.scene]: places()});
      try { await navigator.clipboard.writeText(text); toast("Copied " + pe.scene + "'s places."); } catch (e) { toast("Couldn't reach the clipboard.", true); }
    });
    q("#pe-save").addEventListener("click", async () => {
      const r = await call("places_save", [peDoc()], "Saving the places");
      if (!r || r.error) { toast((r && r.error) || "Couldn't save the places.", true); return; }
      window.SCENE_PLACES = JSON.parse(JSON.stringify(peDoc()));
      Object.keys(SCENE_ART).forEach((k) => delete SCENE_ART[k]);                  // the game's scenes use them at once
      Object.keys(window.SCENE_PLACES).filter((k) => k !== "//").forEach((k) => { SCENE_ART[k] = JSON.parse(JSON.stringify(window.SCENE_PLACES[k])); });
      pe.dirty = false; toast("Saved the places (art/places.js)."); renderPlaces(host);
    });
    // dragging: a scroll moves its middle, the dot moves the painted thing, the corner sizes the scroll
    const svg = q(".pp-pe-map");
    const at = (e) => { const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; const m = svg.getScreenCTM(); const r = m ? p.matrixTransform(m.inverse()) : p; return [Math.round(r.x), Math.round(r.y)]; };
    let drag = null;
    svg.addEventListener("pointerdown", (e) => {
      const g = e.target.closest("[data-pe]"), what = e.target.dataset && e.target.dataset.peDrag, [x, y] = at(e);
      if (g && what) {
        pe.sel = g.dataset.pe;
        const a = places()[pe.sel];
        drag = {what, a, from: [x, y], at0: a.at.slice(), o0: a.o ? a.o.slice() : null};
        try { svg.setPointerCapture(e.pointerId); } catch (err) { /* a made-up pointer (the tests) */ }
        e.preventDefault();
        g.classList.add("on");
        return;
      }
      const a = pe.sel && places()[pe.sel];                                         // on the picture: a dot (Alt/Shift) or the scroll here
      if (!a) return;
      if (e.altKey || e.shiftKey) a.o = [x, y]; else { a.at[0] = x; a.at[1] = y; }
      peChanged(host);
    });
    svg.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const [x, y] = at(e), dx = x - drag.from[0], dy = y - drag.from[1], a = drag.a;
      if (drag.what === "at") { a.at[0] = drag.at0[0] + dx; a.at[1] = drag.at0[1] + dy; }
      else if (drag.what === "o") a.o = [drag.o0[0] + dx, drag.o0[1] + dy];
      else { a.at[2] = Math.max(40, drag.at0[2] + 2 * dx); const h = Math.max(30, (drag.at0[3] || 56) + 2 * dy); if (h === 56) a.at.length = 3; else a.at[3] = h; }
      svg.querySelector(".pp-pe-places").innerHTML = pePlaces(pe.scene);              // mid-drag: the scrolls only, not the painting
    });
    const end = () => { if (drag) { drag = null; peChanged(host); } };
    svg.addEventListener("pointerup", end);
    svg.addEventListener("pointercancel", end);
  }
  // arrows nudge the chosen scroll (Shift: by 10) while the editor is open
  document.addEventListener("keydown", (e) => {
    if (view !== "dev:places" || !pe.sel || !/^Arrow/.test(e.key) || /^(INPUT|SELECT|TEXTAREA)$/.test((e.target && e.target.tagName) || "")) return;
    const a = (peDoc()[pe.scene] || {})[pe.sel]; if (!a || !hostEl) return;
    const n = e.shiftKey ? 10 : 1;
    if (e.key === "ArrowLeft") a.at[0] -= n; if (e.key === "ArrowRight") a.at[0] += n;
    if (e.key === "ArrowUp") a.at[1] -= n; if (e.key === "ArrowDown") a.at[1] += n;
    e.preventDefault(); peChanged(hostEl);
  });
  // ---- Developer -> NeuroPet: the sandbox's tools ----------------------------------------
  function renderDev(host) {
    const {s, v} = current();
    const d = s.dev || {};
    const opt = (list) => list.map(([k, n]) => `<option value="${k}">${esc(n)}</option>`).join("");
    const items = Object.keys(Core.ITEMS).sort((a, b) => Core.ITEMS[a].name.localeCompare(Core.ITEMS[b].name)).map((k) => [k, Core.ITEMS[k].name]);
    // the UX lead's refresh (Cam, PT19 b1: "clean up the sandbox UI and make it more presentable ... looks over the place"):
    // one header for which sandbox you're in, then cards that each do one job -- a title, a line of help, label-left rows
    // PT31 (Cam: "make the tools run horizontal across the screen and have each tool on its line ... tag pills i can click to jump
    // to a specific section"): every card full width, one tool a line, and a pill for each card at the top
    const cards = [], slug = (t) => "dv-sec-" + t.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const card = (icon, title, help, body) => { cards.push(title); return `<section class="pp-shop pp-dev-card" id="${slug(title)}"><h3><img alt="" src="${itemIcon(icon, 24)}">${esc(title)}</h3>
        ${help ? `<p class="stamp">${help}</p>` : ""}${body}</section>`; };
    const row = (label, ctl) => `<div class="pp-dev-row"><span class="pp-dev-label">${label}</span><div class="pp-dev-ctl">${ctl}</div></div>`;
    const bossGrounds = Object.keys(Core.HUNTS).filter((k) => Core.HUNTS[k].boss && Core.HUNTS[k].kills)
      .map((k) => { const hl = (s.hunt || {})[k] || {}; return [k, `${Core.MONSTERS[Core.HUNTS[k].boss].name} -- ${Core.HUNTS[k].name}${hl.wins ? " (beaten)" : ""}`]; });
    const ngOpen = Core.ngUnlocked(s), ngPool = [s.pet].concat(s.den || []).filter((p) => p && p.id && p.hatchAt <= Date.now());
    const lg = ngOpen ? Core.legacyOf(s) : null;
    host.innerHTML = `
      <div class="pp-page pp-dev">
        <header class="pp-shop pp-dev-head">
          <div><b>The sandbox</b><p class="stamp">A copy of the game to test in -- nothing here touches your real game. <b>Everything unlocked</b>: infinite items,
            every level. <b>Plain account</b>: the game's own rules, add what you need.</p></div>
          <div class="pp-dev-seg" id="dv-kinds" role="group" aria-label="Which sandbox"><button class="btn btn-sm" data-sbx="max">Everything unlocked</button><button class="btn btn-sm" data-sbx="plain">Plain account</button></div>
          <div class="pp-row"><button class="btn btn-sm btn-quiet" id="dv-clone">Copy my real game in</button><button class="btn btn-sm btn-quiet" id="dv-fresh">Start a fresh sandbox</button></div>
        </header>
        <nav class="pp-dev-pills" id="dv-pills" aria-label="Jump to a tool"></nav>
        <p class="pp-status" id="pp-status">${esc(status)}</p>
        ${card("obj_sun", "Time and sky", "The clock moves things on (needs, trips, eggs, expeditions); the sky sets night or day whatever the clock says.",
          row("Move on", [[1 / 6, "+10 min"], [1, "+1 h"], [6, "+6 h"], [24, "+1 day"], [120, "+5 days"]].map(([h, n]) => `<button class="btn btn-sm dv-warp" data-h="${h}">${n}</button>`).join(""))
          + row("Sky", `<div class="pp-dev-seg" id="dv-sky" role="group" aria-label="Sky">${[["", "Real clock"], ["day", "Day"], ["night", "Night"]].map(([k, n]) =>
              `<button class="btn btn-sm${(d.sky || "") === k ? " btn-primary" : ""}" data-sky="${k}" aria-pressed="${(d.sky || "") === k}">${n}</button>`).join("")}</div>`))}
        ${card("bronzesword", "You", "Difficulty, levels, coins and wear. Your class and the sky are in the sidebar too, for a quick switch.",
          row("Difficulty", `<div class="pp-dev-seg" id="dv-mode" role="group" aria-label="Difficulty">${Object.keys(Core.MODES).map((k) =>
              `<button class="btn btn-sm${(s.mode || "hardcore") === k ? " btn-primary" : ""}" data-mode="${k}" aria-pressed="${(s.mode || "hardcore") === k}" title="${esc(Core.MODES[k].about)}">${esc(Core.MODES[k].name)}</button>`).join("")}</div>`)
          + row("Skill", `<select class="input" id="dv-skill">${opt(Core.SKILL_ORDER.map((k) => [k, Core.SKILLS[k].name]))}</select>
              <input class="input pp-num" id="dv-slv" type="number" min="1" max="${Core.MAX_LEVEL}" value="10" aria-label="Level"><button class="btn btn-sm" id="dv-slv-set">Set</button>`)
          + row("Class", `<select class="input" id="dv-cls">${opt([["", "-- none --"], ...Object.keys(Core.CLASSES).map((k) => [k, Core.CLASSES[k].name])])}</select><button class="btn btn-sm" id="dv-cls-set">Become</button>`)
          + row("Coins", `<input class="input pp-num" id="dv-coins" type="number" min="-99999" max="99999" value="500" aria-label="Coins"><button class="btn btn-sm" id="dv-coins-add">Add</button>`)
          + row("Weapon", `<button class="btn btn-sm" id="dv-wear80">Wear to 80%</button><button class="btn btn-sm" id="dv-wear99">To its last blow</button>`)
          + row("", `<button class="btn btn-sm" id="dv-max" title="Every skill, your pet and its areas at the top level">Max everything</button>`))}
        ${card("starteregg", "Pet", v.has ? "" : "No pet in the sandbox yet -- take an egg on My pet.",
          row("Care", `<button class="btn btn-sm" id="dv-fill">Fill stats & heal</button><button class="btn btn-sm dv-age" data-d="1">Age +1 day</button><button class="btn btn-sm dv-age" data-d="5">+5 days</button>`)
          + row("Level", `<input class="input pp-num" id="dv-plv" type="number" min="1" max="${Core.MAX_LEVEL}" value="${v.level || 1}" aria-label="Pet level"><button class="btn btn-sm" id="dv-plv-set">Set</button>`)
          + row("Area", `<select class="input" id="dv-area">${opt(Core.AREA_ORDER.filter((a) => !Core.AREAS[a].later).map((a) => [a, Core.AREAS[a].name]))}</select>
              <input class="input pp-num" id="dv-alv" type="number" min="1" max="5" value="5" aria-label="Area level"><button class="btn btn-sm" id="dv-alv-set">Set</button>`)
          + row("Graveyard", `<select class="input" id="dv-bury">${opt([
              ...(s.pet && v.has && v.stage !== "egg" ? [["", (s.pet.name || "Your pet") + " (your pet)"]] : []),
              ...(s.beasts || []).filter((x) => !x.loan).map((x) => [x.id, (x.name || x.species) + (x.risen ? " (risen)" : " (battle pet)")])])}</select>
              <button class="btn btn-sm" id="dv-bury-go">Lay to rest</button>`))}
        ${card("obj_chest", "Items", "Added straight to the bag (bag room ignored).",
          row("Add", `<select class="input" id="dv-item">${opt(items)}</select><input class="input pp-num" id="dv-n" type="number" min="1" max="9999" value="10" aria-label="How many"><button class="btn btn-sm" id="dv-give">Add</button>`)
          + row("Empty", `<button class="btn btn-sm btn-danger" id="dv-clearbag" title="Your bag, what you wear and carry -- not the bank or your coins">Remove all items from your character</button>`)
          + row("", `<button class="btn btn-sm" id="dv-giveall">Add 10 of everything</button>`))}
        ${card("bones", "Bosses", "Skip a boss's kill count, or count it as beaten without the fight (no spoils).",
          row("Boss", `<select class="input" id="dv-boss">${opt(bossGrounds)}</select>`)
          + row("", `<button class="btn btn-sm" id="dv-bossready">Ready to fight now</button><button class="btn btn-sm" id="dv-beatboss">Mark beaten</button>`))}
        ${card("bronzesword", "Hunt one creature", "A hunting ground meets only the creature you pick -- for quests and drops that want one kind. " +
            (Object.keys(d.target || {}).length ? "Now: " + Object.keys(d.target).map((g) => `${esc(Core.HUNTS[g].name)} → ${esc(Core.MONSTERS[d.target[g]].name)}`).join(", ") + "." : "Nothing picked: every ground has all its creatures."),
          row("Creature", `<select class="input" id="dv-tmon">${opt(Object.keys(Core.HUNTS).filter((g) => Core.HUNTS[g].monsters && Core.HUNTS[g].monsters.length)
              .flatMap((g) => Core.HUNTS[g].monsters.map((m) => [g + ":" + m[0], `${Core.HUNTS[g].name}: ${Core.MONSTERS[m[0]].name}${m[2] === "night" ? " (night)" : ""}`])))}</select>`)
          + row("", `<button class="btn btn-sm" id="dv-tset">Hunt only this</button><button class="btn btn-sm btn-quiet" id="dv-tclear">All creatures again</button>`))}
        ${card("stardust", "New Game Plus", ngOpen ? "Start a New Game Plus in the sandbox from this game -- its legacy, three pets, and a battle pet if you were a Beast Master."
            : "New Game Plus opens once the Basilisk (the Jungle's boss) is beaten -- in the sandbox, one click:",
          ngOpen ? row("Pets (up to 3)", `<div class="pp-dev-pets">${ngPool.map((p) => `<label class="pp-check"><input type="checkbox" data-ngpet="${esc(p.id)}"> ${esc(p.name || p.species)}</label>`).join("") || '<span class="stamp">No pets</span>'}</div>`)
            + (lg && lg.beast && lg.beasts.length ? row("Battle pet", `<select class="input" id="dv-ngbeast">${opt(lg.beasts.map((b) => [b.id, b.name]))}</select>`) : "")
            + (lg ? `<p class="stamp">Legacy: ${esc(lg.name || "no class")}${lg.points ? ` · ${lg.points} free talent points` : ""} · prestige mark ${lg.marks}</p>` : "")
            + row("", `<button class="btn btn-sm btn-primary" id="dv-ngplus">Start New Game Plus here</button>`)
            : row("", `<button class="btn btn-sm btn-primary" id="dv-ngbeat">Mark the Basilisk beaten</button>`))}
        ${card("fairystone", "Switches", "",
          `<label class="pp-check"><input type="checkbox" data-flag="instantHatch" ${d.instantHatch ? "checked" : ""}> Instant hatch</label>
          <label class="pp-check"><input type="checkbox" data-flag="allEggs" ${d.allEggs ? "checked" : ""}> Every egg can be taken</label>
          <label class="pp-check"><input type="checkbox" data-flag="infinite" ${d.infinite ? "checked" : ""}> Infinite items (nothing is used up)</label>
          <label class="pp-check"><input type="checkbox" data-flag="questFree" ${d.questFree ? "checked" : ""}> Quests hand in without their needs (kills, things to bring, levels)</label>`)}
      </div>`;
    const q = (id) => host.querySelector(id);
    const dev = async (o) => {
      const r = await act("dev", o);
      if (r && r.error) { status = r.error; toast(r.error, true); q("#pp-status").textContent = status; }
    };
    q("#dv-clone").addEventListener("click", async () => {
      if (!await askYes("Replace the sandbox with a copy of your real game?")) return;
      const real = await load("main");
      const copy = JSON.parse(JSON.stringify(real));
      copy.dev = Object.assign({}, (states.dev && states.dev.dev) || {}, {on: true});
      const r = await saveSlot("dev", copy);
      if (r && r.error) { status = r.error; toast(r.error, true); } else { states.dev = copy; status = "The sandbox is now a copy of your real game."; toast(status); }
      render();
    });
    q("#dv-fresh").addEventListener("click", async () => {
      if (!await askYes("Empty the sandbox and start again?")) return;
      const fresh = Core.empty();
      fresh.dev = Object.assign({}, (states.dev && states.dev.dev) || {}, {on: true});
      const r = await saveSlot("dev", fresh);
      if (!(r && r.error)) { states.dev = fresh; tutorStarted.delete("dev"); status = "A fresh sandbox."; toast(status); return goTo("pet:world"); }   // (PT31: the map, with the tutorial's start)
      render();
    });
    host.querySelectorAll("[data-flag]").forEach((c) => c.addEventListener("change", () => dev({op: "flags", [c.dataset.flag]: c.checked})));
    // which sandbox (2026-10-15): switch, and a new one is set up the first time -- a copy of your real game; the
    // everything-unlocked one with infinite items, instant hatching, every egg and every level on top
    const markKind = (k) => host.querySelectorAll("[data-sbx]").forEach((b) => { b.classList.toggle("btn-primary", b.dataset.sbx === k); b.setAttribute("aria-pressed", b.dataset.sbx === k); });
    call("pet_sandbox", [], "Your sandbox").then((r) => { if (r && r.kind) markKind(r.kind); }).catch(() => {});
    host.querySelectorAll("[data-sbx]").forEach((b) => b.addEventListener("click", async () => {
      if (b.getAttribute("aria-pressed") === "true") return;           // already this one
      const r = await call("pet_sandbox_use", [b.dataset.sbx], "Switching sandbox");
      if (!r || r.error) { toast((r && r.error) || "Couldn't switch.", true); return; }
      await load("dev");
      if (!r.exists || !(states.dev && states.dev.player && states.dev.player.made)) {
        const real = await load("main"), copy = JSON.parse(JSON.stringify(real));
        copy.dev = r.kind === "max" ? {on: true, infinite: true, allEggs: true, instantHatch: true} : {on: true};
        let st = copy;
        if (r.kind === "max") { const m = Core.act(st, "dev", {op: "maxall"}, Date.now()); if (m.ok) st = m.state; }
        await saveSlot("dev", st); states.dev = st;
      }
      status = r.kind === "max" ? "Sandbox: everything unlocked." : "Sandbox: a plain account -- the game's own rules; add what you need below.";
      toast(status); render();
    }));
    const pills = host.querySelector("#dv-pills");
    if (pills) { pills.innerHTML = cards.map((t) => `<button class="pp-btab" data-dvjump="${slug(t)}">${esc(t)}</button>`).join("");
      pills.querySelectorAll("[data-dvjump]").forEach((b) => b.addEventListener("click", () => { const el = host.querySelector("#" + b.dataset.dvjump); if (el) el.scrollIntoView({behavior: "smooth", block: "start"}); })); }
    host.querySelectorAll(".dv-warp").forEach((b) => b.addEventListener("click", () => dev({op: "warp", hours: +b.dataset.h})));
    host.querySelectorAll(".dv-age").forEach((b) => b.addEventListener("click", () => dev({op: "age", days: +b.dataset.d})));
    q("#dv-fill").addEventListener("click", () => dev({op: "fill"}));
    host.querySelectorAll("#dv-mode [data-mode]").forEach((b) => b.addEventListener("click", () => dev({op: "mode", mode: b.dataset.mode})));   // (PT33)
    host.querySelectorAll("[data-sky]").forEach((b) => b.addEventListener("click", () => dev({op: "sky", sky: b.dataset.sky})));
    q("#dv-bury-go").addEventListener("click", async () => { const sel = q("#dv-bury"); if (!sel.options.length) return toast("Nothing to lay to rest.", true);
      if (await askYes(`Send ${sel.options[sel.selectedIndex].text} to the Graveyard?`)) dev({op: "bury", beast: sel.value}); });
    q("#dv-plv-set").addEventListener("click", () => dev({op: "level", target: "pet", level: +q("#dv-plv").value}));
    q("#dv-alv-set").addEventListener("click", () => dev({op: "level", target: "area", area: q("#dv-area").value, level: +q("#dv-alv").value}));
    q("#dv-slv-set").addEventListener("click", () => dev({op: "level", target: "player", skill: q("#dv-skill").value, level: +q("#dv-slv").value}));
    q("#dv-max").addEventListener("click", () => dev({op: "maxall"}));
    q("#dv-wear80").addEventListener("click", () => dev({op: "wearweapon", share: 0.8}));
    q("#dv-wear99").addEventListener("click", () => dev({op: "wearweapon", share: 0.9999}));
    q("#dv-coins-add").addEventListener("click", () => dev({op: "coins", n: +q("#dv-coins").value}));
    q("#dv-give").addEventListener("click", () => dev({op: "give", item: q("#dv-item").value, n: +q("#dv-n").value}));
    q("#dv-clearbag").addEventListener("click", async () => { if (await askYes("Remove everything your character carries and wears (the sandbox only)?")) dev({op: "clearbag"}); });
    // PT30 v4 (Cam: "i dont like the arrows on the side i reckon we go a slider so its consistent with the benches"): every number
    // here gets the bench's − slider + beside its box (the box keeps its id, so each Set/Add button reads it as before)
    host.querySelectorAll("input.pp-num[type=number]").forEach((nb) => {
      if (nb.dataset.slid) return; nb.dataset.slid = "1";
      const lo = +nb.min, hi = +nb.max, wrap = document.createElement("span"); wrap.className = "pp-numslide";
      const minus = Object.assign(document.createElement("button"), {className: "btn btn-sm", textContent: "−", type: "button"});
      const plus = Object.assign(document.createElement("button"), {className: "btn btn-sm", textContent: "+", type: "button"});
      const sl = Object.assign(document.createElement("input"), {type: "range", min: lo, max: hi, value: nb.value, className: "pp-bslide"}); sl.setAttribute("aria-label", nb.getAttribute("aria-label") || "Amount");
      const step = Math.max(1, Math.round((hi - lo) / 200));
      const set = (v) => { const n = Math.max(lo, Math.min(hi, Math.round(+v) || lo)); nb.value = sl.value = n; };
      sl.addEventListener("input", () => set(sl.value)); nb.addEventListener("input", () => { sl.value = nb.value; });
      minus.addEventListener("click", () => set(+nb.value - step)); plus.addEventListener("click", () => set(+nb.value + step));
      nb.parentNode.insertBefore(wrap, nb); wrap.append(minus, sl, plus, nb);
    });
    q("#dv-giveall").addEventListener("click", () => dev({op: "giveall", n: 10}));
    q("#dv-cls").value = s.player.cls || "";
    q("#dv-cls-set").addEventListener("click", () => { const c = q("#dv-cls").value; if (c && c !== s.player.cls) act("class", {cls: c, quick: true}).then((r) => r && r.error && toast(r.error, true)); });
    q("#dv-bossready").addEventListener("click", () => dev({op: "bossready", ground: q("#dv-boss").value}));
    q("#dv-beatboss").addEventListener("click", () => dev({op: "beatboss", ground: q("#dv-boss").value}));
    q("#dv-tset").addEventListener("click", () => { const [g, m] = q("#dv-tmon").value.split(":"); dev({op: "target", ground: g, mon: m}); });
    q("#dv-tclear").addEventListener("click", () => { const [g] = q("#dv-tmon").value.split(":"); dev({op: "target", ground: g, mon: ""}); });
    const ngx = q("#dv-ngbeat"); if (ngx) ngx.addEventListener("click", () => dev({op: "beatboss", ground: "jungle"}));   // (PT20 d4: right here, not via the Bosses list)
    const ngb = q("#dv-ngplus");
    if (ngb) ngb.addEventListener("click", async () => {
      const pets = [...host.querySelectorAll("[data-ngpet]:checked")].map((c) => c.dataset.ngpet).slice(0, 3), bsel = q("#dv-ngbeast");
      if (!await askYes("Replace this sandbox with a New Game Plus started from it?")) return;
      const st = Core.newGame({mode: s.mode || "hardcore", from: s, pets, beast: bsel ? bsel.value : ""}, Date.now());
      st.dev = Object.assign({}, s.dev || {}, {on: true});
      const r = await saveSlot("dev", st);
      if (r && r.error) return toast(r.error, true);
      states.dev = st; status = "New Game Plus " + (st.ngPlus || 1) + " started in the sandbox."; toast(status); render();
    });
    host.querySelectorAll("[data-ngpet]").forEach((c) => c.addEventListener("change", () => {
      if (host.querySelectorAll("[data-ngpet]:checked").length > 3) { c.checked = false; toast("Three pets at most.", true); } }));
  }

  const VIEWS = ["pet:pyramid", "pet:islandestate", "pet:shipyard", "pet:settings", "pet:estate", "pet:house", "pet:library", "pet:storeroom", "pet:nursery", "pet:guild", "pet:market", "pet:pen", "pet:workshop", "pet:outskirts", "pet:home", "pet:skills", "pet:foraging", "pet:fishing", "pet:mining", "pet:lumbering", "pet:digging", "pet:village",
                 "pet:gear", "pet:expeditions", "pet:hunt", "pet:farm", "pet:pets", "pet:hatchery", "pet:breed", "pet:dex", "pet:graveyard", "pet:ranch", "pet:camp", "pet:bestiary", "pet:herbarium", "pet:world", "pet:dash", "pet:runecrafting", "pet:spellbook", "pet:enchants", "pet:saves", "pet:modder", "dev:tools", "dev:places"];
  SS.Pet = {
    VIEWS,
    kitToggle() { kitSet(!kitOpen()); },
    kitShow(tab) { kitShow(tab); },                       // open the Kit at a tab (the old Bag page's links come here, 2026-10-20)
    kitRefresh() { kitSig = ""; kitRender(); },                  // the top bar's Kit button (Modernize/Reduce Nav)
    everySecond,                                          // the shared ticker (game.js's nav and top bar ride it too)
    memo,
    PREFIX: "pet",
    /** Draw the game into host: view, on the real game ("main") or the sandbox ("dev"). */
    async mount(host, v, which) {
      hostEl = host;
      view = VIEWS.includes(v) ? v : "pet:home";
      slot = which === "dev" ? "dev" : "main";
      makingLook = false;
      status = "";
      await load();
      render();
      checkpoint().then(() => render());               // opened: settle the time away once (OPT-1)
    },
    /** Another page, the same game (the sidebar). */
    /** The sidebar's Map opens the whole map, not the last region (2026-10-07). */
    mapHome() { worldRegion = ""; seaChart = false; closeSeaSheet(); },
    /** Where you're gathering: that region's picture (2026-10-10, Cam: the top bar's trip chip opened the skill's list of
        every spot -- "it takes away the need to navigate the gameworld ... and doesnt allow the player to have to learn
        where everything is"). */
    toRegion(id) { worldRegion = id || ""; seaChart = false; closeSeaSheet(); closeSec(); status = ""; },
    // ---- the navigation bar above every page (2026-10-09, Cam: "I want all navigation just above the map and not in
    //      the top bar ... back, map and home ... Home will not work when on another island until you unlock and build
    //      the respective player estate") -- the shell draws it; these say what's inside the Map and where Home is.
    /** A view inside the Map to step back out of: {back: label} or null. */
    inner() {
      if (view !== "pet:world") return null;
      if (REGION_UP[worldRegion]) return {back: Core.REGIONS[REGION_UP[worldRegion]].name, up: REGION_UP[worldRegion]};   // (Cam: "Fix the way back from the nile")
      if (worldRegion && worldRegion !== "village") return {back: "Map"};
      if (seaChart) return {back: "Map"};                             // the Map button goes there too
      return null;
    },
    /** Where Back from a page under the Map goes: the region it was opened from (the Shipyard from the Coast). */
    regionName() { return worldRegion && worldRegion !== "village" && Core.REGIONS[worldRegion] ? Core.REGIONS[worldRegion].name : ""; },
    innerBack() { const up = REGION_UP[worldRegion]; if (up) worldRegion = up; else if (worldRegion) worldRegion = ""; else seaChart = false; closeSeaSheet(); closeSec(); status = ""; render(); },
    /** Buttons that belong to this page: the Sea chart on the Map. */
    extras() {
      if (view !== "pet:world" || (worldRegion && worldRegion !== "village")) return [];
      return [{id: "sea", label: seaChart ? "Island map" : "Sea chart", on: seaChart}];
    },
    extra(id) { if (id === "sea") { seaChart = !seaChart; closeSeaSheet(); status = ""; render(); } },
    /** Where Home is: your house on the main island, your estate on another island once its house is built. */
    homeTarget() {
      const {s, now} = current(), wv = Core.worldView(s, now);
      if (wv.voyage) return {go: "", why: "You're at sea -- your estate is back on land."};
      if (!wv.here) return {go: "pet:estate"};                         // the estate: house, workshop, library, store room (2026-10-10)
      const e = (s.estates || {})[wv.here], town = wv.hereTown && Core.REGIONS[wv.hereTown] ? Core.REGIONS[wv.hereTown].name : "town";
      if (e && e.bought && ((e.parts || {}).house || 0) >= 1) return {go: "pet:islandestate"};
      return {go: "", why: `Your estate on ${wv.hereName} is in ${town} -- ${e && e.bought ? "build its house" : "buy the plot and build its house"} first.`};
    },
    show(v) {
      closeSec();
      view = VIEWS.includes(v) ? v : "pet:home";
      makingLook = false; status = ""; openShop = "";
      const m = document.querySelector(".pp-modal.pp-shop-modal"); if (m) m.remove();
      render();
    },
    /** A village workshop, opened (the sidebar's Cooking and Crafting). */
    shop(id) { view = Core.WORKSHOPS[id] && Core.WORKSHOPS[id].npc ? "pet:village" : "pet:workshop"; openShop = id; status = ""; render(); },
    /** The real game or the sandbox. */
    async setSlot(which) { slot = which === "dev" ? "dev" : "main"; await load(); render(); checkpoint().then(() => render()); },
    get slot() { return slot; },
    get view() { return view; },
    get shopId() { return openShop; },
    /** The game now (advanced), for the shell's sidebar and top bar. */
    peek() { return current(); },
    reload: async () => { await load(); render(); },
    /** The pet in a line (the top bar's hint on My pet). */
    describe: () => { const v = current().v; return v.has ? describe(v) : ""; },
    act,
    icon: (name, size) => itemIcon(name, size),
    avatar: (lk, size, skin) => avatarURL(lk, size, skin),
    grave: () => { const {s: st, now} = current(); return Core.graveView(st, now); },   // the top bar's gravestone chip (V16)
    you: (lk, pose) => youURL(lk, pose),
    pet: (species, colour, size) => petURL(species, colour, size),
    monster: (id, size) => monsterURL(id, size),
    _test: {current, setState: (s, which) => { states[which || slot] = s; }, describe},
  };
})();
