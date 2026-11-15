/* ==========================================================================
   NeuroCafe -- the page (2026-10-20, V19: the Stage 1 demo).
   ==========================================================================
   The rules are cafecore.js; this draws them and sends your clicks. Every
   change: CafeCore.act(state, action, opts, now) -> cafe_save -> redraw.

   The cafe is an isometric floor (Cam's painted tiles, walls, door, stoves,
   counters, till and customers -- ui/cafe/art, cut by tools/cut_cafe_art.py).
   One click does the obvious thing: a free stove opens the cookbook, a ready
   one serves, a burnt one is thrown away, a dirty one is cleaned, the till
   gives you its coins. Build mode buys, places, moves, turns, stores and
   sells. Things face four ways: the two painted facings and their mirrors
   (V19 q3).
   ========================================================================== */
(function () {
  "use strict";
  const C = window.CafeCore, ART = window.CafeArtFiles || {};
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  // ---- talking to Python (neurocafe.py Api); a test page may bring its own -------------------
  const ready = new Promise((ok) => {
    if (window.pywebview && window.pywebview.api) ok();
    else window.addEventListener("pywebviewready", () => ok(), {once: true});
  });
  const Store = window.NCStore || {
    async call(name, args) { await ready; const f = window.pywebview.api[name]; return f ? f(...(args || [])) : null; },
  };
  const realNow = () => (window.NCClock ? window.NCClock() : Date.now());
  // 2026-10-24 (Cam: "a fast forward button ... like the Sims speed settings"): the sandbox keeps its own clock, run at
  // ×1, ×10 or ×20 from the button by the clock. It gets ahead of the real one; how far (dev.ahead) is saved with the
  // sandbox so it never runs backwards. Your café is always on real time.
  const SPEEDS = [1, 10, 20];
  let simClock = null;                                           // {real, sim, speed} while the sandbox is open
  const now = () => (simClock ? simClock.sim + (realNow() - simClock.real) * simClock.speed : realNow());
  function setClock(st) {
    const r = realNow();
    simClock = slot === "sandbox" && st && st.sandbox
      ? { real: r, sim: r + Math.max(0, (st.dev && st.dev.ahead) || 0, (st.clock || 0) - r, (st.at || 0) - r), speed: 1 } : null;
  }
  function setSpeed(n) { const t = now(); simClock = { real: realNow(), sim: t, speed: n }; tickV = null; if (state && state.made) { state = C.advance(state, t); save(); } }

  // build: null, or {pick: uid} (a thing chosen), {place: kind} (from the warehouse), {move: uid}
  let state = null, build = null, hover = null, sig = "", nums = "", queue = Promise.resolve(), dirty = false, cookFor = null;
  // which café is open: yours ("main") or the sandbox (2026-10-21), and the cookbook's filter
  let slot = "main", devOpen = false, cbSort = "all", cbMenu = "breakfast", hoverP = null, line = null;
  // N43: the wall panel under the pointer while papering, and which Purchase tab is open
  let hoverW = null, buyTab = "dining", buyCat = {};
  // V23: a potion picked in the Bag, waiting for a stove or counter to be clicked
  let potionMode = null;
  // 2026-10-22: the day Aunty's box was last announced (one toast a box)
  let auntySeen = null, cartSeen = null, feastSeen = null;
  // 2026-10-24: free placement outside (Cam: "the cheat for sims"), remembered on this computer; Outside's category; a
  // terrain stroke being painted
  let freePlace = (() => { try { return localStorage.getItem("nc-free") !== "0"; } catch (e) { return true; } })(), outCat = "all", stroke = null;
  const setFree = (on) => { freePlace = on; try { localStorage.setItem("nc-free", on ? "1" : "0"); } catch (e) { /* (not kept) */ } };
  // N49 (2026-10-21, Cam: "release all of them"): a card's look tried in place, Build's undo, a thing dragged, a sweep
  // over the stoves, the thing under the pointer, a free stove's first click waiting to see if it's a double
  let peek = null, undo = [], hwDrag = null, hoverE = null, thingDrag = null, sweep = null, hoverUid = null, stoveTap = null, plotSweep = null, plotSwept = false;
  // Build > Select (2026-10-25): the box chosen ({box, mode: "move" | "copy"}) and a box or a move being dragged
  let sel = null, selDrag = null;

  // ---- pictures and numbers ----------------------------------------------------------------------
  // (2026-10-26, security for shipping: every picture name is letters, digits, - and _ -- one from a save edited by hand
  // can't reach outside the art folder or out of the src="" it's written into)
  // (2026-10-27, Cam's Haunted Faves) while Halloween is on, a dish painted haunted (<dish|cook|burnt>-<id>-hw) shows that
  // way everywhere -- cooking, served, burnt, in the cookbook; signature() keeps `haunted` up to date
  let haunted = false;
  const art = (id) => {
    id = String(id);
    if (haunted && /^(dish|cook|burnt)-/.test(id) && ART[id + "-hw"]) id += "-hw";
    return "cafe/art/" + id.replace(/[^A-Za-z0-9_-]/g, "") + ".webp";
  };
  const has = (id) => !!ART[id];
  const META = window.CafeArtMeta || {};
  const COIN = `<svg class="nc-coin" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="#f1c24a" stroke="#8a5a14" stroke-width="1.4"/><circle cx="8" cy="8" r="4.2" fill="none" stroke="#c8902a" stroke-width="1.2"/></svg>`;
  const num = (n) => Number(n || 0).toLocaleString();
  const coins = (n, cls) => `<span class="nc-coins${cls ? " " + cls : ""}">${COIN}${num(n)}</span>`;
  function clock(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
    return h ? `${h}h ${String(m).padStart(2, "0")}m` : m ? `${m}m ${String(x).padStart(2, "0")}s` : `${x}s`;
  }
  // (2026-10-26, Cam: "fix the recurring 3" -- 200 s was "3.3333333333333335 min"): one decimal at most, none when whole
  const dp1 = (x) => String(Math.round(x * 10) / 10);
  const secs = (n) => n >= 3600 ? `${dp1(n / 3600)} h` : n >= 60 ? `${dp1(n / 60)} min` : `${n} s`;

  function toast(msg, bad) {
    if (!msg) return;
    const el = document.createElement("div");
    el.className = "nc-toast" + (bad ? " bad" : "");
    el.textContent = msg;
    $("nc-toasts").appendChild(el);
    setTimeout(() => el.classList.add("out"), 2600);
    setTimeout(() => el.remove(), 3000);
  }

  // ---- music (V22 q5, Cam: "add lofi to the game now ... balance the sound so it sits in the background"): at the
  // Settings volume; quiet while the window's hidden; if the browser won't start sound by itself it starts on the first
  // click. The jukebox (PT56 / Q8, Cam's picks): one player in the game. The café radio -- the game's own lofi and
  // whatever's in the café music folder, shuffled together -- or a playlist (a folder you added): each song once, in
  // order or shuffled, then round again. What's on is a pref (src, shuffle), so it's remembered.
  const music = (() => {
    let el = null, want = false, vol = 0.6, lib = null, src = "radio", shuffle = false, queue = [], at = 0, fails = 0;
    // (3 Nov 2026, Cam: "add the jazz to the cafe radio as another option to the lofi"): the game's two songs are on the
    // radio, and each is a station of its own too (src "game:lofi" / "game:jazz"), playing round and round
    const OWN = [{ name: "lofi", url: "cafe/music/lofi.ogg" }, { name: "jazz", url: "cafe/music/jazz.ogg" }];
    const songs = () => {
      const own = /^game:/.test(src) && OWN.find((x) => "game:" + x.name === src);
      if (own) return [own];
      const radio = lib && lib.radio && lib.radio.length ? lib.radio : OWN, pl = lib && (lib.playlists || []).find((x) => "pl:" + x.id === src);
      return src !== "radio" && pl && pl.songs.length ? pl.songs : radio;
    };
    const mixed = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const deal = () => { const list = songs().slice(); queue = src === "radio" || shuffle ? mixed(list) : list; at = 0; };
    const load = () => { if (!queue.length) deal(); const a = ensure(); a.src = queue[at].url; a.loop = queue.length === 1; };
    const next = () => { at++; if (at >= queue.length) deal(); load(); go(); };
    function ensure() {
      if (el) return el;
      el = new Audio(); el.preload = "auto";
      el.addEventListener("ended", next);
      el.addEventListener("playing", () => { fails = 0; });
      // (a song that won't play is skipped; when none of them will, it stops rather than spinning)
      el.addEventListener("error", () => { if (++fails > queue.length) { want = false; return toast("None of those songs would play.", true); } next(); });
      return el;
    }
    const go = () => { if (!want || document.hidden) return; const a = ensure(); if (!a.src) load(); a.volume = vol * 0.5; const p = a.play(); if (p && p.catch) p.catch(() => {}); };
    document.addEventListener("pointerdown", go, { capture: true });
    document.addEventListener("visibilitychange", () => { if (document.hidden) { if (el) el.pause(); } else go(); });
    return {
      apply(p) {
        want = !!p.music; vol = p.vol;
        if (p.src !== src || p.shuffle !== shuffle) { src = p.src; shuffle = p.shuffle; deal(); if (el) load(); }
        if (want) go(); else if (el) el.pause();
      },
      volume(x) { vol = x; if (el) el.volume = vol * 0.5; },
      /** The songs Python found (cafe_music): the radio's and the playlists'. */
      library(l) { const had = !!lib; lib = l && !l.error ? l : lib; if (lib && (!had || !el || el.paused)) { deal(); if (el) load(); go(); } },
      get lib() { return lib; },
      skip() { if (want) next(); },
      get playing() { return el && el.src && queue[at] ? queue[at].name : ""; },
      get paused() { return !el || el.paused; },
    };
  })();
  async function loadMusic() { try { music.library(await Store.call("cafe_music", [])); } catch (e) { /* the game's own lofi */ } }

  // ---- sound effects (3 Nov 2026, Cam: "re use some of the sound effects" from NeuroArcana -- the victory when you level
  // up, the click round the menus, the Moonstones when coins come in, and whatever else the Sound Engineer thinks adds
  // to it). Cam's recordings as NeuroArcana's tools/cut_sounds.py cut them, copied into cafe/sfx/. The mix follows the
  // sound guide: chores quiet, rewards louder, the click faint. One sound a move: when a serve also levels you up, you
  // hear the level up (the most important one wins, RANK); a plain button only clicks when nothing else played.
  // (3 Nov, Cam's café recordings -- tools/cut_cafe_sounds.py: "not to overpowering"): the sizzle, the scrub and the
  // fork on a plate sit under the music. Nothing plays by itself: the plate is when you serve (Cam: "when they eat it is
  // to random"), and the door chime was taken out
  // (8 Nov, Cam's milkshake recording: "when selecting and making a milkshake") the blender, a short spin-up and wind-down
  // (tools/cut_cafe_sounds.py blend), once as the shake is started, never running on behind
  const SFX = { blend: .3, plate: .38, clean: .25, sizzle: .32, click: .035, place: .3, pick: .3, no: .4, page: .4, bell: .45, coin: .5, heal: .5, tear: .55, keeper: .6, rare: .7, unlock: .8, victory: .8 };
  const RANK = [ "click", "pick", "sizzle", "blend", "clean", "plate", "place", "page", "no", "coin", "bell", "heal", "tear", "keeper", "rare", "unlock", "victory"];
  // what a move sounds like when it works (the events it brings -- coins, a level -- can outrank it)
  const ACT_SFX = {
    halfWall: "place", halfWallRemove: "place", place: "place", move: "place", decorPlace: "place", decorMove: "place", hang: "place", moveHang: "place", ceilPut: "place", ceilMove: "place",
    store: "place", decorStore: "place", unhang: "place", ceilTake: "place", plow: "place", plotMove: "place", rail: "place", patioDoor: "place",
    serve: "plate", plant: "place", cartLoad: "place", rotate: "pick", decorTurn: "pick", cook: "sizzle", clean: "clean", harvest: "pick", eggs: "pick",
    buy: "coin", buyPaint: "coin", buyMixer: "coin", buyCounterStyle: "coin", upgrade: "coin", candyBuy: "coin", candyStore: "coin",
    sell: "coin", sellWare: "coin", sellPware: "coin", sellHang: "coin", sellCware: "coin", decorSell: "coin", ceilSell: "coin",
    usePotion: "heal", expand: "unlock", patio: "unlock", aunty: "tear", hauntOpen: "keeper",
  };
  const EV_SFX = { level: "victory", expand: "unlock", patio: "unlock", mastery: "rare", lucky: "rare", cart: "rare", coins: "coin", tip: "coin", delivered: "coin" };
  const sfxEl = {};
  let sfxLast = 0, sfxNext = null;
  /** Ask for a sound; the loudest-ranked one asked for in this moment plays. */
  function cue(name) {
    if (!name || SFX[name] == null) return;
    if (sfxNext == null) setTimeout(() => { const n = sfxNext; sfxNext = null; sfx(n); }, 0);
    if (sfxNext == null || RANK.indexOf(name) > RANK.indexOf(sfxNext)) sfxNext = name;
  }
  // (plain audio elements: they play the café's own files whatever the page may fetch, and nothing stays open between sounds)
  function sfx(name) {
    const p = state && C.prefs(state);
    if (!p || !p.sfx || document.hidden || SFX[name] == null) return;
    sfxLast = Date.now();
    try {
      const base = sfxEl[name] || (sfxEl[name] = Object.assign(new Audio(`cafe/sfx/${name}.ogg`), { preload: "auto" }));
      const a = base.readyState >= 2 ? base.cloneNode() : base;
      a.volume = Math.min(1, SFX[name] * p.sfxVol * 1.4);
      const r = a.play(); if (r && r.catch) r.catch(() => {});
    } catch (e) { /* no sound */ }
  }
  // the faint click: a button, a menu tab, a book's tab (a page turning) -- unless the click brought its own sound.
  // (3 Nov, Cam: "dial down the UI click ... more relaxed and only have it in the menu clicking not when i click the play
  //  area"): only in the menus, never on the café itself; quieter, and its own softer cut (cafe/sfx/click.ogg: the high
  //  end taken off, a longer fade); quick clicks in a row get one, not a rattle
  const MENUS = "#nc-modal, #nc-drawer, #nc-fab, #nc-fab-r, #nc-dev, #nc-swpop, #nc-tut, #nc-stats, #nc-clock";
  let clickLast = 0;
  document.addEventListener("click", (e) => {
    const el = e.target.closest && e.target.closest("button, .nc-tab, [data-menu], label.nc-check");
    if (!el || !el.closest(MENUS) || el.closest("#nc-world")) return;
    const t0 = Date.now(), turn = el.matches(".nc-cb-tab2");
    setTimeout(() => {
      if (sfxLast >= t0 || sfxNext != null || (!turn && t0 - clickLast < 160)) return;
      clickLast = t0; sfx(turn ? "page" : "click");
    }, 0);
  }, true);

  // ---- doing things --------------------------------------------------------------------------------
  // N49 i11: what Ctrl+Z can put back while Build is open
  const UNDOABLE = new Set(["halfWall", "halfWallRemove", "hangTint", "buy", "place", "move", "rotate", "store", "sell", "sellWare", "decorPlace", "decorMove", "decorTurn", "decorStore", "decorSell", "decorScale",
    "style", "wallPaint", "floorPaint", "floorAll", "hang", "unhang", "moveHang", "sellHang", "sellPware", "ceilPut", "ceilMove", "ceilTake", "ceilSell", "sellCware", "terrain", "area"]);
  function act(action, opts, quiet) {
    if (!state) return null;
    const before = state;
    const r = C.act(state, action, opts || {}, now());
    if (!r.ok) { if (!quiet) { toast(r.error, true); cue("no"); } return r; }
    if (!quiet) cue(action === "cook" && (before.items.find((i) => i.uid === (opts || {}).uid) || {}).kind === "shakebar" ? "blend" : ACT_SFX[action]);
    if (build && UNDOABLE.has(action)) { undo.push(before); if (undo.length > 30) undo.shift(); }
    state = r.state;
    save();
    (r.events || []).forEach(happened);
    draw();
    return r;
  }
  function save() {
    if (simClock && state.sandbox) state = Object.assign({}, state, { dev: Object.assign({}, state.dev, { ahead: Math.round(now() - realNow()) }) });
    const snap = state, into = slot;
    queue = queue.then(() => Store.call("cafe_save", [snap, into])).then((res) => { if (res && res.error) toast(res.error, true); }).catch(() => {});
    dirty = false;
  }
  function happened(e) {
    cue(EV_SFX[e.kind]);
    if (e.kind === "level" && !(state.sandbox && !e.unlocks.length)) levelUp(e);
    if (e.kind === "tip") floatAt(document.querySelector(`[data-uid="${e.uid}"]`), `+${e.n}`, "coin");
    if (e.kind === "coins") floatAt(e.decor ? document.querySelector(`[data-decor="${e.decor}"]`) : document.querySelector('[data-kind="till"]'), `+${e.n}`, "coin");
    if (e.kind === "xp") floatAt(document.querySelector(`[data-uid="${e.uid}"]`), `+${e.n} XP`, "xp");
    if (e.kind === "candy") floatAt(document.querySelector(`[data-uid="${e.uid}"]`), `+${e.n} 🍬`, "candy");   // (Halloween)
    if (e.kind === "expand") toast("Your café grew!");
    if (e.kind === "patio") toast(e.depth === 3 ? "Your patio's open -- put tables and chairs out there!" : "Your patio grew!");
    if (e.kind === "aunty") auntyLetter(e);
    if (e.kind === "cart") cartThanks(e);
    if (e.kind === "harvest") { e.plots.forEach((p) => floatAt(document.querySelector(`[data-plot="${p.uid}"]`), "+" + C.CROP[p.crop].yield, "xp")); toast(`🌱 ${Object.keys(e.got).map((k) => `${e.got[k]} ${C.CROP[k].name.toLowerCase()}`).join(", ")} into the pantry (+${e.xp} XP)`); }
    if (e.kind === "eggs") { floatAt(document.querySelector(`[data-decor="${e.uid}"]`), `+${e.n} 🥚`, "xp"); toast(`🥚 ${e.n} egg${e.n > 1 ? "s" : ""} into the pantry (+${e.xp} XP)`); }
    if (e.kind === "cleared") toast(e.plots.length === 1 ? `The ${C.CROP[e.plots[0].crop].name.toLowerCase()} had gone over -- plot cleared.` : `${e.plots.length} plots had gone over -- cleared.`);
    if (e.kind === "delivered") floatAt(document.querySelector(`[data-decor="${e.uid}"]`), `+${e.n}`, "coin");
    if (e.kind === "tocart") toast("🐴 " + e.msg);                       // (counters full: straight from the stove to the cart)
    if (e.kind === "mastery") toast(`${e.name}: ${"★".repeat(e.stars)}${"☆".repeat(5 - e.stars)} -- ${e.perk.toLowerCase()}!`);
  }
  function floatAt(el, text, cls) {
    if (!el) return;
    const f = document.createElement("div");
    f.className = "nc-float " + cls;
    f.innerHTML = cls === "coin" ? COIN + esc(text) : esc(text);
    const b = el.getBoundingClientRect();
    f.style.left = (b.left + b.width / 2) + "px";
    f.style.top = (b.top + 10) + "px";
    document.body.appendChild(f);
    setTimeout(() => f.remove(), 1400);
  }

  // ---- the isometric floor ---------------------------------------------------------------------------
  const TW = 128, TH = 64, WALL = 150;
  // counters and the till are drawn at half a tile (PT43, Cam: "wall tallest, people in the middle, then counters"); the
  // buffet counter's picture is stretched by one tile at this size (tools/cut_cafe_art.py stretch_box)
  const CSCALE = 0.5;
  const at = (v, c, r) => ({ x: (c - r) * TW / 2 + v.size * TW / 2, y: (c + r) * TH / 2 + WALL });
  // what the camera takes in (2026-10-21): the café, the pavement and road behind it and a strip of grass in front
  let BOX = { x: 0, y: 0, w: 1, h: 1 }, groundKey = "", view = { z: 1, x: 0, y: 0 };
  const lastThing = new Map();     // uid -> the markup it was last drawn with (patchThings)
  function camera(v) {
    const c0 = -2.2, c1 = v.size + 1.6, cx = (v.cafeW || v.size) + 1.6;          // (cx: the patio's far edge, V24)
    const x0 = (c0 - c1) * TW / 2 + v.size * TW / 2, x1 = (cx - c0) * TW / 2 + v.size * TW / 2;
    const y0 = c0 * TH + WALL - 30, y1 = (cx + c1) / 2 * TH + WALL;
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  /** A thing's picture for its facing: 0 left, 1 right, 2 and 3 the same mirrored. */
  function face(kind, dir, dirtyStove, cstyle) {
    // furniture (2026-10-21): a chair's four turns are its front (chair-fl, facing down-left), that mirrored (down-right),
    // its back (chair-bl, facing up-right) and that mirrored (up-left); a table and a fern look the same every way
    if (kind === "chair") return { src: art(dir >= 2 ? "chair-bl" : "chair-fl"), flip: dir % 2 === 1, id: dir >= 2 ? "chair-bl" : "chair-fl" };
    // V24 step 2: the patio's appliances -- like the stove: -l and -r, mirrored for 2 and 3, a dirty picture after a dish
    if (C.THINGS[kind] && C.THINGS[kind].cooker && !C.THINGS[kind].bar) { const lr = dir % 2 ? "r" : "l", id = dirtyStove && has(`${kind}-dirty-${lr}`) ? `${kind}-dirty-${lr}` : `${kind}-${lr}`; return { src: art(id), flip: dir >= 2, id }; }
    if (kind === "table" || kind === "plant") { const id = kind === "table" ? "table" : "fern"; return { src: art(id), flip: false, id }; }
    // a sofa without its pictures: an armchair, turned the same way, stretched across its two tiles
    if (kind === "sofa" && !has("sofa-l")) {
      const d = dir % 4, id = d < 2 ? "armchair-l" : d === 2 ? "armchair-bl" : "armchair-br";
      return { src: art(id), flip: d === 1, id, standin: true };
    }
    // Sheet 12 chairs: the front (-l) faces down-left (0) and, mirrored, down-right (1); Sheet 13 (N39) their backs,
    // -bl facing up-left (2) and -br up-right (3) -- the turns follow C.FACE. The rest look the same every way.
    if (has(kind + "-l") && C.THINGS[kind] && C.THINGS[kind].turns) {
      // (Sheet 15's coin machines have their own down-right front, -r; the chairs' is the front mirrored)
      if (dir % 4 === 1 && has(kind + "-r")) return { src: art(kind + "-r"), flip: false, id: kind + "-r" };
      const d = dir % 4, id = d < 2 ? kind + "-l" : kind + (d === 2 ? "-bl" : "-br");
      return { src: art(has(id) ? id : kind + "-l"), flip: d === 1, id };
    }
    if (has(kind) && C.THINGS[kind] && C.THINGS[kind].furniture) return { src: art(kind), flip: !!C.THINGS[kind].mirror && dir % 2 === 1, id: kind };
    // a counter's style (N36; 2026-10-24 each counter's own -- bought at the furniture store, picked as a swatch)
    const cs = cstyle;
    if ((kind === "counter" || kind === "buffet") && cs && cs !== "wood" && has(`${kind}-${cs}-l`)) {
      const id = `${kind}-${cs}-${dir % 2 ? "r" : "l"}`;
      return { src: art(id), flip: dir >= 2, id };
    }
    const lr = dir % 2 ? "r" : "l";
    const id = kind === "stove" && dirtyStove ? "stove-dirty-" + lr : kind + "-" + lr;
    return { src: art(id), flip: dir >= 2, id };
  }
  // how wide things are drawn that aren't measured from a template (the counters are)
  const THING_W = { stove: 68, table: 78, chair: 44, plant: 54, vending: 58, table_square: 70, table_long: 134, table_bistro: 62, table_garden: 72, table_coffee: 84,
                    stool: 34, chair_bistro: 42, chair_garden: 44, armchair: 58, sofa: 144, table_wood: 72, lamp_blue: 42, palm: 62, floorlamp: 40, bookshelf: 62, coatstand: 38,
                    jukebox: 52, arcade: 52, pinball: 66, piano: 72,
                    halfwall: 70, halfbrick: 72, screen: 70, vipropes: 66, planterwall: 74, standmirror: 50, lattice: 68, barrier: 70,
                    skeeball: 74, basketball: 72, karaoke: 62, foosball: 74, lightgun: 56, airhockey: 80, dance: 70, whackamole: 54,
                    pingpong: 150, pooltable: 150, shuffleboard: 156, airhockey2: 150,
                    jackolantern: 40, pumpkinpile: 62, blackcat: 40, cauldron: 50, witchhat: 46, candelabra: 38, skeleton: 52, coffinshelf: 50,
                    apples: 62, fortune: 54, claw: 52, hauntedhouse: 60,
                    bbq: 70, pizzaoven: 72, tandoor: 62, spit: 96, smoker: 82,
                    shakevend: 58, energyvend: 58, popcorn: 50, shakebar: 80, sushibar: 84, shakeshelf: 80, sushishelf: 84,   // (V26; the plain counters the same size)
                    table_low: 76, table_lowround: 70, cushion: 46, pouf: 44, pot_lavender: 46, pot_flowers: 48, pot_ferns: 48, table_lowhw: 76, cushion_hw: 46, crystalball: 64, tarotreader: 68,
                    table_hwpumpkin: 72, table_hwweb: 62, table_hwslime: 74, table_hwskull: 84, chair_web: 42, chair_skull: 44, armchair_hw: 60,
                    stool_hwbat: 36, stool_hw: 34, pot_hwtree: 54, lamp_hw: 40, bookshelf_hw: 62, coatstand_hw: 44 };   // (V25)   // (V24 step 2, the patio's appliances)   // (Halloween's)
  // where a plain milkshake counter's three shakes stand, as fractions of its -l / -bl picture (the -r/-br mirror them):
  // along the middle of the bare top, from the back end to the front
  // (the sushi counter's along its front ledge, in front of the case of fish)
  const SHELF_AT = { shakeshelf: { l: [[0.29, 0.30], [0.50, 0.40], [0.72, 0.51]], bl: [[0.28, 0.23], [0.50, 0.34], [0.73, 0.45]] },
                     sushishelf: { l: [[0.44, 0.69], [0.60, 0.62], [0.76, 0.55]], bl: [[0.40, 0.60], [0.58, 0.53], [0.76, 0.46]] } };
  /** The prep counter that makes what a plain counter holds (the milkshake counter for the plain milkshake counter). */
  const makerOf = (kind) => C.BARS.find((k) => C.THINGS[k].menu === C.THINGS[kind].shelf);
  const shopPic = (kind) => ({ chair: "chair-fl", table: "table", plant: "fern" })[kind] || (has(kind) ? kind : kind === "sofa" && !has("sofa-l") ? "armchair-l" : kind + "-l");
  function sized(id, w) { const s = ART[id] || [w, w]; return { w: w, h: Math.round(w * s[1] / s[0]) }; }

  // ---- the ground (2026-10-21): the café's corner block -- grass, a pavement along the back of both walls, a kerb and
  // the sandstone road beyond, crossing another at the corner, with the same pavements on the other three corners.
  // Drawn flat in tiles and tipped onto the floor's angle, so it lines up with the floor; stand-ins until it's painted.
  function groundSVG(v) {
    // (later, Cam: "when i zoom out and try to place anything it wont let me it says its to far. So scale the map down to
    // the range where i can actually build") -- the ground is exactly where things can go (C.REACH), no further
    const RE = C.REACH || [-24, 52], lo = RE[0], k = 0.12, pw = 1.2, road = 2.28, rc = -(pw + k) - road / 2;      // the road's middle line (E: room round a café up to 30x30, V23)
    const m = `matrix(${TW / 2},${TH / 2},${-TW / 2},${TH / 2},${v.size * TW / 2},${WALL})`;
    const rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
    const bricks = [], tone = ["#d9b27a", "#cfa26a", "#e3c18e", "#c4955f", "#dcb684", "#b98a55"];
    for (let r = 0; r < 6; r++) for (let b = -1; b < 4; b++) {
      const x = b * 0.6 + (r % 2) * 0.3;
      bricks.push(`<rect x="${x + 0.018}" y="${r * 0.3 + 0.018}" width="0.564" height="0.264" rx="0.05" fill="${tone[Math.floor(rnd(r * 9 + b + 3) * tone.length)]}"/>`);
    }
    const slabs = [];
    for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) {
      const g = 196 + Math.floor(rnd(a * 3 + b) * 22);
      slabs.push(`<rect x="${a * 0.6 + 0.015}" y="${b * 0.6 + 0.015}" width="0.57" height="0.57" rx="0.02" fill="rgb(${g},${g - 2},${g - 8})"/>`);
    }
    const tufts = [];
    for (let i = 0; i < 6; i++) tufts.push(`<ellipse cx="${(rnd(i + 300) * 3).toFixed(2)}" cy="${(rnd(i + 400) * 3).toFixed(2)}" rx="${(0.5 + rnd(i + 500) * 0.6).toFixed(2)}" ry="${(0.35 + rnd(i + 600) * 0.4).toFixed(2)}" fill="${i % 2 ? "#97bf5c" : "#78a446"}" opacity="0.35"/>`);
    for (let i = 0; i < 26; i++) {
      const x = rnd(i) * 3, y = rnd(i + 50) * 3, r = 0.08 + rnd(i + 99) * 0.22, light = rnd(i + 7) > 0.5;
      tufts.push(`<ellipse cx="${x.toFixed(3)}" cy="${y.toFixed(3)}" rx="${r.toFixed(3)}" ry="${(r * 0.7).toFixed(3)}" fill="${light ? "#a3c868" : "#6f9a3e"}" opacity="0.45"/>`);
      if (i % 2) tufts.push(`<path d="M${x.toFixed(2)} ${y.toFixed(2)}l0.03 -0.09M${(x + 0.05).toFixed(2)} ${y.toFixed(2)}l0.02 -0.1M${(x + 0.1).toFixed(2)} ${y.toFixed(2)}l-0.01 -0.08" stroke="#557e2c" stroke-width="0.018" stroke-linecap="round"/>`);
    }
    // Sheet 06 (N34): the painted textures take over the stand-ins as soon as they're cut
    const tex = (id, pat, size, turn) => has(id) ? `<pattern id="${pat}" patternUnits="userSpaceOnUse" width="${size}" height="${size}"${turn ? ' patternTransform="rotate(90)"' : ""}><image href="${art(id)}" width="${size}" height="${size}" preserveAspectRatio="none"/></pattern>` : "";
    const painted = tex("tex-grass", "nc-grass", 4) + tex("tex-pavement", "nc-slab", 2.4) + tex("tex-road", "nc-brick", 3.2) + tex("tex-road", "nc-brick2", 3.2, true);
    // one corner's pavement and kerb (ours); the other three corners are it mirrored across the roads
    // PT55 p7 (Cam: expanding "adds extra grass on the side ... the edge of the grass needs to stay level with the edge
    // of the road"): the grass, the roads and the pavements all run to the same edge, hi -- and everything is clipped
    // to that square, so nothing sticks out past the others however big the café grows
    const hi = Math.max(RE[1], (v.cafeW || v.size) + 2), L = hi - lo;
    const corner = `<g id="nc-corner"><rect x="${-pw}" y="${-pw}" width="${pw}" height="${hi + pw}" fill="url(#nc-slab)"/><rect x="${-pw}" y="${-pw}" width="${hi + pw}" height="${pw}" fill="url(#nc-slab)"/>
      <rect x="${-pw - k}" y="${-pw - k}" width="${k}" height="${hi + pw + k}" fill="#9a958c"/><rect x="${-pw - k}" y="${-pw - k}" width="${hi + pw + k}" height="${k}" fill="#9a958c"/>
      <path d="M${-pw} ${hi}V${-pw}H${hi}" fill="none" stroke="#7d786f" stroke-width="0.025"/></g>`;
    return `<svg class="nc-ground" width="1" height="1" aria-hidden="true"><defs>${painted /* first: the first of an id wins */}
      <pattern id="nc-brick" patternUnits="userSpaceOnUse" width="1.8" height="1.8"><rect width="1.8" height="1.8" fill="#a37548"/>${bricks.join("")}</pattern>
      <pattern id="nc-brick2" patternUnits="userSpaceOnUse" width="1.8" height="1.8" patternTransform="rotate(90)"><rect width="1.8" height="1.8" fill="#a37548"/>${bricks.join("")}</pattern>
      <pattern id="nc-slab" patternUnits="userSpaceOnUse" width="1.2" height="1.2"><rect width="1.2" height="1.2" fill="#8f8b84"/>${slabs.join("")}</pattern>
      <pattern id="nc-grass" patternUnits="userSpaceOnUse" width="3" height="3"><rect width="3" height="3" fill="#86b04e"/>${tufts.join("")}</pattern>
      <clipPath id="nc-lot"><rect x="${lo}" y="${lo}" width="${L}" height="${L}"/></clipPath></defs>
      <g transform="${m}"><g clip-path="url(#nc-lot)">
        <rect x="${lo}" y="${lo}" width="${L}" height="${L}" fill="url(#nc-grass)"/><g id="nc-terrain"></g>
        <rect x="${rc - road / 2}" y="${lo}" width="${road}" height="${L}" fill="url(#nc-brick2)"/>
        <rect x="${lo}" y="${rc - road / 2}" width="${L}" height="${road}" fill="url(#nc-brick)"/>
        ${corner}<use href="#nc-corner" transform="matrix(-1,0,0,1,${2 * rc},0)"/><use href="#nc-corner" transform="matrix(1,0,0,-1,0,${2 * rc})"/><use href="#nc-corner" transform="matrix(-1,0,0,-1,${2 * rc},${2 * rc})"/>
      </g></g></svg>`;
  }

  // ---- street things (Sheet 07; placed by you since 2026-10-21): how tall each is drawn. Turned: the painted facing
  // for it if there is one (prop-<id>-l / -r, Sheet 08), else the one picture and its mirror.
  // street things that glow: colour (r,g,b), where (x, y of the picture), size (px), and whether by day too
  const PROP_GLOW = { hw_lantern: ["200,110,255", 0.33, 0.4, 76, true], hw_pumpkins: ["255,150,40", 0.5, 0.6, 150, false], hw_scarecrow: ["255,150,40", 0.5, 0.16, 70, false],
                      // (Cam, 25 Oct: "Jack o lanterns and skull candles should let off a little light")
                      hw_turnips: ["255,150,40", 0.5, 0.55, 130, false], hw_skulls: ["255,200,110", 0.5, 0.2, 110, false],
                      hw_patch: ["255,150,40", 0.5, 0.5, 90, false], hw_weblamp: ["255,220,140", 0.5, 0.12, 120, false] };
  // the garden and the homes (2026-10-25): drawn this tall whatever size their pictures are cut at -- the stand-ins'
  // heights, so the painted sheets (N54) drop in at the same size (the homes: set from Sheet 34 so they cover their HOME_FOOT)
  const NATURE_H = { rock_pebbles: 16, rock_small: 20, rock_flat: 18, rock_round: 32, rock_mossy: 38, rock_pile: 38, rock_tall: 68, rock_boulder: 60, rock_slab: 21, tree_stump: 32, tree_log: 26, tree_dead: 119, tree_dead2: 132, tree_pine: 164, tree_apple: 141, tree_cherry: 144, tree_maple: 150, tree_willow: 158, tree_cypress: 162, plant_fern: 33, plant_grass: 38, plant_flowers: 35, plant_lavender: 36, plant_mushrooms: 15, home_cottage: 202, home_bungalow: 177, home_terrace: 225, home_townhouse: 222, home_farmhouse: 229, home_shopfront: 242 };
  // where each painted home's front corner is across its -l picture (Sheet 34, 0-1 from the left)
  const HOME_FRONT = { home_cottage: 0.573, home_bungalow: 0.685, home_terrace: 0.424, home_townhouse: 0.531, home_farmhouse: 0.601, home_shopfront: 0.588 };
  const PROP_H = { lamp: 190, tree: 230, tree2: 215, bench: 58, hedge: 64, planter: 52, bin: 60, aframe: 58, bush: 62, flowerbed: 38,
                   postbox: 78, bikerack: 64, picnic: 58, bollard: 40, fence: 56, sign: 118,
                   vale_chest: 44, vale_dummy: 70, vale_anvil: 40, vale_wispjar: 40, vale_grindstone: 62, vale_hives: 64, vale_pond: 56,
                   farm_fence: 44, farm_can: 30, farm_hay: 40, farm_compost: 46, farm_cart: 58, farm_windmill: 170, farm_glass: 120, farm_barn: 150, farm_coop: 92, furnstore: 175, mansion: 230, santa: 185, warren: 165, longhouse: 200,
                   hw_pumpkins: 46, hw_haybale: 56, hw_lantern: 120, hw_crow: 56, hw_witchsign: 110, hw_graves: 60, hw_cauldron: 64, hw_scarecrow: 120,
                   hw_coffin: 86, hw_spiderarch: 120, hw_ghost: 90, hw_deadtree: 190,
                    hw_webtree: 200, hw_weblamp: 190, hw_bigweb: 110, hw_broom: 70, hw_turnips: 50, hw_deckchair: 80, hw_skulls: 60, hw_mummy: 100,
                    pond_small: 37, pond_lily: 45, pond_big: 58, pond_koi: 49, gnome: 35, birdbath: 57, birdhouse: 98, sundial: 52, bridge: 66, stonelantern: 60,
                    rosearch: 126, fountain: 102, well: 110, statue: 100, pergola: 164, gazebo: 190, coffeecart: 100, icecart: 96, popcart: 96, cinema: 170,   // (V26, Sheets 45 and 47)
                    hw_gargoyle: 90, hw_postbox: 80, hw_sweets: 70, hw_patch: 40, hw_barrow: 70, hw_crowpost: 80, hw_rocker: 64, hw_fog: 40 };   // (NeuroVale's keepsakes)
  const propPic = (id) => propFace(id, 0).pic;
  function propFace(id, dir) {
    const lr = dir % 2 ? "r" : "l", other = lr === "l" ? "r" : "l";
    // painted four ways (2026-10-24, the furniture store: its sign mustn't read backwards) -- the backs as the chairs'
    if (dir % 4 >= 2 && has(`prop-${id}-${dir % 4 === 2 ? "bl" : "br"}`)) return { pic: `prop-${id}-${dir % 4 === 2 ? "bl" : "br"}`, flip: false };
    if (has(`prop-${id}-${lr}`)) return { pic: `prop-${id}-${lr}`, flip: dir >= 2 };
    if (has(`prop-${id}-${other}`)) return { pic: `prop-${id}-${other}`, flip: dir < 2 };   // only one facing painted: its mirror
    return { pic: "prop-" + id, flip: dir === 1 || dir === 2 };
  }
  /** (Cam, 25 Oct: "make the fog machine actually have an effect") -- a low bank of purple mist rolling out along the
      ground from its nozzle: soft puffs that drift and swell, stepped by the page's clock (nc-up / nc-sway), not an
      endless animation. */
  function fogHTML(p, left, top, w, h, flip, z) {
    const sx = flip ? 1 : -1, nx = left + (flip ? w * 0.92 : w * 0.08), ny = top + h * 0.72;
    return [[0.0, 0, 0, 44], [0.6, 4, -10, 64], [1.2, 10, 14, 84], [1.9, 14, -14, 104], [2.6, 20, 18, 120], [3.3, 26, -6, 130], [4.0, 30, 10, 136]].map(([d, dy, dx, r], i) =>
      `<span class="nc-fog f${i}" style="left:${Math.round(nx + sx * d * 44 + dx - r / 2)}px;top:${Math.round(ny + dy - r * 0.3)}px;width:${r}px;height:${Math.round(r * 0.6)}px;z-index:${z + (i ? -1 : 1)}"></span>`).join("");
  }
  /** The coop's two hens (2026-10-23), pecking about in front of it -- asleep at night. */
  const COOP_H = 34;
  function henHTML(v, p, w, z, ghost) {
    const night = skyNow(v).name === "night", hens = [["hen-white", -0.42, 4], ["hen-brown", 0.38, 10]];
    return hens.map(([pic, dx, dy], i) => {
      const id = night && has(pic + "-sleep") ? pic + "-sleep" : pic, a = ART[id];
      if (!a) return "";
      const h = COOP_H * (id.endsWith("sleep") ? 0.8 : 1), hw = Math.round(h * a[0] / a[1]);
      return `<img class="nc-hen${i ? " flip" : ""}${ghost ? " ghost" : ""}" alt="" src="${art(id)}" style="left:${Math.round(p.x + dx * w - hw / 2)}px;top:${Math.round(p.y + dy - h)}px;width:${hw}px;height:${Math.round(h)}px;z-index:${z + 2}">`;
    }).join("");
  }
  function coopTip(c) {
    return c.full ? `The nest's full (${c.eggs} eggs) -- the hens won't lay more till you collect` : c.eggs ? `${c.eggs} egg${c.eggs > 1 ? "s" : ""} to collect · the next in ${clock(c.next - now())}` : `No eggs yet -- the next in ${clock(c.next - now())}`;
  }
  /** The street things, split: behind the café's walls (into #nc-out) and in front of them (in with the café's things). */
  function streetThings(v) {
    const back = [], front = [], list = v.decor.slice();
    // PT56: the tiles laid outside, flat on the grass under everything else there (in floor mode, the one under the
    // pointer shows the floor you're laying -- or goes faint when you're lifting it with Grass)
    const tiles = Object.assign({}, v.outFloors);
    const hv = build && build.paint && hover && !C.outFloorProblem(state, hover.x, hover.y) && !(hover.x >= 0 && hover.y >= 0 && hover.x < v.size && hover.y < v.size) ? hover.x + "," + hover.y : null;
    if (hv && build.paint !== "grass") tiles[hv] = build.paint;
    Object.keys(tiles).forEach((k) => {
      const [c, r] = k.split(",").map(Number), p = at(v, c, r), fl = "floor-" + tiles[k], behind = c < 0 || r < 0;
      (behind ? back : front).push(`<img class="nc-tile nc-outdoor${k === hv ? (build.paint === "grass" ? " lift" : " paint") : ""}" alt="" src="${art(has(fl) ? fl : "floor-grey")}" style="left:${p.x - TW / 2}px;top:${p.y}px;width:${TW}px;height:${Math.round(TH * 1.13)}px;z-index:${behind ? 1 : 2}">`);
    });
    const g = build && build.street && hoverP && (build.placeDecor || build.moveDecor) && !(line && line.pts);
    if (line && line.pts && build.placeDecor) line.pts.forEach((q) => list.push({ uid: 0, id: build.placeDecor, x: q.x, y: q.y, dir: line.dir, ghost: true, scale: build.scale | 0 }));
    if (g) {
      const id = build.placeDecor || (v.decor.find((o) => o.uid === build.moveDecor) || {}).id;
      const q = freePlace ? { x: hoverP.x, y: hoverP.y, dir: heldDir(v) } : C.DECO[id] && C.DECO[id].fence ? C.fenceAt(hoverP.x, hoverP.y, heldDir(v))
        : Object.assign(C.buildingAt(id, hoverP.x, hoverP.y, heldDir(v)), { dir: heldDir(v) });   // (a building: flush to the pavement when near it)
      list.push({ uid: 0, id, x: q.x, y: q.y, dir: q.dir, ghost: true, scale: build.placeDecor ? build.scale | 0 : (v.decor.find((o) => o.uid === build.moveDecor) || {}).scale | 0 });
    }
    list.forEach((o) => {
      if (!o.id || (build && build.moveDecor === o.uid && !o.ghost)) return;
      const fence = C.DECO[o.id] && C.DECO[o.id].fence, f = propFace(o.id, fence ? o.dir % 2 : o.dir);
      // V26: a cart that's run dry or out of its hours shows shut; the cinema's screen lights up after dark with a reel in
      const shut = o.stall && (o.stall.dry || !o.stall.selling) && has(`prop-${o.id}-shut`), film = o.id === "cinema" && o.stall && !o.stall.dry && skyNow(v).dark && !build;
      if (shut) f.pic = `prop-${o.id}-shut`;
      if (film && has("prop-cinema-on")) f.pic = "prop-cinema-on";
      const a = ART[f.pic];
      if (!a) return;
      const p = at(v, o.x, o.y), behind = o.x < 0 || o.y < 0, run = fence && META[f.pic] && META[f.pic].run;
      const D0 = C.DECO[o.id] || {};
      let h = Math.round((PROP_H[o.id] || NATURE_H[o.id] || (D0.nature || D0.home ? Math.round(a[1] / 2) : 60)) * C.growOf(o)), w = Math.round(h * a[0] / a[1]), left = Math.round(p.x - w / 2), top = Math.round(p.y - h + 6);   // (a plant grown with = : C.GROW)
      if (HOME_FRONT[o.id]) {                         // (a painted home: its front corner, not its middle, on its spot)
        let fr = f.pic.endsWith("-r") ? 1 - HOME_FRONT[o.id] : HOME_FRONT[o.id];
        if (f.flip) fr = 1 - fr;
        left = Math.round(p.x - w * fr);
      }
      if (run) {
        // a fence segment (PT56): post to post exactly one tile, along its tile edge -- a run joins up, and turns at a corner
        const [lx, ly, bx, , rx, ry] = run, r = o.dir % 2 === 1;
        w = Math.round(TW / 2 / (r ? rx - bx : bx - lx) * 1.04); h = Math.round(w * a[1] / a[0]);   // (a little over: no gap)
        const P = r ? at(v, o.x, o.y - 0.5) : at(v, o.x - 0.5, o.y);
        left = Math.round(P.x - (r ? rx : lx) * w); top = Math.round(P.y - (r ? ry : ly) * h);
      }
      const why = o.ghost ? C.decorProblem(state, o.id, o.x, o.y, build.moveDecor || -1, o.dir, freePlace, o.scale | 0) : "", ok = !why;
      const cls = `nc-prop${f.flip ? " flip" : ""}${o.ghost ? (ok ? " ghost" : " ghost bad") : ""}${build && build.pickDecor === o.uid ? " picked" : ""}`;
      const z = behind ? 1000 + Math.round((o.x + o.y) * 10) : 10 + Math.round((o.x + o.y - 0.5) * 10) + 5;
      const coop = o.coop || (o.ghost && C.DECO[o.id] && C.DECO[o.id].coop);
      const shop = !o.ghost && C.DECO[o.id] && C.DECO[o.id].store;          // (2026-10-24) the furniture store opens its shop
      const haunt = !o.ghost && C.DECO[o.id] && C.DECO[o.id].house;         // (and an event's house its page of the Events book)
      const home = !o.ghost && C.DECO[o.id] && C.DECO[o.id].home, hst = home && (v.homes || {})[o.uid];      // (2026-10-24: a home's order)
      const stl = !o.ghost && o.stall;
      (behind ? back : front).push(`<img class="${cls}${coop && !o.ghost ? " nc-coop" : ""}${stl ? " nc-stall" : ""}${shop ? " nc-shop" : ""}${haunt ? " nc-haunt" : ""}${home ? " nc-home" : ""}"${haunt ? ` data-house="${haunt}"` : ""} alt="" data-decor="${o.ghost ? "" : o.uid}" src="${art(f.pic)}" draggable="false" style="left:${left}px;top:${top}px;width:${w}px;height:${h}px;z-index:${z}"${stl ? ` title="${esc(stallSays(o))}"` : ""}${o.coop ? ` title="${esc(coopTip(o.coop))}"` : ""}>`
        + (why ? `<span class="nc-why" style="left:${Math.round(p.x)}px;top:${Math.round(p.y - h - 4)}px;z-index:${z + 1}">${esc(why)}</span>` : "")
        + (hst && hst.order && !build ? `<button class="nc-bub nc-hord${hst.order.have >= hst.order.n ? " go" : ""}" data-order="${o.uid}" title="${esc(`They'd like ${hst.order.n} ${hst.order.dish.name.toLowerCase()} delivered -- ${hst.order.value} coins`)}" style="left:${left + Math.round(w / 2)}px;top:${top + Math.round(h * 0.18)}px;z-index:${z + 2}"><img alt="" src="${art("dish-" + hst.order.dish.id)}">×${hst.order.n}</button>` : "")
        // (2026-10-24, Cam: "a purple one from the halloween lantern") -- round its glass
        // (Cam: "anytime there is a jack o lantern i want light omitted from them at night") -- the jack-o'-lantern pile and
        // the scarecrow's pumpkin head glow orange after dark
        + (PROP_GLOW[o.id] && !o.ghost && (PROP_GLOW[o.id][4] || skyNow(v).dark) ? `<span class="nc-pglow" style="--g:${PROP_GLOW[o.id][0]};left:${Math.round(left + w * (f.flip ? 1 - PROP_GLOW[o.id][1] : PROP_GLOW[o.id][1]))}px;top:${Math.round(top + h * PROP_GLOW[o.id][2])}px;width:${PROP_GLOW[o.id][3]}px;height:${PROP_GLOW[o.id][3]}px;margin:${-PROP_GLOW[o.id][3] / 2}px 0 0 ${-PROP_GLOW[o.id][3] / 2}px"></span>` : "")
        + (o.id === "hw_fog" && !o.ghost ? fogHTML(p, left, top, w, h, f.flip, z) : "")
        // (Cam, 25 Oct: "i placed popcorn cart and coffee but nothing is happening") -- a stall always says what it's doing:
        // its coins, run dry, selling (the first coins come after 5 minutes), or when it opens
        + (stl && !build ? `<span class="nc-bub ${stl.dry ? "empty" : stl.coins ? "money" : "stallnote"}" style="left:${Math.round(p.x)}px;top:${Math.round(top - 6)}px;z-index:${z + 3}">${stl.dry ? EMPTY_IC : ""}${stl.coins ? `${COIN}${num(stl.coins)}` : stl.dry ? "" : esc(stallShort(o))}</span>` : "")
        + (film ? `<span class="nc-pglow" style="--g:200,220,255;left:${Math.round(left + w / 2)}px;top:${Math.round(top + h * 0.42)}px;width:${Math.round(w * 0.9)}px;height:${Math.round(h * 0.6)}px;margin:${-Math.round(h * 0.3)}px 0 0 ${-Math.round(w * 0.45)}px;z-index:${z - 1}"></span>` : "")
        + (coop ? henHTML(v, p, w, z, !!o.ghost) : "")
        + (o.coop && o.coop.eggs ? `<span class="nc-bub nc-eggs${o.coop.full ? " full" : ""}" style="left:${Math.round(p.x)}px;top:${Math.round(p.y - h - 14)}px;z-index:${z + 3}"><img alt="" src="${art("item-egg")}">${o.coop.eggs}</span>` : ""));
    });
    // the field (2026-10-22): plots dug wherever you put them -- NeuroFarm's soil, its crops growing through four stages
    if (v.field) {
      const tile = (x, y) => { const l = at(v, x, y + 1), tp = at(v, x, y); return `left:${Math.round(l.x)}px;top:${Math.round(tp.y)}px;width:${TW}px;height:${TH}px`; };
      v.field.plots.forEach((pl) => {
        if (build && build.movePlot === pl.uid) return;
        // (behind the walls like the street things there; in front of the café, in the front layer so nothing in it covers them)
        const behind = pl.x < 0 || pl.y < 0, L = behind ? back : front, c = at(v, pl.x + 0.5, pl.y + 0.5);
        // (the soil flat under everything (2026-10-24, Cam: "some of the crop seedlings dont appear" -- at 900 it covered
        // the crops of plots far out, whose depth goes under 900); over a tile laid outside (1)
        const z = behind ? 1000 + Math.round((pl.x + pl.y + 1) * 10) : 15 + Math.round((pl.x + pl.y + 0.5) * 10), tz = behind ? 2 : 3;
        const hot = pl.ready && pl.spoilsIn < pl.keep * 0.35;
        const tip = pl.crop ? (pl.spoiled ? `${pl.name}: gone over -- click to clear the plot` : pl.ready ? `${pl.name}: ready to pick -- it goes over in ${clock(pl.spoilsIn)}` : `${pl.name}: ${clock(pl.left)} to go`) : "An empty plot: click to sow";
        L.push(`<button class="nc-plot${pl.crop ? "" : " empty"}${build && build.pickPlot === pl.uid ? " picked" : ""}" data-plot="${pl.uid}" title="${esc(tip)}" style="${tile(pl.x, pl.y)};z-index:${tz}"></button>`);
        if (pl.crop) L.push(`<img class="nc-crop${pl.ready ? " ripe" : ""}${pl.spoiled ? " gone" : ""}" alt="" src="${art(`crop-${pl.crop}-${pl.stage}`)}" style="left:${Math.round(c.x - 46)}px;top:${Math.round(c.y - 80)}px;z-index:${z}">`
          + (pl.spoiled ? `<span class="nc-bub bad nc-crop-bub" style="left:${Math.round(c.x + 30)}px;top:${Math.round(c.y - 60)}px;z-index:${z + 1}">✕</span>` : "")
          + (pl.ready ? `<span class="nc-bub go nc-crop-bub${hot ? " hot" : ""}" style="left:${Math.round(c.x + 30)}px;top:${Math.round(c.y - 60)}px;z-index:${z + 1}">✓</span>` : ""));
      });
      // the plow in your hand (or a plot being moved): a tile's ghost where it would go, red with why when it can't
      if (line && line.pts && build.placePlot) line.pts.forEach((q) => {
        const why = C.plotProblem(state, q.x, q.y, -1);
        (q.x < 0 || q.y < 0 ? back : front).push(`<div class="nc-plot ghost${why ? " bad" : ""}" style="${tile(q.x, q.y)};z-index:${q.x < 0 || q.y < 0 ? 3 : 4}"></div>`);
      });
      else if (build && (build.placePlot || build.movePlot) && hoverP) {
        const gx = Math.floor(hoverP.x), gy = Math.floor(hoverP.y), why = C.plotProblem(state, gx, gy, build.movePlot || -1) || (build.placePlot && v.field.have >= v.field.allowed ? "No more plots at your level" : "");
        const c = at(v, gx + 0.5, gy + 0.5);
        (gx < 0 || gy < 0 ? back : front).push(`<div class="nc-plot ghost${why ? " bad" : ""}" style="${tile(gx, gy)};z-index:${gx < 0 || gy < 0 ? 3 : 4}"></div>` + (why ? `<span class="nc-why" style="left:${Math.round(c.x)}px;top:${Math.round(c.y - 40)}px;z-index:2000">${esc(why)}</span>` : ""));
      }
    }
    // (Cam, 25 Oct: "the Aunty button can go away and every day a crate appears in the street that is clicked to open"):
    // her box waits on the pavement just past the café's front-left corner (in sight -- the door's wall hides what's behind it)
    if (v.aunty && v.aunty.waiting) {
      const ax = -0.8, ay = v.size + 0.7, ap = at(v, ax, ay), h = 58, w = h;
      front.push(`<button class="nc-crate-st" data-aunty title="A box from Aunty -- click to open it (it won't keep past midnight)" style="left:${Math.round(ap.x - w / 2)}px;top:${Math.round(ap.y - h + 6)}px;width:${w}px;height:${h}px;z-index:${10 + Math.round((ax + ay - 0.5) * 10) + 5}"><img alt="" src="cafe/art/ui/icon-crate.webp"></button>`);
    }
    // the request cart (2026-10-22): today's tutor from NeuroVale waits on the road by the door with the cart and horse
    if (v.cart) {
      // (on the road by the door, two tiles and more out so they stand clear above the wall at any size; the tutor by the cart)
      const cy = C.entry(state).y + 0.6, ty = cy - 1.1, cp = at(v, -2.6, cy), tp = at(v, -2.05, ty), ch = 112, cw = Math.round(ch * ART["cart-vale"][0] / ART["cart-vale"][1]);
      const tpic = "tutor-" + v.cart.tutor.id, th = 62, tw = Math.round(th * ART[tpic][0] / ART[tpic][1]);
      const got = v.cart.order.reduce((a, l) => a + l.got, 0), all = v.cart.order.reduce((a, l) => a + l.n, 0);
      const z = 1000 + Math.round((-2.6 + cy) * 10), tz = 1000 + Math.round((-2.05 + ty) * 10);
      back.push(`<button class="nc-cart" data-cart title="${esc(v.cart.tutor.name)} from NeuroVale has an order for you" style="left:${Math.round(cp.x - cw / 2)}px;top:${Math.round(cp.y - ch + 8)}px;width:${cw}px;height:${ch}px;z-index:${z}"><img alt="" src="${art("cart-vale")}"></button>`
        + `<button class="nc-cart tutor" data-cart title="${esc(v.cart.tutor.name)}" style="left:${Math.round(tp.x - tw / 2)}px;top:${Math.round(tp.y - th + 4)}px;width:${tw}px;height:${th}px;z-index:${tz}"><img alt="" src="${art(tpic)}"></button>`
        + `<button class="nc-cart-bub" data-cart style="left:${Math.round(cp.x)}px;top:${Math.round(cp.y - ch - 6)}px;z-index:${z + 1}"><img alt="" src="cafe/art/ui/aunty-page.webp">${num(got)} / ${num(all)}</button>`);
    }
    return { back: back.join(""), front: front.join("") };
  }
  /** Where on the ground the pointer is, in tiles, to a quarter tile. */
  function groundAt(v, ev, fine) {
    const exact = fine || (freePlace && build && build.street);
    const world = $("nc-world"), b = world.getBoundingClientRect(), sc = b.width / parseFloat(world.style.width);
    const x = (ev.clientX - b.left) / sc + BOX.x - v.size * TW / 2, y = (ev.clientY - b.top) / sc + BOX.y - WALL;
    const q = (n) => (exact ? Math.round(n * 100) / 100 : Math.round(n * 4) / 4);
    return { x: q((x / (TW / 2) + y / (TH / 2)) / 2), y: q((y / (TH / 2) - x / (TW / 2)) / 2) };
  }

  // ---- day and night (PT45, like NeuroPets): the street dims by your clock -- dawn, day, dusk, evening, night -- by
  // multiplying, so it keeps its own colours; the café stays lit inside; lamps glow after dark. The sandbox can set it.
  const SKY = { dawn: "#fbe6d4", dusk: "#f6d9b4", evening: "#c9b4ae", night: "#7d7896" };
  function skyNow(v) {
    const set = v.sandbox && v.dev && v.dev.sky;
    const d = new Date(now()), h = set === "night" ? 23 : set === "dusk" ? 18 : set === "day" ? 12 : d.getHours() + d.getMinutes() / 60;
    if (h >= 20 || h < 5) return { name: "night", fill: SKY.night, dark: true };   // (2026-10-26, Cam: night from 8 pm -- it was 9)
    if (h < 7) return { name: "dawn", fill: SKY.dawn, dark: false };
    if (h < 17) return { name: "day", fill: "", dark: false };
    if (h < 19) return { name: "dusk", fill: SKY.dusk, dark: false };
    return { name: "evening", fill: SKY.evening, dark: true };
  }
  /** A wash over the whole street with the café cut out of it (its floor and its walls up to the cap). */
  function skyHTML(v) {
    const sky = skyNow(v);
    document.body.dataset.sky = sky.name;
    if (!sky.fill) return "";
    // (Cam, 25 Oct: "it is set to night time, but one portion of the map is day" -- the wash was a fixed 4,000px square,
    // and the ground you can build on reaches past it: it's as big as the whole map now, with a margin)
    const RE = C.REACH || [-24, 52], ext = [[RE[0] - 3, RE[0] - 3], [RE[1] + 3, RE[0] - 3], [RE[0] - 3, RE[1] + 3], [RE[1] + 3, RE[1] + 3]].map(([c, r]) => at(v, c, r));
    const ws = sized("wall-l", TW / 2 + 1), up = Math.round(((META["wall-l"] || {}).yr || 0.78) * ws.h) + 2, R = Math.ceil(Math.max(...ext.map((p) => Math.max(Math.abs(p.x), Math.abs(p.y))))) + 400;   // up: the face's height
    const pt = (c, r, lift) => { const p = at(v, c, r); return `${Math.round(p.x + R)}px ${Math.round(p.y - (lift || 0) + R)}px`; };
    // the hole is drawn round and back to its first corner, so the line out to it and back encloses nothing
    const z = v.size, ring = [pt(0, z), pt(0, z, up), pt(0, 0, up), pt(z, 0, up), pt(z, 0), pt(z, z)], hole = ring.concat([ring[0]]).join(",");
    const box = `0 0,${2 * R}px 0,${2 * R}px ${2 * R}px,0 ${2 * R}px,0 0`;
    const lamps = sky.dark ? v.decor.filter((o) => o.id === "lamp").map((o) => { const p = at(v, o.x, o.y); return `<span class="nc-lampglow" style="left:${Math.round(p.x)}px;top:${Math.round(p.y - (PROP_H.lamp || 190) * 0.88)}px"></span>`; }).join("") : "";
    return `<div class="nc-sky" style="left:${-R}px;top:${-R}px;width:${2 * R}px;height:${2 * R}px;background:${sky.fill};clip-path:polygon(evenodd,${box},${hole})"></div>${lamps}${roomDark(v, sky, ring, R)}`;
  }
  // 2026-10-24 (Cam: "at night the café is dim and requires lighting like lamps"): after dark the inside dims too,
  // multiplied like the street, and every light that's on lights a pool round it (near-white in a multiply layer leaves
  // what's under it as it is) -- lamps, wall lights (up the wall round them) and the ceiling's (wider). Over the floor
  // and walls only, the street's own wash outside it. (The sandbox first; everyone's since the lights came in.)
  const ROOM_DARK = { evening: "#a49cb8", night: "#5f5a80" }, LAMP_REACH = 2.6, SCONCE_REACH = 1.9;   // reach: in tiles
  const LIGHT_TONE = { warm: [255, 243, 216], cool: [236, 244, 255], white: [250, 250, 240], amber: [255, 228, 182] };
  /** The lights that are on: where each lights from (screen), how far, what colour. */
  function lightPools(v) {
    const out = [], up = wallUp();
    v.items.filter((i) => C.THINGS[i.kind] && C.THINGS[i.kind].lamp && !i.off).forEach((i) => { const p = at(v, i.x + 0.5, i.y + 0.5); out.push({ x: p.x, y: p.y - 34, reach: LAMP_REACH, tone: "warm" }); });
    Object.keys(v.hang || {}).forEach((k) => {
      const P = C.PAINTING[v.hang[k]];
      if (!P || !P.light || (v.hangOff || {})[k]) return;
      const i = +k.slice(1), p = k[0] === "l" ? at(v, 0.2, i + 0.5) : at(v, i + 0.5, 0.2);
      out.push({ x: p.x, y: p.y - up * 0.45, reach: SCONCE_REACH, tone: "warm" });
    });
    Object.keys(v.ceil || {}).forEach((k) => {
      const c = v.ceil[k], L = C.CEIL[c.id];
      if (c.off || !L) return;
      const [x, y] = k.split(",").map(Number), p = at(v, x + 0.5, y + 0.5);
      out.push({ x: p.x, y: p.y - 24, reach: L.reach, tone: L.tone });
    });
    // the machines' glows light a little round them too, in their own colour (else the dark covers them)
    v.items.forEach((i) => {
      const rgb = MGLOW[i.kind] ? MGLOW[i.kind][0] : i.kind === "arcade" ? "150,210,255" : i.kind === "jukebox" || i.kind === "dance" ? "235,190,255" : "";
      if (!rgb) return;
      const p = at(v, i.x + 0.5, i.y + 0.5);
      out.push({ x: p.x, y: p.y - 30, reach: 1.3, rgb: rgb.split(",").map((n) => Math.round((+n + 255 * 2) / 3)) });
    });
    return out;
  }
  function roomDark(v, sky, ring, R) {
    if (!sky.dark) return "";
    // (2026-10-24, Cam: a thin black line down the screen at the café's right corner -- the GPU leaked a column of a huge
    // div's CSS clip-path along its edge): drawn as an SVG the size of the café instead, the floor and walls' outline as
    // its clip path, the night colour filling it and each light's pool over that, all multiplied onto the café
    const pts = ring.map((q) => q.split(" ").map((n) => parseFloat(n) - R));
    const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]), pad = 4;
    const x0 = Math.floor(Math.min(...xs)) - pad, y0 = Math.floor(Math.min(...ys)) - pad, w = Math.ceil(Math.max(...xs)) + pad - x0, h = Math.ceil(Math.max(...ys)) + pad - y0;
    const grads = [], pools = [];
    lightPools(v).forEach((l, i) => {
      const rx = Math.round(l.reach * TW / 2), ry = Math.round(rx * 0.7), [r, g, b] = l.rgb || LIGHT_TONE[l.tone] || LIGHT_TONE.warm;
      const hi = `rgb(${Math.round((r + 255) / 2)},${Math.round((g + 255) / 2)},${Math.round((b + 255) / 2)})`, c = `rgb(${r},${g},${b})`;
      grads.push(`<radialGradient id="ncrd${i}"><stop offset="0" stop-color="${hi}"/><stop offset=".35" stop-color="${c}"/><stop offset=".65" stop-color="${c}" stop-opacity=".55"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`);
      pools.push(`<ellipse cx="${Math.round(l.x - x0)}" cy="${Math.round(l.y - y0)}" rx="${rx}" ry="${ry}" fill="url(#ncrd${i})"/>`);
    });
    return `<svg class="nc-roomdark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="left:${x0}px;top:${y0}px" aria-hidden="true"><defs>${grads.join("")}<clipPath id="ncrd-ring"><polygon points="${pts.map((q) => `${q[0] - x0},${q[1] - y0}`).join(" ")}"/></clipPath></defs>
      <g clip-path="url(#ncrd-ring)"><rect width="${w}" height="${h}" fill="${ROOM_DARK[sky.name]}"/>${pools.join("")}</g></svg>`;
  }
  /** How high the walls' faces stand (px): the ceiling, more or less. */
  const wallUp = () => ((META["wall-l"] || {}).yr || 0.78) * sized("wall-l", TW / 2 + 1).h;

  // ---- the ceiling's lights (2026-10-24, Cam: "roof lights will have to be see through ... so we can still see and
  // interact with the cafe"): each hangs over its tile, its lowest point just over people's heads (CEIL_LOW), its
  // cord going up out of sight; drawn see-through and letting clicks through to the café under it -- except while
  // you're choosing, putting up or moving ceiling lights (body.nc-ceiling), when the café goes faint instead.
  const CEIL_W = { "ceil-led": 84, "ceil-lantern": 52, "ceil-cage": 56, "ceil-wire": 100, "ceil-globe": 48, "ceil-edison": 64, "ceil-tiffany": 70, "ceil-chandelier": 104 }, CEIL_LOW = 104;
  const CORD_UP = 54, NO_CORD = ["ceil-wire"];                // (its cord on up, fading out of sight; the wire lights have their rods)
  function ceilOne(v, key, c, cls) {
    const [x, y] = key.split(",").map(Number), p = at(v, x + 0.5, y + 0.5), sz = sized(c.id, CEIL_W[c.id] || 56), L = C.CEIL[c.id] || { name: "Light" };
    // (Cam, 2026-10-24: the light "at all times unless turned off. Even during the day" -- its glow whenever it's on)
    const ghost = /ghost/.test(cls || ""), on = ghost || !c.off, lit = on, top = p.y - CEIL_LOW - sz.h;
    const tip = `${L.name}${ghost ? "" : c.off ? " (off)" : ""} -- the switch by the door turns the ceiling lights on and off`;
    return `<img class="nc-ceil${on ? " on" : " off"}${lit ? " lit" : ""}${cls ? " " + cls : ""}" alt="${esc(L.name)}" title="${esc(tip)}" data-ceil="${key}" src="${art(c.id)}"
      style="left:${Math.round(p.x - sz.w / 2)}px;top:${Math.round(top)}px;width:${sz.w}px;height:${sz.h}px;z-index:${960 + x + y}">`
      + (NO_CORD.includes(c.id) ? "" : `<span class="nc-cord${ghost ? " ghost" : ""}" style="left:${Math.round(p.x - 1)}px;top:${Math.round(top - CORD_UP + 1)}px;height:${CORD_UP}px;z-index:${960 + x + y}"></span>`)
      // (Cam, 2026-10-24: "disperse to the ground of the cafe not mid air") -- its light a pool on the floor under it,
      // day and night (after dark the café's dimming lights that spot too); placing or picking one, the pool is coloured
      + (lit ? `<span class="nc-ceilpool${ghost ? " ghost" : ""}${/picked/.test(cls || "") ? " picked" : ""}" style="left:${Math.round(p.x)}px;top:${Math.round(p.y - 4)}px;width:${Math.round((L.reach || 3) * TW * 0.8)}px;height:${Math.round((L.reach || 3) * TW * 0.4)}px;z-index:${958 + x + y}"></span>` : "");
  }
  function ceilHTML(v) {
    const ce = v.ceil || {}, out = [];
    Object.keys(ce).forEach((k) => { if (!(build && build.moveCeil === k)) out.push(ceilOne(v, k, ce[k], build && build.pickCeil === k ? "picked" : "")); });
    // putting one up or moving one: a ghost over the tile under the pointer
    const id = build && (build.ceil || (build.moveCeil && (ce[build.moveCeil] || {}).id));
    if (id && hover) { const k = hover.x + "," + hover.y; out.push(ceilOne(v, k, { id }, ce[k] && k !== build.moveCeil ? "ghost bad" : "ghost")); }
    return out.join("");
  }
  /** The light switch for the ceiling's lights, on the wall by the door (left of it, at hand height). */
  function switchHTML(v) {
    const ks = Object.keys(v.ceil || {}), on = ks.some((k) => !v.ceil[k].off), up = wallUp();
    const A = at(v, 0, v.door + 1), B = at(v, 0, v.door), fx = 0.13, P = { x: A.x + (B.x - A.x) * fx, y: A.y + (B.y - A.y) * fx - up * 0.42 };
    const sz = sized("lightswitch-on", 12), tip = ks.length ? `Light switch: the ceiling lights ${on ? "off" : "on"}` : "Light switch (no ceiling lights yet -- Buy > Lighting)";
    return has("lightswitch-on") ? `<img class="nc-switch" alt="" data-switch="1" title="${esc(tip)}" aria-label="${esc(tip)}" src="${art(on ? "lightswitch-on" : "lightswitch-off")}"
      style="left:${Math.round(P.x - sz.w / 2)}px;top:${Math.round(P.y - sz.h / 2)}px;width:${sz.w}px;height:${sz.h}px">` : "";
  }

  // ---- painted ground (2026-10-24): each dab a circle in tile space (so it lies flat on the ground's angle); a run of
  // dabs of one ground is one mask -- blurred and roughened at its edge, Sims-style -- over that ground's texture. The
  // stroke being painted and the brush under the pointer are drawn on top till it's let go.
  let terrainKey = "", brushAt = null;
  const TER_TEX = { paving: ["tex-pavement", 2.4], cobble: ["tex-road", 3.2] };
  function terrainSVG(list, cur) {
    const used = {}, runs = [];
    list.forEach((d) => { used[d[0]] = 1; const last = runs[runs.length - 1]; if (last && last.t === d[0]) last.d.push(d); else runs.push({ t: d[0], d: [d] }); });
    const pat = (id, pic, sz) => `<pattern id="nc-t-${id}" patternUnits="userSpaceOnUse" width="${sz}" height="${sz}"><image href="${art(pic)}" width="${sz}" height="${sz}" preserveAspectRatio="none"/></pattern>`;
    const pats = Object.keys(used).map((id) => { const [pic, sz] = TER_TEX[id] || ["tex-" + id, 3];
      // (2026-10-26: one frame -- the water's second frame, swapped every 1.5 s, redrew all the painted ground each time)
      return pat(id, pic, sz); }).join("");
    const box = `x="-40" y="-40" width="120" height="120"`;
    const body = runs.map((r, i) => `<mask id="nc-tm${i}" maskUnits="userSpaceOnUse" ${box}><g filter="url(#nc-tsoft)" fill="#fff">${r.d.map((d) => `<circle cx="${d[1]}" cy="${d[2]}" r="${d[3]}"/>`).join("")}</g></mask>
      <rect ${box} fill="url(#nc-t-${r.t})" mask="url(#nc-tm${i})"/>`).join("");
    // the shovel's dug ground lies lower (Cam, 25 Oct): over everything painted, a shaded bank along its far edges (the
    // hollow's own side, in shadow) and a lit lip along its near ones -- the dug shape less itself moved a little
    const dug = list.filter((d) => d[0] === "dug");
    const circ = (ds, dx, dy, fill) => ds.map((d) => `<circle cx="${(d[1] + dx).toFixed(3)}" cy="${(d[2] + dy).toFixed(3)}" r="${d[3]}" fill="${fill}"/>`).join("");
    const bank = dug.length ? `<mask id="nc-dug-far" maskUnits="userSpaceOnUse" ${box}><g filter="url(#nc-tsoft)">${circ(dug, 0, 0, "#fff")}${circ(dug, 0.22, 0.22, "#000")}</g></mask>
      <mask id="nc-dug-near" maskUnits="userSpaceOnUse" ${box}><g filter="url(#nc-tsoft)">${circ(dug, 0, 0, "#fff")}${circ(dug, -0.1, -0.1, "#000")}</g></mask>
      <rect ${box} fill="#2a1a0e" opacity="0.55" mask="url(#nc-dug-far)"/><rect ${box} fill="#d9b98a" opacity="0.4" mask="url(#nc-dug-near)"/>` : "";
    const ring = cur ? `<circle cx="${cur.x}" cy="${cur.y}" r="${cur.r}" fill="${cur.erase ? "rgba(140,200,90,.25)" : "rgba(255,255,255,.12)"}" stroke="#fff" stroke-width="0.035" stroke-dasharray="0.14 0.09"/>` : "";
    return `<defs>${pats}<filter id="nc-tsoft" x="-30%" y="-30%" width="160%" height="160%"><feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="2" seed="3" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="0.22" xChannelSelector="R" yChannelSelector="G" result="d"/><feGaussianBlur in="d" stdDeviation="0.06"/></filter></defs>${body}${bank}${ring}`;
  }
  function drawTerrain(v) {
    const g = document.getElementById("nc-terrain");
    if (!g) return;
    let list = v.terrain || [];
    const under = (d) => stroke.pts.some((q) => Math.hypot(d[1] - q[0], d[2] - q[1]) < stroke.r * 0.8 + d[3] * 0.3);
    if (stroke) list = stroke.t === "grass" ? list.filter((d) => !under(d)) : stroke.t === "level" ? list.filter((d) => !((d[0] === "dug" || (C.TERRAIN[d[0]] || {}).water) && under(d)))
      : list.concat(stroke.pts.map((q) => [stroke.t, q[0], q[1], stroke.r]));
    const cur = build && build.terrain && build.brush && brushAt ? { x: brushAt.x, y: brushAt.y, r: build.size || 1, erase: build.brush === "grass" || build.brush === "level" } : null;
    const key = list.length + ":" + (list.length ? list[list.length - 1].join() : "") + ":" + (stroke ? stroke.pts.length : "") + ":" + (cur ? [cur.x, cur.y, cur.r].join() : "");
    if (key === terrainKey) return;
    terrainKey = key;
    g.innerHTML = terrainSVG(list, cur);
  }

  function drawWorld(v) {
    v = peeked(v);
    BOX = camera(v);
    const world = $("nc-world");
    world.style.width = BOX.w + "px";
    world.style.height = BOX.h + "px";
    if (!$("nc-stage")) world.innerHTML = `<div class="nc-stage" id="nc-stage"><div class="nc-groundbox" id="nc-ground"></div><div class="nc-room" id="nc-room"></div></div>`;
    $("nc-stage").style.left = -BOX.x + "px";
    $("nc-stage").style.top = -BOX.y + "px";
    if (groundKey !== String(v.size)) { $("nc-ground").innerHTML = groundSVG(v); groundKey = String(v.size); terrainKey = ""; }
    drawTerrain(v);
    const out = [];
    // walls (V20): one painted panel on each back edge of the floor -- the left wall along column 0, the right wall
    // along row 0 -- placed by where the cutter measured the face's bottom corners (CafeArtMeta), so they join; the
    // door's panel takes the place of one left-wall panel and is the same size.
    // the café's wallpaper (N36): its panels and doors where painted, else the plaster
    // and a panel at a time (N43): v.walls["l<row>" / "r<column>"] over the café's own; in Build > Walls the panel under
    // the pointer shows the one you're laying
    const base = v.style && v.style.wall ? v.style.wall : "plaster";
    const papered = (id, wp) => { if (!wp || wp === "plaster") return id; const w = id.replace(/^(wall|door)-/, "$1-" + wp + "-"); return has(w) ? w : id; };
    const panel = (id0, ex, ey, key) => {
      const here = build && build.walls && build.paper && hoverW === key;
      const id = papered(id0, here ? build.paper : (v.walls || {})[key] || base);
      const m = META[id] || META[id0] || { yl: 1 }, s = sized(id, TW / 2 + 1);
      return `<img class="nc-wall${here ? " paint" : ""}" alt="" data-wall="${key}" src="${art(id)}" style="left:${ex - 0.5}px;top:${Math.round(ey - m.yl * s.h)}px;width:${s.w}px">`;
    };
    for (let r = v.size - 1; r >= 0; r--) { const p = at(v, 0, r); out.push(panel(r === v.door ? "door-l" : "wall-l", p.x - TW / 2, p.y + TH / 2, "l" + r)); }
    for (let c = 0; c < v.size; c++) { const p = at(v, c, 0); out.push(panel("wall-r", p.x, p.y, "r" + c)); }
    out.push(paintingsHTML(v));
    // the floor
    // floors, a tile at a time (2026-10-21); in the floor mode the tile under the pointer shows the one you're laying
    for (let r = 0; r < v.size; r++) for (let c = 0; c < (v.cafeW || v.size); c++) {        // (and the patio's, V24: decking to start)
      const p = at(v, c, r), here = build && build.paint && build.paint !== "grass" && hover && hover.x === c && hover.y === r;
      const fl = "floor-" + (here ? build.paint : (v.floors || {})[c + "," + r] || (c >= v.size ? "deck" : v.floor || "grey"));
      out.push(`<img class="nc-tile${here ? " paint" : ""}" alt="" data-x="${c}" data-y="${r}" src="${art(has(fl) ? fl : "floor-grey")}" style="left:${p.x - TW / 2}px;top:${p.y}px;width:${TW}px;height:${Math.round(TH * 1.13)}px;z-index:${3}">`);
    }
    // the things on it (each one's markup kept, so a number changing swaps just that thing -- patchThings)
    lastThing.clear();
    v.items.forEach((it) => {
      if (build && build.move === it.uid) return;
      const h = thingHTML(v, it);
      lastThing.set(it.uid, h);
      out.push(h);
    });
    const hw = hwallsHTML(v);                                               // (2026-11-08) the half walls, on the lines between tiles
    out.push(hw.room);
    // a ghost where the thing you're placing would go
    if (build && (build.place || build.move) && hover) {
      const kind = build.place || (v.items.find((i) => i.uid === build.move) || {}).kind;
      const dir = heldDir(v), why = ghostWhy(v, kind, dir);
      const g = thingHTML(v, { uid: 0, kind, x: hover.x, y: hover.y, dir, scale: build.place ? build.scale | 0 : (v.items.find((i) => i.uid === build.move) || {}).scale | 0 }, why ? "ghost bad" : "ghost");
      out.push(why ? g.replace(/<\/button>\s*$/, `<span class="nc-why">${esc(why)}</span></button>`) : g);   // N49 i5: why not, before the click
    }
    if (build && (build.place || build.move)) out.push(walkHTML(v));      // N49 i6: the customers' walks
    out.push(ceilHTML(v), switchHTML(v));                                   // (2026-10-24) the ceiling's lights and their switch
    const st = streetThings(v);
    out.push(`<div class="nc-out" id="nc-out">${st.back}${hw.back}</div>${st.front}${patioHTML(v)}<div class="nc-people" id="nc-people"></div>${skyHTML(v)}${selHTML(v)}`);
    $("nc-room").innerHTML = out.join("");
    fit();
    wireWorld(v);
    people(v);
  }
  /** The patio's side wall and its side door, a wooden frame in the café's front edge (its railings, along its back, are
      half walls since 2026-11-08). */
  // the patio doorway (Cam, 25 Oct: "the frame so it is level with the ground ... the half wall has to end flush against
  // the door frame"): a wooden frame drawn on the floor's own geometry -- two posts as deep as the brick wall, standing
  // on the café's front edge across the door tile, and a lintel. Posts' spans along the edge (tile fractions), its
  // height and the lintel's (in tile widths), and its colours
  const DOOR = { posts: [[0.14, 0.24], [0.76, 0.86]], high: 0.72, lintel: 0.07, wood: { front: "#a4532f", end: "#7c3a1f", top: "#c8774a", line: "#4a1d10" } };
  function patioHTML(v) {
    const P = v.patio;
    if (!P) return "";
    const out = [];                       // (its railings along the back are half walls since 2026-11-08: hwallsHTML)
    // the side wall (Cam, 25 Oct: "use the low brick wall divider instead now without transparency"): the low brick
    // wall's pieces (halfbrick-r, run along the café's front edge like a divider's: its front edge a tile long, centred
    // on the edge) -- and in it the doorway: the door's wooden frame, full height, the bricks either side running up to
    // its posts ("the door frame can be embedded in the brick divider")
    const bid = "halfbrick-r", brun = META[bid] && META[bid].run, wt = { kind: "halfbrick", tint: P.tint, tint2: P.tint2 };
    const T = brun ? (brun[2] - brun[0]) / (brun[4] - brun[2]) : 0.194;          // the wall's thickness, in tiles
    for (let r = 0; r < v.size; r++) {
      // (Cam, 25 Oct: "a person sitting on the other side clips through") -- someone sat on the café's edge tiles is drawn
      // at their tile's depth + 7: the wall goes just over them (+8) and the door frame over that, still under anything
      // on the patio's own tiles (+10)
      const z = 10 + Math.round((v.size - 1 + r) * 10) + 8, door = r === P.door;
      // (the pieces: tools/make_cafe_brickrun.py -- the painting's plain middle repeated, its own ends at the two ends)
      const pid = v.size === 1 ? bid : r === v.size - 1 ? "brickrun-r-near" : r === 0 ? "brickrun-r-far" : "brickrun-r", pic = has(pid) ? pid : bid;
      if (brun && ART[bid]) {
        const [lx, , bx, , rx, ry] = brun, edge = rx - bx, w = Math.round(TW / 2 / edge), h = Math.round(w * ART[bid][1] / ART[bid][0]);
        const q = at(v, v.size + T / 2, r), bl = Math.round(q.x - rx * w), bt = Math.round(q.y - ry * h);
        const pos = `left:${bl}px;top:${bt}px;width:${w}px;height:${h}px;z-index:${z}`;
        // (Cam, 25 Oct: "the brick wall is not consistent all the way") -- each piece has its own end caps and its
        // coping overhangs them, so side by side they stepped: every piece is cut straight down at its tile's ends (a
        // hair over) so the pieces run on as one wall; only the wall's two outer ends keep their caps. The cut is a
        // band along the wall's slope (all of the wall inside it: measured off the brickrun pictures), so it's also
        // what a right-click finds -- its paints, like a low brick wall's (Cam: "edit swatches for the half wall").
        // By the door the bricks end square across the wall (along x, through the post's face), flush with the post.
        const kb = -0.4276 * h / w, edgeAt = (y0, end) => {          // where the band's line (y0: its top 0.4 / bottom 1.02) meets an end
          if (end.x != null) return [end.x, h * y0 + kb * end.x];
          const ex = (end.p.y - 0.5 * end.p.x - h * y0) / (kb - 0.5); return [ex, h * y0 + kb * ex];
        };
        const vert = (sx) => ({ x: Math.max(0, Math.min(w, sx - bl)) });
        const pt = ([x, y]) => `${(x / w * 100).toFixed(2)}% ${(y / h * 100).toFixed(2)}%`;
        const fab = (has(pic + "-fab") ? fabTag(art(pic + "-fab"), wt.tint, matOf("halfbrick")) : "") + (has(pic + "-fab2") ? fabTag(art(pic + "-fab2"), wt.tint2, matOf("halfbrick", 2), false, true) : "");
        const piece = (pts, zz) => `<div class="nc-pwall${build ? "" : " hit"}" style="${pos.replace(/z-index:\d+/, "z-index:" + zz)};clip-path:polygon(${pts.map(pt).join(", ")})"><img alt="" src="${art(pic)}" draggable="false">${fab}</div>`;
        const L0 = r === v.size - 1 ? { x: 0 } : vert(at(v, v.size, r + 1).x - 0.5), R0 = r === 0 ? { x: w } : vert(at(v, v.size, r).x + 0.5);
        if (!door) out.push(piece([edgeAt(0.4, L0), edgeAt(0.4, R0), edgeAt(1.02, R0), edgeAt(1.02, L0)], z));
        else {
          // by the door the bricks end flush with the posts. The far bricks are behind the far post: cut generously (up
          // to the post's left edge, and above the ground line along its near face) and the post drawn over them. The
          // near bricks are in front of the near post: drawn over it, cut exactly to the end of a wall at the post's
          // near face -- that end's top edge and its front corner, so the post shows above the wall and beside it.
          const [pf, pn] = DOOR.posts.map(([a2, b2]) => [r + a2, r + b2]), x0 = v.size - T / 2, x1 = v.size + T / 2;
          const gp = (x, y) => { const g0 = at(v, x, y); return { x: g0.x - bl, y: g0.y - bt }; };
          const XL = gp(x0 - 0.01, pf[1]).x, P = gp(v.size, pf[1]), onP = (x) => [x, P.y + 0.5 * (x - P.x)];
          out.push(piece([edgeAt(0.4, { x: XL }), edgeAt(0.4, R0), edgeAt(1.02, R0), edgeAt(1.02, { p: P }), onP(XL)], z));
          const D = edgeAt(0.4, { x: gp(x0, pn[1]).x }), C = [D[0] + T * TW / 2, D[1] + T * TH / 2];
          out.push(piece([edgeAt(0.4, L0), D, C, edgeAt(1.02, { x: C[0] }), edgeAt(1.02, L0)], z + 2));
        }
      }
      if (door) out.push(doorFrame(v, r, T, z + 1));
    }
    return out.join("");
  }
  /** The patio door's frame (DOOR): boxes on the floor's own geometry -- each face a polygon, the far post, the near post,
      then the lintel (the near bricks are drawn over the near post's foot, as they stand in front of it). */
  function doorFrame(v, r, T, z) {
    const H = DOOR.high * TW, LT = DOOR.lintel * TW, x0 = v.size - T / 2 - 0.01, x1 = v.size + T / 2 + 0.01, W = DOOR.wood;
    const g = (x, y, up) => { const p = at(v, x, y); return `${p.x.toFixed(1)},${(p.y - up).toFixed(1)}`; };
    const face = (pts, fill) => `<polygon points="${pts.join(" ")}" fill="${fill}" stroke="${W.line}" stroke-width="1.2" stroke-linejoin="round"/>`;
    const box = (ya, yb, z0, z1, endFrom) => face([g(x0, yb, endFrom), g(x1, yb, endFrom), g(x1, yb, z1), g(x0, yb, z1)], W.end)          // its end, facing down-left
      + face([g(x1, ya, z0), g(x1, yb, z0), g(x1, yb, z1), g(x1, ya, z1)], W.front)                                                    // its face, towards the patio
      + face([g(x0, ya, z1), g(x1, ya, z1), g(x1, yb, z1), g(x0, yb, z1)], W.top);                                                     // its top
    const [pf, pn] = DOOR.posts.map(([a, b]) => [r + a, r + b]);
    return `<svg class="nc-pframe" aria-hidden="true" style="z-index:${z}">${box(pf[0], pf[1], 0, H, 0)}${box(pn[0], pn[1], 0, H, 0)}${box(pf[0], pn[1], H, H + LT, H)}</svg>`;
  }
  /** Build > Select's box on the ground: the one being drawn, or the chosen one where the drag would take it (red: it
      can't go there). */
  function selShown() {
    if (selDrag && selDrag.kind === "box" && selDrag.b) return { b: selDrag.b };
    if (!sel) return null;
    const d = selDrag && selDrag.kind === "drag" ? selDrag : { dx: 0, dy: 0 }, b = sel.box;
    return { b: { x0: b.x0 + d.dx, x1: b.x1 + d.dx, y0: b.y0 + d.dy, y1: b.y1 + d.dy }, bad: !!d.bad, copy: sel.mode === "copy" && !!(d.dx || d.dy), r: d.r };
  }
  function selHTML(v) {
    const sh = build && build.select && selShown();
    if (!sh) return "";
    const b = sh.b, pts = [[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]].map(([c, r]) => { const p = at(v, c, r); return `${Math.round(p.x)},${Math.round(p.y)}`; }).join(" ");
    // (2026-10-25, Cam: "ensure i cant duplicate anything without the game displaying the price"): a copy's price on it as
    // it's dragged, under the box's front corner
    const low = at(v, b.x1, b.y1), tag = sh.copy && sh.r ? `<span class="nc-selcost" style="left:${Math.round(low.x)}px;top:${Math.round(low.y + 8)}px">${sh.r.cost ? `${COIN}${num(sh.r.cost)}` : "Free"}</span>` : "";
    return `<svg class="nc-selbox${sh.bad ? " bad" : ""}${sh.copy ? " copy" : ""}" aria-hidden="true"><polygon points="${pts}"/></svg>${tag}`;
  }
  /** The chosen box's move or copy tried, not kept: the café as it would be (peek), or why it can't. */
  function selTry() {
    const d = selDrag;
    if (!d.dx && !d.dy) { d.bad = ""; d.r = null; peek = null; return; }
    const r = C.act(state, "area", Object.assign({ op: sel.mode, dx: d.dx, dy: d.dy, free: freePlace }, sel.box), now());
    d.r = r.ok ? r : null; d.bad = r.ok ? "" : r.error;
    peek = r.ok ? { area: C.view(r.state, now()) } : null;
  }
  /** N40: only numbers changed (a counter's servings, the till, a tip, the vending takings): swap just the things whose
      markup changed instead of rebuilding the whole café -- every rebuild left a few hundred old elements for the garbage
      collector, which in NeuroCafe's window runs rarely, so memory climbed past a gigabyte. False: needs a full draw. */
  function patchThings(v) {
    v = peeked(v);
    const room = $("nc-room");
    if (!room) return false;
    for (const it of v.items) {
      if (build && build.move === it.uid) continue;
      const h = thingHTML(v, it);
      if (h === lastThing.get(it.uid)) continue;
      const el = room.querySelector(`.nc-thing[data-uid="${it.uid}"]:not(.ghost)`);
      if (!el) return false;
      const tp = document.createElement("template");
      tp.innerHTML = h.trim();
      const nu = tp.content.firstElementChild;
      nu.addEventListener("click", (e) => { e.stopPropagation(); clickThing(it.uid); });
      el.replaceWith(nu);
      lastThing.set(it.uid, h);
    }
    return true;
  }
  // ---- paintings on the walls (V22 q3, Sheet 14): each painted into a slanted frame on a left-wall panel
  // (make_cafe_templates.PAINTING says where on the face), so it's placed by that frame's box on its own panel; on the
  // right wall it's mirrored until the right-facing ones are painted (<pic>-r)
  const FRAME = { x0: 0.22, x1: 0.78, y0: 0.42, y1: 0.82 };
  function frameBox(v, key) {
    const side = key[0], i = +key.slice(1), ws = sized("wall-l", TW / 2 + 1), up = ((META["wall-l"] || {}).yr || 0.78) * ws.h;
    const A = side === "l" ? at(v, 0, i + 1) : at(v, i + 1, 0), B = side === "l" ? at(v, 0, i) : at(v, i, 0);  // its front end, its back end
    const P = (fx, fy) => ({ x: A.x + (B.x - A.x) * fx, y: A.y + (B.y - A.y) * fx - up * fy });
    const pts = [P(FRAME.x0, FRAME.y0), P(FRAME.x1, FRAME.y0), P(FRAME.x1, FRAME.y1), P(FRAME.x0, FRAME.y1)];
    const xs = pts.map((q) => q.x), ys = pts.map((q) => q.y);
    return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys), right: side === "r" };
  }
  /** A wall weapon's box (2026-10-24): a flat picture, so a plain upright box the size of the middle of the panel,
      tilted onto the wall by CSS (flat-l / flat-r) -- skewed about its middle, its sides stay upright like the wall's. */
  function weaponBox(v, key) {
    const side = key[0], i = +key.slice(1), ws = sized("wall-l", TW / 2 + 1), up = ((META["wall-l"] || {}).yr || 0.78) * ws.h;
    const A = side === "l" ? at(v, 0, i + 1) : at(v, i + 1, 0), B = side === "l" ? at(v, 0, i) : at(v, i, 0);
    const w = Math.abs(B.x - A.x) * 0.8, h = up * 0.5, cx = (A.x + B.x) / 2, cy = (A.y + B.y) / 2 - up * 0.52;
    return { x: cx - w / 2, y: cy - h / 2, w, h, right: side === "r" };
  }
  /** A wall thing's box (N48): windows, curtains, clocks, wall things and weapon mounts are cut to the wall's slope
      with their 3D edge (the cutter's wall_slant), so each is a plain box: so much of the panel's width, its height by
      the picture's own shape, standing a little above the panel's middle. */
  const HANG_W = { window: 0.84, curtain: 0.9, blind: 0.86, clock: 0.6, wall: 0.62, mount: 0.8, vmount: 0.5, sconce: 0.42 };   // (vmount: a portrait frame)
  // where a wall light's bulb or flame is in its picture (left wall; mirrored on the right), for its glow
  const BULB_AT = { "sconce-1": [0.77, 0.37], "sconce-2": [0.62, 0.35], "sconce-3": [0.65, 0.60], "sconce-4": [0.63, 0.48], "sconce-5": [0.79, 0.53] };   // (2026-10-25: measured off N61's painted lights -- the brightest part)
  function windowBox(v, key, pic, group) {
    const side = key[0], i = +key.slice(1), ws = sized("wall-l", TW / 2 + 1), up = ((META["wall-l"] || {}).yr || 0.78) * ws.h;
    const A = side === "l" ? at(v, 0, i + 1) : at(v, i + 1, 0), B = side === "l" ? at(v, 0, i) : at(v, i, 0);
    const s = sized(pic, Math.abs(B.x - A.x) * (HANG_W[group] || 0.84)), cx = (A.x + B.x) / 2, cy = (A.y + B.y) / 2 - up * 0.56;
    return { x: cx - s.w / 2, y: cy - s.h / 2, w: s.w, h: s.h, right: side === "r" };
  }
  /** Your photos (2026-10-24): id -> its data address, from cafe.py when the game opens. */
  let PHOTOS = {};
  /** V25 q5: your decks' Major Arcana, from NeuroNet's card library (neurocafe.py cafe_cards): deck -> card -> data address.
      A deck that isn't on this computer shows a card back. */
  let CARDS = {};
  const cardSrc = (deck, name) => ((CARDS[deck] || {})[name || "The Fool"]) || "cafe/art/ui/card-back.webp";
  function paintingHTML(v, key, id, cls, photo) {
    const P = C.PAINTING[id];
    // (2026-10-24: a wall light, on or off -- a click outside Build switches it)
    const lightOff = P.light && !/ghost/.test(cls || "") && (v.hangOff || {})[key], lightLit = P.light && !lightOff && skyNow(v).dark;
    if (P.light) cls = (cls ? cls + " " : "") + "light" + (lightOff ? " off" : " on") + (lightLit ? " lit" : "");
    const mount = P.mount && has(P.mount) ? P.mount : P.photo && has(P.pic) ? P.pic : "";
    // (the fire kit stands off the wall like the clocks (N48 a4): its picture slanted and given depth, <pic>-w and -w-r)
    const wkit = P.kit && has(P.pic + "-w") ? P.pic + "-w" : "";
    const b = mount ? windowBox(v, key, mount, P.portrait ? "vmount" : "mount") : wkit ? windowBox(v, key, wkit, "clock") : P.weapon ? weaponBox(v, key) : P.group ? windowBox(v, key, P.pic, P.group) : frameBox(v, key);
    const rid = (wkit || P.pic) + "-r", own = b.right && has(rid);
    const flat = (P.kit && !wkit) || P.weapon ? (b.right ? " flat-r" : " flat-l") + (P.weapon ? " weapon" : "") : "";   // (the weapons are drawn flat)
    const tip = P.kit && v.kit ? `${P.name}: ${v.kit.left} of ${v.kit.saves} saves left today` : P.light && !build ? `${P.name}${lightOff ? " (off) -- click to switch it on" : " -- click to switch it off"}` : P.name;
    const img = (src, x, y, w, h, c, more) => `<img class="nc-art${c}${P.photo || P.framed ? " frame" : ""}${cls ? " " + cls : ""}" alt="${esc(P.name)}" title="${esc(tip)}" data-hang="${key}" data-wall="${key}" src="${src}"
      style="left:${Math.round(x)}px;top:${Math.round(y)}px;width:${Math.round(w)}px;height:${Math.round(h)}px${more || ""}">`;
    // PT56: a photo frame's paint -- the wood swatches' colour turn on the whole frame (the photo sits over its middle)
    const ft = P.photo && (v.hangTint || {})[key], fstyle = ft ? `;filter:${tintCSS(ft, "wood")} drop-shadow(0 1px 0 rgba(30,14,6,.45)) drop-shadow(3px 5px 4px rgba(30,14,6,.38))` : "";
    if (mount) {
      // N51: the weapon set on its mount's front face -- the face is the picture less its 3D edge (a fifteenth of the
      // width, up-left of the face) and the slope's rise (half its width)
      const d = b.w * 0.06, fw = b.w - d, fh = b.h - d / 2 - fw / 2, cx = b.right ? b.x + fw / 2 : b.x + d + fw / 2, cy = b.y + d / 2 + (b.h - d / 2) / 2;
      const ww = fw * 0.8, wh = Math.max(fh * 1.05, fw * 0.75);   // (a bow on the plank's hooks stands taller than the plank)
      return img(art(b.right ? (has(mount + "-r") ? mount + "-r" : mount) : mount), b.x, b.y, b.w, b.h, b.right && !has(mount + "-r") ? " flip" : "", fstyle)
        + (P.card && !(photo || (v.hangPhoto || {})[key]) ? (() => { const ch = Math.min(fh * 0.84, fw * 0.74 * 1.7), cw = ch / 1.7; return img(cardSrc(P.card, (v.hangCard || {})[key]), cx - cw / 2, cy - ch / 2, cw, ch, (b.right ? " flat-r" : " flat-l") + " photo"); })()
          : P.card ? (() => { const ch = Math.min(fh * 0.84, fw * 0.74 * 1.7), cw = ch / 1.7; return img(PHOTOS[photo || (v.hangPhoto || {})[key]] || "cafe/art/ui/aunty-page.webp", cx - cw / 2, cy - ch / 2, cw, ch, (b.right ? " flat-r" : " flat-l") + " photo"); })()   // (2026-10-26: your photo in an event's tarot frame, where the card goes)
          : P.photo ? img(PHOTOS[photo || (v.hangPhoto || {})[key]] || "cafe/art/ui/aunty-page.webp", cx - fw * 0.36, cy - fh * 0.42, fw * 0.72, fh * 0.84, (b.right ? " flat-r" : " flat-l") + " photo" + (P.round ? " round" : ""))
          : img(art(has(P.pic.replace("wpn-", "wpnb-")) ? P.pic.replace("wpn-", "wpnb-") : P.pic), cx - ww / 2, cy - wh / 2, ww, wh, flat + " onmount"));
    }
    const fl = (b.right && !own && !P.kit && !P.weapon ? " flip" : "") + flat;
    // (PT56: a painting's frame in its paint -- the frame's ring, tinted, over the picture)
    const pt = P.framed && (v.hangTint || {})[key] && has(P.pic + "-fab") ? v.hangTint[key] : null;
    const ba = P.light && BULB_AT[P.pic], glow = lightLit && ba && !/ghost/.test(cls) ? `<span class="nc-wallglow" style="left:${Math.round(b.x + b.w * (b.right ? 1 - ba[0] : ba[0]))}px;top:${Math.round(b.y + b.h * ba[1])}px"></span>` : "";
    // (Cam, 2026-10-24: a window's view dark after dark -- <pic>-night, tools/make_cafe_night_windows.py)
    const pid = own ? rid : wkit || P.pic, nid = pid + "-night", shown = skyNow(v).dark && has(nid) ? nid : pid;
    return img(art(shown), b.x, b.y, b.w, b.h, fl) + (pt ? img(art(P.pic + "-fab"), b.x, b.y, b.w, b.h, fl + " fab", `;filter:${tintCSS(pt, "wood")}`) : "") + glow;
  }
  function paintingsHTML(v) {
    const hang = v.hang || {}, out = [];
    Object.keys(hang).forEach((k) => { if (!(build && build.moveHang === k)) out.push(paintingHTML(v, k, hang[k], build && build.pickHang === k ? "picked" : "")); });
    // hanging or moving one: a ghost on the panel under the pointer
    const id = build && (build.hang || (build.moveHang && hang[build.moveHang]));
    if (id && hoverW && !(hang[hoverW] && hoverW !== build.moveHang)) out.push(paintingHTML(v, hoverW, id, hoverW[0] === "l" && +hoverW.slice(1) === v.door ? "ghost bad" : "ghost", build.photo || (v.hangPhoto || {})[build.moveHang]));
    // (Cam, 25 Oct: "light encroaching on the outside" -- a wall light by the wall's end glowed out over the pavement):
    // the wall lights' glows go in one layer cut to the café's floor and walls
    const glows = [], html = out.join("").replace(/<span class="nc-wallglow"[^>]*><\/span>/g, (g) => { glows.push(g); return ""; });
    if (!glows.length) return html;
    const z = v.size, up = Math.round(wallUp()) + 2, pt = (c, r, lift) => { const p = at(v, c, r); return `${Math.round(p.x)}px ${Math.round(p.y - (lift || 0))}px`; };
    const ring = [pt(0, z), pt(0, z, up), pt(0, 0, up), pt(z, 0, up), pt(z, 0), pt(z, z)].join(",");
    return html + `<div class="nc-glowclip" style="clip-path:polygon(${ring})">${glows.join("")}</div>`;
  }
  /** Why the thing in your hand can't go under the pointer ("" when it can). */
  function ghostWhy(v, kind, dir) {
    if (!hover) return "Point at a tile.";
    const rest = state.items.filter((i) => !(build.move && i.uid === build.move)), it = { uid: -1, kind, x: hover.x, y: hover.y, dir };
    return C.fitProblem(state, it, rest) || C.layoutProblem(state, rest.concat([it]));
  }
  function ghostOK(v, kind, dir) { return !ghostWhy(v, kind, dir); }
  /** N49 i6: while you hold something, the walks from the door to every counter and the till, faint on the floor --
      red where the thing in your hand would stand on one. */
  function walkHTML(v) {
    const rest = state.items.filter((i) => !(build.move && i.uid === build.move)), e = C.entry(state), on = new Map();
    rest.filter((o) => o.kind === "till" || C.COUNTERS.includes(o.kind)).forEach((o) => {
      const to = C.spotFor(state, o, rest), p = to && C.path(state, e, to, rest);
      (p || []).forEach((t) => on.set(t.x + "," + t.y, t));
    });
    const kind = build.place || (state.items.find((i) => i.uid === build.move) || {}).kind;
    const held = hover && kind ? C.cells({ kind, x: hover.x, y: hover.y, dir: heldDir(v) }) : [];
    return [...on.values()].map((t) => {
      const p = at(v, t.x, t.y), bad = held.some((c) => c.x === t.x && c.y === t.y);
      return `<span class="nc-walk${bad ? " bad" : ""}" style="left:${p.x - TW / 2}px;top:${p.y}px;width:${TW}px;height:${TH}px"></span>`;
    }).join("");
  }
  /** N49 i12: the café with the card under the pointer tried in place (a floor, a wallpaper, a counter style, a painting). */
  function peeked(v) {
    if (!peek) return v;
    if (peek.area) return peek.area;                         // (Build > Select: the move or copy as it would be)
    if (peek.floor) return Object.assign({}, v, { floor: peek.floor, floors: {} });
    if (peek.wall) return Object.assign({}, v, { style: Object.assign({}, v.style, { wall: peek.wall }), walls: {} });
    if (peek.hang) {
      const hang = v.hang || {}, keys = [];
      for (let r = 0; r < v.size; r++) if (r !== v.door) keys.push("l" + r);
      for (let c = 0; c < v.size; c++) keys.push("r" + c);
      const free = keys.find((k) => !hang[k]);
      return free ? Object.assign({}, v, { hang: Object.assign({}, hang, { [free]: peek.hang }) }) : v;
    }
    return v;
  }
  /** A dish on the stove: its cooking or burnt picture -- or, for a dish not painted that way yet (NeuroPets' dishes, N47),
      its served picture, darkened when burnt. */
  // (Cam, 25 Oct: "milkshakes need to be scaled down on the servery and when the customers pick them up they are huge"):
  // dishes are drawn by width, so a tall picture (a shake in its glass, 106 x 200) came out twice a plate's height --
  // a tall one is drawn narrower, as tall as a plate of the same width would be
  // (Cam, 25 Oct: "make all recipes that have not been unlocked ... be a question mark ... objects in build and buy catalogues
  // as well ... an element of surprise"): what you can't have yet is a question mark -- its level or price still said
  const QM = `<span class="nc-qmark">?</span>`, QM_BIG = `<span class="nc-qmark big">?</span>`;
  /** A drawer's cards: every locked one shows a question mark for its picture and "???" for its name (not the café's
      sizes -- those are marked nc-noq). */
  const mysteryCards = (html) => html.replace(/(<div class="nc-card(?![^"]*nc-noq)[^"]*\blocked\b[^"]*">\s*)<img[^>]*>(\s*)<b>[^<]*<\/b>/g, `$1${QM}$2<b>???</b>`);
  const tallK = (pic) => { const a = ART[pic]; return a ? Math.min(1, (a[0] / a[1]) * 1.05) : 1; };
  const dishK = (id) => tallK("dish-" + id);
  const pan = (how, id) => has(`${how}-${id}`) ? `<img class="nc-pan" alt="" src="${art(`${how}-${id}`)}" style="width:${Math.round(52 * tallK(`${how}-${id}`))}%">`
    : `<img class="nc-pan standin ${how}" alt="" src="${art("dish-" + id)}" style="width:${Math.round(52 * dishK(id))}%">`;
  // ---- swatches (2026-10-24, the sandbox first): a thing's fabric (<pic>-fab, tools/make_cafe_fabric.py) drawn over it,
  // its colour shifted by the thing's tint -- a hue turn, saturation, brightness
  // black iron has no colour to turn: it's tinted first (sepia), then turned. White paint can't be turned to a true
  // colour that way, so it's PAINTED instead: its fabric is a mask over a colour multiplied onto it (the shading stays) --
  // there h is the hue, s the vividness (x20%) and b the lightness (x80%) (2026-10-24)
  const SEPIA = { dark: 1 }, PAINT = { light: 1, white: 1 };
  const matOf = (kind, part) => (C.THINGS[kind] && C.THINGS[kind][part === 2 ? "tint2" : "tint"]) || "";
  // PT56: a two-tone thing's second part (the half wall's top rail...) -- which part the sliders mix
  let swPart = 1;
  const tintCSS = (t, mat) => `${SEPIA[mat] ? "sepia(1) " : ""}hue-rotate(${t.h}deg) saturate(${t.s}) brightness(${t.b})`;
  // (a named swatch lays its own colour, exactly; the mixer's colour is worked out from the sliders)
  const paintCSS = (t, mat) => { const w = t.sw && (SWATCH_SETS[mat] || []).find((x) => x[0] === t.sw && x[2] === t.h && x[3] === t.s && x[4] === t.b); return w ? w[1] : paintHSL(t); };
  const paintHSL = (t) => `hsl(${t.h}, ${Math.min(100, Math.round(t.s * 20))}%, ${Math.min(97, Math.round(t.b * 80))}%)`;
  /** Put a colour on a fabric layer (an img with a filter, or a painted mask). */
  function tintEl(el, t, mat) { if (PAINT[mat]) el.style.backgroundColor = t ? paintCSS(t, mat) : "transparent"; else el.style.filter = t ? tintCSS(t, mat) : ""; }
  function fabTag(src, t, mat, flip, two) {
    if (PAINT[mat]) return `<span class="nc-fab paint${flip ? " flip" : ""}${two ? " two" : ""}" style="-webkit-mask-image:url('${src}');mask-image:url('${src}');background-color:${t ? paintCSS(t, mat) : "transparent"}"></span>`;
    return `<img class="nc-fab${flip ? " flip" : ""}${two ? " two" : ""}" alt="" src="${src}"${t ? ` style="filter:${tintCSS(t, mat)}"` : ""}>`;
  }
  function fabHTML(it, f) {
    const mat = matOf(it.kind), mat2 = matOf(it.kind, 2);
    if (!mat || it.cstyle || !has(f.id + "-fab")) return "";
    return fabTag(art(f.id + "-fab"), it.tint, mat, f.flip) + (mat2 && has(f.id + "-fab2") ? fabTag(art(f.id + "-fab2"), it.tint2, mat2, f.flip, true) : "");
  }
  // the swatches, a set for each material: [name, the dot's colour, h, s, b] -- {0, 1, 1} is as painted. Picked from
  // sheets of each material turned every 15-30 degrees (CSS's hue turn isn't a true one). The same name means the same
  // colour on every material: owning a paint gives it on all of them.
  const NATURAL = (dot) => ["Natural", dot, 0, 1, 1];
  const WOOD_FINISH = [["Pale", "#e2b98a", 0, 0.55, 1.3], ["Walnut", "#6b3f22", 0, 0.9, 0.65], ["Ebony", "#3a2a22", 0, 0.3, 0.42], ["White wash", "#efe6d8", 0, 0.12, 1.6]];
  const WARM_PAINTS = (k) => [["Red", "#b8443a", 340, 1.5 * k, 0.9], ["Rose", "#d880a0", 300, 1 * k, 1.1], ["Plum", "#8a5a9a", 265, 0.9 * k, 0.85], ["Blue", "#4f8fb0", 200, 1.1 * k, 0.95],
    ["Teal", "#2fb0a0", 150, 1.1 * k, 0.95], ["Emerald", "#3caa5a", 115, 1.2 * k, 0.9], ["Sage", "#7f9f78", 80, 0.55 * k, 1.05], ["Mustard", "#c9a23a", 18, 1.4 * k, 1.05],
    ["Charcoal", "#4a4a52", 0, 0.12, 0.5], ["Cream", "#e6d8b8", 0, 0.3, 1.5]];
  // a set for a coloured part whose own hue is `base`: each colour turned to from there (none too near its own)
  const TURNED = (base, dot) => [NATURAL(dot)].concat([["Red", "#c0302a", 2, 1.1, 0.9], ["Rose", "#d87090", 340, 0.9, 1.05], ["Plum", "#8a5a9a", 285, 0.8, 0.85],
    ["Blue", "#3a6ab0", 216, 1, 0.95], ["Sky", "#8ac8e8", 200, 0.7, 1.15], ["Teal", "#2a9a90", 175, 1, 0.9], ["Mint", "#8fd8b0", 145, 0.8, 1.1],
    ["Emerald", "#2f9a5a", 140, 1.2, 0.85], ["Sage", "#8fae7a", 96, 0.5, 0.95], ["Mustard", "#c9a23a", 43, 1.2, 1.05], ["Terracotta", "#c8603a", 16, 1, 0.9],
    ["Charcoal", "#4a4a52", 0, 0.1, 0.5], ["Cream", "#e6d8b8", 0, 0.25, 1.3]]
    .filter((x) => x[3] < 0.3 || Math.min(Math.abs(x[2] - base), 360 - Math.abs(x[2] - base)) > 14)
    .map((x) => x[3] < 0.3 ? x : [x[0], x[1], (x[2] - base + 360) % 360, x[3], x[4]]));
  const SWATCH_SETS = {
    blue: [["Blue", "#4f8fb0", 0, 1, 1], ["Teal", "#2fb0a0", 330, 1.5, 1.1], ["Emerald", "#3caa5a", 285, 1.5, 1], ["Sage", "#7f9f78", 270, 0.75, 1.05],
           ["Mustard", "#c9a23a", 210, 1.5, 1.1], ["Terracotta", "#c8704a", 190, 1.3, 1], ["Red", "#b8443a", 160, 1.8, 0.9], ["Rose", "#d880a0", 135, 1, 1.15],
           ["Plum", "#8a5a9a", 90, 1, 0.9], ["Charcoal", "#4a4a52", 0, 0.15, 0.6], ["Cream", "#e6d8b8", 205, 0.35, 1.5]],
    leather: [NATURAL("#c8743a"), ["Terracotta", "#c8704a", 350, 1.1, 0.95]].concat(WOOD_FINISH.slice(0, 3), WARM_PAINTS(1)),
    wood: [NATURAL("#a8612e")].concat(WOOD_FINISH, WARM_PAINTS(1)),
    darkwood: [NATURAL("#5a3420"), ["Pale", "#c89a6a", 0, 0.6, 1.9], ["Walnut", "#6b3f22", 0, 1, 1.25], ["Ebony", "#2a201c", 0, 0.3, 0.7], ["White wash", "#efe6d8", 0, 0.1, 2.8]]
      .concat(WARM_PAINTS(1.3).map((x) => [x[0], x[1], x[2], x[3], Math.min(3.5, x[4] * 1.4)])),
    pot: [NATURAL("#c0623a")].concat(WARM_PAINTS(1).map((x) => x[0] === "Mustard" ? ["Mustard", x[1], 35, 1.3, 1.05] : x)),
    shade: [NATURAL("#f2c98a")].concat(WARM_PAINTS(1.8).map((x) => x[0] === "Red" ? ["Red", x[1], 330, 3.5, 0.75] : x)),
    linen: [NATURAL("#efe3c8")].concat(WARM_PAINTS(2.4).map((x) => x[0] === "Red" ? ["Red", x[1], 330, 4.5, 0.75] : x)),   // (the pouf: paler, so more colour)
    light: [NATURAL("#f2efe8"), ["Cream", "#f2e2a8", 45, 3.5, 1.1], ["Mustard", "#e8c450", 45, 4, 0.85], ["Sage", "#b8d8a8", 100, 1.5, 1], ["Emerald", "#78c890", 140, 2.5, 0.85],
            ["Teal", "#a8e0d8", 170, 2.5, 1], ["Blue", "#a8c8f0", 210, 3.5, 1], ["Plum", "#c8b0e0", 270, 2, 0.95], ["Rose", "#f0b8c8", 340, 3.5, 1.02],
            ["Terracotta", "#f0b898", 18, 3.5, 0.95], ["Red", "#d86058", 2, 3.5, 0.75], ["Charcoal", "#5a5a60", 0, 0.2, 0.5]],
    // PT56 (Cam: "the paint still doesn't cover the whole object"): the painted dividers take real paint, full strength
    // -- the pale "light" set above is for marble and garden whites. [name, the colour laid, its h/s/b for the mixer]
    white: [NATURAL("#f2efe8"), ["Cream", "#efe0b0", 46, 3.32, 1.02], ["Mustard", "#d9a520", 43, 3.71, 0.61], ["Sage", "#8fae7a", 96, 1.21, 0.73], ["Emerald", "#2f9a5a", 144, 2.66, 0.49],
            ["Teal", "#2a9a90", 175, 2.86, 0.48], ["Blue", "#3a6ab0", 216, 2.52, 0.57], ["Plum", "#7a4a8a", 285, 1.51, 0.52], ["Rose", "#d87090", 342, 2.86, 0.8],
            ["Terracotta", "#c8603a", 16, 2.82, 0.63], ["Red", "#c0302a", 2, 3.21, 0.57], ["Charcoal", "#38383e", 240, 0.25, 0.3], ["Ebony", "#1e1a1a", 0, 0.36, 0.3]],
    // PT56 (Cam: the cash register's two tones): its brass -- the metals, then the paints
    brass: [NATURAL("#c8913a"), ["Gold", "#e8c050", 12, 1.35, 1.25], ["Silver", "#c8c8cc", 0, 0.05, 1.35], ["Copper", "#b8643a", 345, 1.25, 0.95],
            ["Bronze", "#8a6a3a", 0, 0.75, 0.72]].concat(WARM_PAINTS(1)),
    // (2026-11-08, Cam: the velvet rope's rope, "change the color of the poles and the ropes"): turned from its red
    velvet: [NATURAL("#9a2a35"), ["Black", "#2a2226", 0, 0.2, 0.45], ["Navy", "#2e3f7a", 233, 1, 0.85], ["Blue", "#3a6ab0", 221, 0.9, 1.1],
             ["Purple", "#6a3a8a", 285, 1, 1], ["Rose", "#d87090", 345, 0.8, 1.35], ["Teal", "#2a9a90", 180, 1, 1.1], ["Emerald", "#2f9a5a", 149, 1, 1.05],
             ["Mustard", "#c9a23a", 50, 1, 1.4], ["Charcoal", "#4a4a52", 0, 0.12, 0.75], ["Cream", "#e6d8b8", 0, 0.3, 1.9]],
    // (2026-11-08, Cam: "swatches for the stoves, milkshake makers and counters"): the milkshake counters' mint and the
    // milkshake machine's pink, turned from their own colour to each of these
    mint: TURNED(138, "#8fd8b0"), pink: TURNED(343, "#e88aa8"),
    dark: [NATURAL("#2e2a2c"), ["Bronze", "#8a6a3a", 0, 2, 1.6], ["Emerald", "#2e6a46", 100, 3, 1.6], ["Teal", "#2e6a6a", 150, 3, 1.6], ["Blue", "#2e4a7a", 200, 3, 1.6],
           ["Plum", "#5a3a6a", 260, 3, 1.6], ["Red", "#7a2e2e", 330, 3.5, 1.6], ["Sage", "#5a6a4a", 70, 2, 1.8], ["Cream", "#e6d8b8", 0, 1.5, 3.2]],
  };
  SWATCH_SETS.enamel = SWATCH_SETS.shade;                          // (the stove's cream enamel takes the lampshade's paints)
  // the sliders' ends: the tinted-first materials need more saturation and brightness
  const RANGE = (mat) => PAINT[mat] ? { s: 5, b: 1.2 } : SEPIA[mat] ? { s: 4, b: 3.5 } : mat === "darkwood" ? { s: 2.5, b: 3 } : { s: 2, b: 1.8 };
  // (2026-10-24) the paints: a swatch you haven't got is shown locked, saying where it comes from; the sliders need the mixer
  function paintMine(v, name, i) { return i === 0 || !C.PAINT_OF[name] || !!(v.paints && v.paints.owned.indexOf(name) >= 0); }
  // counter styles as swatches (2026-10-24, Cam: bought at the furniture store, "they get added into the swatches"):
  // their circles in the style's own colours, ringed so they read as a finish rather than a paint
  const STYLE_DOT = { wood: "#a8612e", oak: "#e0b98a", walnut: "#5a3420", mint: "#8fd0b8", cream: "linear-gradient(135deg,#f2e6c8 60%,#d9a62a 60%)",
                      red: "#b8443a", marble: "linear-gradient(135deg,#f4f4f2,#cfcfd6)", pink: "#f0b8c8", slate: "#3a3a40" };
  const isCounter = (kind) => kind === "counter" || kind === "buffet";
  /** The swatches a piece can take: [{key, name, dot, on, mine, why, style?|h,s,b}] -- a counter's styles first, then the paints. */
  function swatchesFor(it, v, part) {
    const mat = it.mat ? (part === 2 ? it.mat2 : it.mat) : matOf(it.kind, part), set = SWATCH_SETS[mat] || [], t = (part === 2 ? it.tint2 : it.tint) || { h: 0, s: 1, b: 1 }, out = [];
    if (isCounter(it.kind) && v.paints && part !== 2) v.paints.counters.forEach((x) => out.push({ key: "style:" + x.id, style: x.id, name: x.name, dot: STYLE_DOT[x.id] || "#999",
      on: !it.tint && (it.cstyle || "wood") === x.id, mine: x.owned, why: `${x.name}: a counter style from the furniture store` }));
    set.forEach(([n, c, h, s, b], i) => {
      if (isCounter(it.kind) && i === 0) return;                                   // (plain wood is the counters' first)
      const p = C.PAINT_OF[n];
      out.push({ key: (part === 2 ? "two:" : "paint:") + n, part: part === 2 ? 2 : 1, name: n, dot: c, h, s, b, on: !it.cstyle && (t.sw ? t.sw === n : true) && t.h === h && t.s === s && t.b === b, mine: paintMine(v, n, i),
        why: p ? `${n}: ${p.level ? `comes at level ${p.level}, or ` : ""}from the furniture store or Aunty's box` : n });
    });
    return out;
  }
  /** PT56 (Cam: "photo frames to have swatches"): a hung photo frame's paints -- the wood set, owned or locked. */
  function frameSwatches(v, key) {
    const t = (v.hangTint || {})[key] || { h: 0, s: 1, b: 1 };
    return SWATCH_SETS.wood.map(([n, c, h, s, b], i) => {
      const p = C.PAINT_OF[n];
      return { key: "frame:" + n, name: n, dot: c, h, s, b, on: (t.sw ? t.sw === n : true) && t.h === h && t.s === s && t.b === b, mine: paintMine(v, n, i),
        why: p ? `${n}: ${p.level ? `comes at level ${p.level}, or ` : ""}from the furniture store or Aunty's box` : n };
    });
  }
  /** A piece by its uid -- or "pwall", the patio's brick side wall, painted like a low brick wall (2026-10-25); or
      "hw:x,y,dir", a half wall (2026-11-08), painted in its style's material(s). */
  const itemOf = (v, uid) => {
    if (uid === "pwall") return v.patio && { uid, kind: "halfbrick", tint: v.patio.tint, tint2: v.patio.tint2, wall: true };
    if (typeof uid === "string" && uid.startsWith("hw:")) {
      const [x, y, dir] = uid.slice(3).split(",").map(Number), w = hwHere(v, { x, y, dir });
      return w && { uid, kind: w.style, tint: w.tint, tint2: w.tint2, mat: hwMat(w.style, 1), mat2: hwMat(w.style, 2), hw: w };
    }
    return v.items.find((i) => i.uid === uid);
  };
  /** Use a swatch on a piece: a counter style, or a paint. */
  function useSwatch(uid, key) {
    const v = C.view(state, now()), it = itemOf(v, uid), part = key.startsWith("two:") ? 2 : 1;
    const sw = it && swatchesFor(it, v, part).find((x) => x.key === key);
    if (!sw) return;
    if (!sw.mine) return toast(sw.why + ".");
    swPart = part;
    if (it.wall) return act("wallTint", { part, h: sw.h, s: sw.s, b: sw.b, sw: sw.name });
    if (it.hw) return act("halfWallTint", { x: it.hw.x, y: it.hw.y, dir: it.hw.dir, part, h: sw.h, s: sw.s, b: sw.b, sw: sw.name });
    if (sw.style) return act("counterStyle", { uid, id: sw.style });
    act("tint", { uid, part, h: sw.h, s: sw.s, b: sw.b, sw: sw.name });
  }
  const swDot = (x, extra) => `<button class="nc-sw${x.style ? " style" : ""}${x.on ? " on" : ""}${x.mine ? "" : " locked"}${extra || ""}" data-sw="${esc(x.key)}" title="${esc(x.mine ? x.name : x.why)}" style="background:${x.dot}">${x.mine ? "" : "<i>🔒</i>"}</button>`;
  /** The swatch rows: one, or a two-tone thing's two, each named (PT56). */
  function swatchRows(it, v, wrap, mine) {
    const parts = (C.THINGS[it.kind] || {}).parts, two = parts && (it.mat ? it.mat2 : matOf(it.kind, 2));
    const dots = (part) => `<span class="nc-sw-row${wrap ? " wrap" : ""}">${swatchesFor(it, v, part).filter((x) => !mine || x.mine).map((x) => swDot(x)).join("")}</span>`;
    const row = (part) => two ? `<div class="nc-sw-part"><em>${esc(parts[part - 1])}</em>${dots(part)}</div>` : dots(part);
    return row(1) + (two ? row(2) : "");
  }
  function swatchHTML(pick, v) {
    const parts = C.THINGS[pick.kind].parts, two = parts && matOf(pick.kind, 2), part = two ? swPart : 1;
    const R = RANGE(matOf(pick.kind, part)), t = (part === 2 ? pick.tint2 : pick.tint) || { h: 0, s: 1, b: 1 }, mixer = v.paints && v.paints.mixer;
    return `<div class="nc-swatches">${swatchRows(pick, v)}
      ${mixer && two ? `<span class="nc-sw-parts">Mixing: ${parts.map((n, i) => `<button class="nc-btn sm${part === i + 1 ? " on" : ""}" data-swpart="${i + 1}">${esc(n)}</button>`).join("")}</span>` : ""}
      ${mixer ? `<label>Colour <input type="range" min="0" max="359" step="1" value="${t.h}" data-tk="h"></label>
      <label>Shade <input type="range" min="0.3" max="${R.b}" step="0.05" value="${t.b}" data-tk="b"></label>
      <label>Vivid <input type="range" min="0" max="${R.s}" step="0.05" value="${t.s}" data-tk="s"></label>` : `<small class="nc-dhint">🎨 Mix your own colours with the paint mixer, from the furniture store</small>`}</div>`;
  }
  // a paint's colour for the store and Aunty's tin: its swatch's dot, the first place it's named
  const PAINT_DOT = {};
  Object.keys(SWATCH_SETS).forEach((m) => SWATCH_SETS[m].forEach(([n, c], i) => { if (i && !PAINT_DOT[n]) PAINT_DOT[n] = c; }));
  PAINT_DOT.Blue = "#4f8fb0";
  /** A tin of paint, drawn: its colour on a little tin (for Aunty's box). */
  const paintTin = (id) => "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><ellipse cx="32" cy="50" rx="20" ry="7" fill="#8a8f96" stroke="#3a1d14" stroke-width="3"/><rect x="12" y="18" width="40" height="32" fill="#c4c9d0" stroke="#3a1d14" stroke-width="3"/><ellipse cx="32" cy="18" rx="20" ry="7" fill="${PAINT_DOT[id] || "#999"}" stroke="#3a1d14" stroke-width="3"/><rect x="16" y="28" width="32" height="14" rx="3" fill="${PAINT_DOT[id] || "#999"}" stroke="#3a1d14" stroke-width="2"/></svg>`);
  // machines' glows: the colour (r, g, b), how far down the picture (%), how big (px)
  const MGLOW = { pinball: ["255,150,90", 45, 90], skeeball: ["255,210,90", 40, 90], basketball: ["255,90,80", 25, 90], karaoke: ["240,90,220", 35, 90],
                  lightgun: ["255,70,70", 35, 80], airhockey: ["90,220,255", 55, 100], airhockey2: ["90,220,255", 55, 140], whackamole: ["170,255,110", 45, 80],
                  claw: ["255,130,200", 35, 90], fortune: ["180,110,255", 40, 90], hauntedhouse: ["130,255,140", 40, 100] };
  /** 2026-10-25 (Cam: "make it so counters join when placed next to each other"): a counter or buffet counter in a row
      of them running the same way -- "-jf" its far end open (one behind it), "-jn" reaching forward under the one in
      front, "-jfn" both, "" on its own. The nearer one is drawn over the one behind, so the reach is underneath and
      never over a dish (tools/make_cafe_joins.py). */
  function joinOf(v, it, cs) {
    if (it.kind !== "counter" && it.kind !== "buffet") return "";
    const ax = C.alongX(it.dir), dx = ax ? 1 : 0, dy = ax ? 0 : 1, lo = cs[0], hi = cs[cs.length - 1];
    const row = (x, y) => v.items.some((o) => o.uid !== it.uid && (o.kind === "counter" || o.kind === "buffet") && C.alongX(o.dir) === ax && C.covers(o, x, y));
    const far = row(lo.x - dx, lo.y - dy), near = row(hi.x + dx, hi.y + dy);
    return far || near ? "-j" + (far ? "f" : "") + (near ? "n" : "") : "";
  }
  function thingHTML(v, it, extra) {
    const st = it.stove;
    let f = face(it.kind, it.dir, st && st.status === "dirty", it.cstyle);
    // (2026-10-25, Cam: "it doesn't line up") -- a row joins from one painting: -r isn't quite -l mirrored, so a joined
    // counter is always its -l picture, mirrored when the row runs along y
    const jn = joinOf(v, it, C.cells(it)), jbase = jn && f.id.replace(/-[lr]$/, "-l");
    if (jn && has(jbase + jn)) f = Object.assign({}, f, { src: art(jbase), id: jbase, flip: !C.alongX(it.dir) });
    // PT43: wall tallest, people next, counters/till/stove lowest -- all well inside their tile
    const s = f.standin ? { w: THING_W.sofa, h: sized(f.id, THING_W.armchair).h }
      : sized(f.id, META[f.id] && META[f.id].tile ? Math.round(TW * META[f.id].tile * CSCALE) : THING_W[it.kind] || 68);
    const cs = C.cells(it);
    let z = 10 + Math.max(...cs.map((c) => c.x + c.y)) * 10;
    // (Cam, 25 Oct: "a double buffet clips through the half wall ... placed against the half wall on the inside") a long
    // thing along the patio's side wall, inside, is drawn at its nearer tile's depth -- over the wall's piece by its far
    // tile (that piece is its tile's depth + 8). It goes just under that piece instead.
    if (v.patio && cs.length > 1 && cs.every((c) => c.x === v.size - 1)) z = Math.min(z, 10 + (v.size - 1 + Math.min(...cs.map((c) => c.y))) * 10 + 7);
    // where it stands: a one-tile thing on its tile's middle; a buffet counter on the middle of its two tiles, its near
    // end where a single counter would stand on the nearer tile
    const mid = cs.map((c) => at(v, c.x + 0.5, c.y + 0.5)), M = { x: (mid[0].x + mid[mid.length - 1].x) / 2, y: (mid[0].y + mid[mid.length - 1].y) / 2 };
    const one = it.kind === "buffet" ? sized(f.id.replace("buffet", "counter"), Math.round(TW * ((META["counter-l"] || {}).tile || 1.09) * CSCALE))
      : it.kind === "sofa" ? { w: THING_W.armchair, h: s.h } : C.THINGS[it.kind] && C.THINGS[it.kind].two ? { w: s.w / 2, h: s.h } : s;   // (a sofa's feet: an armchair's on the nearer tile; a big game's, half of it)
    let left = Math.round(M.x - s.w / 2), top = Math.round(Math.max(...mid.map((c) => c.y)) + one.w / 4 + 2 - s.h);
    const run = META[f.id] && META[f.id].run;
    if (run && !f.flip) {
      // a divider (N48, Cam: "they do not marry up"): its front edge exactly a tile long, on the tile's middle line
      // brought forward half its thickness -- so a row joins end to end. run: its foot's left-most, lowest and
      // right-most points (the cutter's run_points); facing down-left the front edge is left-most to lowest, else
      // lowest to right-most.
      const [lx, ly, bx, by, rx, ry] = run, r = it.dir % 2 === 1, edge = r ? rx - bx : bx - lx;
      s.w = Math.round(TW / 2 / edge); s.h = sized(f.id, s.w).h;
      const t = (r ? bx - lx : rx - bx) / edge, P = r ? at(v, it.x + 0.5 + t / 2, it.y) : at(v, it.x, it.y + 0.5 + t / 2);
      left = Math.round(P.x - (r ? rx : lx) * s.w); top = Math.round(P.y - (r ? ry : ly) * s.h);
    }
    const grow = C.growOf(it);
    if (grow !== 1) {                                 // (made bigger with = : C.GROW -- it grows up and out from its feet)
      const fx = left + s.w / 2, fy = top + s.h;
      s.w = Math.round(s.w * grow); s.h = Math.round(s.h * grow);
      left = Math.round(fx - s.w / 2); top = Math.round(fy - s.h);
    }
    // a joined counter's longer picture: the same scale, from the same top corner (a -r picture's, its top-right)
    const jid = f.id + jn, joined = jid !== f.id && has(jid) && ART[f.id];
    let fj = f, jcss = "";
    if (joined) {
      const k = s.w / ART[f.id][0], jw = +(ART[jid][0] * k).toFixed(2), jh = +(ART[jid][1] * k).toFixed(2);   // (not rounded: zoomed in, a pixel shows)
      fj = Object.assign({}, f, { src: art(jid), id: jid });
      jcss = `;--jl:${f.flip ? +(s.w - jw).toFixed(2) : 0}px;--jw:${jw}px;--jh:${jh}px`;
    }
    let over = "";
    if (st) {
      if (st.status === "cooking") over = `${pan("cook", st.dish.id)}<span class="nc-bub time" data-ready="${st.ready}">${clock(st.left)}</span><span class="nc-ring" data-ready="${st.ready}" data-secs="${st.secs}" style="--p:${Math.round(st.progress * 100)}"></span>`;
      else if (st.status === "ready") over = `${pan("cook", st.dish.id)}<span class="nc-bub go">✓</span>${st.burn ? `<span class="nc-burnbar" data-burn="${st.burn}" data-secs="${st.secs}"><i></i></span>` : ""}`;
      else if (st.status === "burnt") over = `${pan("burnt", st.dish.id)}<span class="nc-bub bad">!</span>`;
      else if (st.status === "dirty") over = `<span class="nc-bub clean">✦</span>`;
    }
    // the dish sits on the counter's top (V20 q2): its middle on the middle of the top
    if (it.kind === "counter" && it.dish) over = `<img class="nc-plate" alt="" src="${art("dish-" + it.dish.id)}" style="top:${Math.round(((META[f.id] || {}).top || 0.21) * 100)}%;width:${Math.round(50 * dishK(it.dish.id))}%"><span class="nc-count">${it.n}</span>`;
    // a buffet counter: a plate on the middle of each tile's half of the top
    if (it.kind === "buffet" && it.plates) over = it.plates.map((pl, i) => {
      if (!pl.dish) return "";
      const c = mid[i], px = Math.round(c.x - left), py = Math.round(c.y + one.w / 4 + 2 - one.h + ((META["counter-l"] || {}).top || 0.21) * one.h - top);
      return `<img class="nc-plate at" alt="" src="${art("dish-" + pl.dish.id)}" style="left:${px}px;top:${py}px;width:${Math.round(one.w * 0.5 * dishK(pl.dish.id))}px"><span class="nc-count at" style="left:${px + Math.round(one.w * 0.18)}px;top:${py - Math.round(one.w * 0.3)}px">${pl.n}</span>`;
    }).join("");
    // a fridge component (2026-10-21): what waits cold under the counter, at its foot
    if (it.fridge) over += `<span class="nc-cold" title="In the fridge">${SNOW}${it.under.map((u) => `<img alt="" src="${art("dish-" + u.dish.id)}"><b>${u.n}</b>`).join("") || "<b>0</b>"}</span>`;
    if (C.isVend(it) && it.vend > 0) over = `<span class="nc-bub money">${COIN}${num(it.vend)}</span>`;
    if (it.tip) over = `<span class="nc-bub money tip">${COIN}${num(it.tip)}</span>`;      // N42: a tip left on the table
    if (it.candy) over = `<span class="nc-bub money tip candy">🍬${num(it.candy)}${it.tip ? ` ${COIN}${num(it.tip)}` : ""}</span>`;   // (Halloween: candy left too)
    if (it.coins) over = `<span class="nc-bub money">${COIN}${num(it.coins)}</span>`;        // V22: a coin machine's takings
    // V26 q6: a milkshake counter's or sushi bar's own top -- what it made, on it
    if (C.isBar(it) && it.plates && it.plates[0].dish && (!st || st.status !== "ready")) over += `<img class="nc-plate" alt="" src="${art("dish-" + it.plates[0].dish.id)}" style="top:24%;width:${Math.round(50 * dishK(it.plates[0].dish.id))}%"><span class="nc-count">${it.plates[0].n}</span>`;
    // (2026-10-26) a plain milkshake counter: its three places along the middle of the top, back to front
    if (C.isShelf(it) && it.plates) {
      const k = (f.id.match(/-(bl|br|l|r)$/) || [, "l"])[1], P = SHELF_AT[it.kind][k.replace("r", "l")], rx = k.endsWith("r") !== !!f.flip;
      over = it.plates.map((pl, i) => {
        if (!pl.dish) return "";
        const x = rx ? 1 - P[i][0] : P[i][0];
        return `<img class="nc-plate at" alt="" src="${art("dish-" + pl.dish.id)}" style="left:${(x * 100).toFixed(1)}%;top:${(P[i][1] * 100).toFixed(1)}%;width:${Math.round((it.kind === "sushishelf" ? 26 : 32) * dishK(pl.dish.id))}%"><span class="nc-count at sm" style="left:${(x * 100 + (it.kind === "sushishelf" ? 3 : 8)).toFixed(1)}%;top:${(P[i][1] * 100 + (it.kind === "sushishelf" ? -11 : 3)).toFixed(1)}%">${pl.n}</span>`;
      }).join("");
    }
    // V26 q5: the espresso machine on its counter (behind the dish), and q1: an empty sign on whatever's run dry
    if (it.espresso) over = `<img class="nc-espresso${it.dir % 2 ? " flip" : ""}" alt="" src="${art("espresso-l")}">` + over;
    if (it.dry) over += `<span class="nc-bub empty" title="Run dry -- click to refill">${EMPTY_IC}</span>`;
    // 2026-10-24 (Cam: "it needs an overlay for lighting up"): a lamp's shade glows in the evening and at night -- when
    // it's on (Cam: "when i click the draw string it will turn on or off"); by day, on, a faint glow round the shade
    const lamp = !!(C.THINGS[it.kind] && C.THINGS[it.kind].lamp), lit = lamp && !it.off && skyNow(v).dark;
    if (lit) over += `<span class="nc-lampglow in"></span>`;
    else if (lamp && !it.off) over += `<span class="nc-lampglow in day"></span>`;
    // (2026-10-24, Cam: "a blue color glow from the arcade machine a very minimal one, a rainbow one from the jukebox
    // that changes color slowly and smoothly") -- round the arcade's screen (on its fronts; a faint spill round its back),
    // and round the jukebox, turning through the colours
    if (it.kind === "arcade") { const d = it.dir % 4; over += `<span class="nc-mglow arcade${d >= 2 ? " back" : ""}" style="left:${d === 1 ? 51 : d === 0 ? 46 : 50}%;top:${d >= 2 ? 45 : 40}%"></span>`; }
    if (it.kind === "jukebox" || it.kind === "dance") over += `<span class="nc-mglow jukebox"></span>`;
    // (Cam, 2026-10-24: "a glow to the other game machines like pinball, time crisis etc.") -- each its own colour, round
    // where its lights are; fainter from behind
    const MG = MGLOW[it.kind];
    if (MG) over += `<span class="nc-mglow tint${it.dir % 4 >= 2 ? " back" : ""}" style="--g:${MG[0]};left:50%;top:${MG[1]}%;width:${MG[2]}px;height:${MG[2]}px;margin:${-MG[2] / 2}px 0 0 ${-MG[2] / 2}px"></span>`;
    if (C.isSeat(it) && build && !build.street && !it.seat) over = `<span class="nc-bub bad" title="Not facing a table">?</span>`;
    if (it.kind === "till" && v.till > 0) over = `<span class="nc-bub money">${COIN}${num(v.till)}</span>`;
    const cookNm = C.THINGS[it.kind] ? C.THINGS[it.kind].name : "Stove";
    let label = !st && C.cooks(it) ? cookNm : C.cooks(it) ? (st.status === "free" ? cookNm + ": cook" : st.status === "cooking" ? `Cooking ${st.dish.name}` : st.status === "ready" ? `Serve ${st.dish.name}` : st.status === "burnt" ? "Burnt: throw away" : "Dirty: clean") + (it.selfclean ? " (self-cleaning)" : "")
      : it.kind === "counter" ? (it.dish ? `${it.dish.name}: ${it.n} left` : "Serving counter") + coldNote(it)
      : it.kind === "chair" ? (it.seat ? "Chair (a seat at a table)" : "Chair -- turn it to face a table to make it a seat")
      : it.tip || it.candy ? `${C.THINGS[it.kind].name}: ${[it.tip ? `a tip of ${it.tip}` : "", it.candy ? `${it.candy} candy` : ""].filter(Boolean).join(" and ")} -- click to pick it up`
      : C.MACHINES[it.kind] ? `${C.THINGS[it.kind].name}${it.coins ? `: ${it.coins} coins -- click to take them` : C.MACHINES[it.kind].play ? " (people come in to play)" : " (people getting up drop coins in)"}`
      : C.THINGS[it.kind] && C.THINGS[it.kind].furniture ? C.THINGS[it.kind].name + (C.isSeat(it) ? (it.seat ? " (a seat at a table)" : " -- turn it to face a table to make it a seat") : "")
      : C.isVend(it) ? `${C.THINGS[it.kind].name}${it.vend ? `: ${it.vend} coins` : ""}`
      : C.isShelf(it) ? C.THINGS[it.kind].name + ((it.plates || []).some((p) => p.dish) ? ": " + it.plates.filter((p) => p.dish).map((p) => `${p.dish.name} ${p.n}`).join(", ") : ` -- serve from a ${C.THINGS[makerOf(it.kind)].name.toLowerCase()} onto it`)
      : it.kind === "buffet" ? "Buffet counter" + ((it.plates || []).some((p) => p.dish) ? ": " + it.plates.filter((p) => p.dish).map((p) => `${p.dish.name} ${p.n}`).join(", ") : "") + coldNote(it)
      : `Cash register${v.till ? `: ${v.till} coins` : ""}`;
    if (lamp && !build) label += it.off ? " (off) -- click to switch it on" : " -- click to switch it off";
    if (it.dry) label = `${it.kind === "counter" ? "Espresso machine" : C.THINGS[it.kind].name}: run dry -- click to refill (${C.REFILL.cut * 100}% of the coins in it, at least ${C.REFILL.least})`;
    if (C.isBar(it) && it.plates && it.plates[0].dish && st && st.status !== "ready") label += ` -- ${it.plates[0].dish.name}: ${it.plates[0].n} left`;
    const sel = build && build.pick === it.uid ? " picked" : "";
    return `<button class="nc-thing ${it.kind}${joined ? " joined" : ""}${lit ? " lit" : ""}${lamp ? (it.off ? " off" : " on") : ""}${f.standin ? " standin" : ""}${extra ? " " + extra : ""}${sel}${st ? " " + st.status : ""}" data-uid="${it.uid}" data-kind="${it.kind}" title="${esc(label)}" aria-label="${esc(label)}"
      style="left:${left}px;top:${top}px;width:${s.w}px;height:${s.h}px;z-index:${z}${jcss}">
      <img class="nc-body${f.flip ? " flip" : ""}" alt="" src="${fj.src}">${fabHTML(it, fj)}${over}</button>`;
  }
  const TAB_STRIP = 0;                                          // (the menu's tabs were along the bottom till 25 Oct; now top left)
  function fit() {
    const main = $("nc-main"), world = $("nc-world"), dr = $("nc-drawer");
    const W = parseFloat(world.style.width), H = parseFloat(world.style.height);
    const dh = dr.hidden ? 0 : dr.offsetHeight + 14, room = main.clientHeight - dh - TAB_STRIP;   // the build drawer takes the bottom, the tabs above it
    document.body.style.setProperty("--nc-dh", (dr.hidden ? 0 : dr.offsetHeight) + "px");
    const tabs = document.querySelector("#nc-fab .nc-tabs");                                  // (2026-10-25: the menu as wide as the tabs)
    if (tabs && tabs.offsetWidth) document.body.style.setProperty("--nc-tabsw", tabs.offsetWidth + "px");
    document.body.classList.toggle("nc-drawer-open", !dr.hidden);
    const dev = $("nc-dev"), side = dev && !dev.hidden && window.innerWidth > 760 ? dev.offsetWidth + 12 : 0;     // the dev tools take the right
    const sc = Math.min((main.clientWidth - side) / W, room / H, 2.4) * view.z;
    world.style.left = Math.round((main.clientWidth - side) / 2) + "px";
    world.style.top = Math.round(room / 2 + 8) + "px";
    world.style.transform = `translate(calc(-50% + ${Math.round(view.x)}px), calc(-50% + ${Math.round(view.y)}px)) scale(${Math.max(0.3, sc)})`;
    // (2026-10-25 performance pass) the world is a GPU layer, kept at the sharpness it was drawn at while you zoom; a
    // moment after the zooming stops it's drawn afresh once at the new size -- not at every step of the wheel
    if (Math.abs(sc - rasterSc) > 1e-4) {
      clearTimeout(rerast);
      rerast = setTimeout(() => {
        const far = !groundSc || sc / groundSc > 1.6 || groundSc / sc > 1.6;     // (the ground: only after a big change)
        rasterSc = sc; if (far) groundSc = sc;
        if (!far) return;                                 // (only the ground is a layer now: 2026-10-25, the zoom flashes)
        const cls = ["nc-rerast-g"];
        document.body.classList.add(...cls);
        requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.remove(...cls)));
      }, 350);
    }
  }
  let rasterSc = 0, groundSc = 0, rerast = 0;
  window.addEventListener("resize", () => { if (state && state.made) fit(); });
  // ---- just looking, and photos (2026-10-25, Cam: "a transparent eye icon in the top right ... hides all the UI details
  // like dish count, underservery icon, money bubbles, candy bubbles etc." and "a little transparent camera ... takes a
  // photo of inside the cafe only. No matter where the screen is placed"). The eye puts the page in body.nc-look (CSS
  // hides the rest); the camera frames the café, hides what's outside, and Python grabs the window's pixels inside the
  // café's outline (neurocafe.py cafe_snap) into Pictures/NeuroCafe.
  const EYE = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M1.5 12S5.5 4.5 12 4.5 22.5 12 22.5 12 18.5 19.5 12 19.5 1.5 12 1.5 12z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3.6" fill="currentColor"/></svg>`;
  const EYE_OFF = EYE.replace("</svg>", `<path d="M3 3l18 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`);
  const CAMERA = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h3l1.6-2.2h5.8L16.5 7h3A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="13" r="3.6" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;
  let looking = false, snapping = false;
  function drawLook() {
    let box = $("nc-look");
    if (!box) { box = document.createElement("div"); box.id = "nc-look"; box.className = "nc-lookbar"; document.body.appendChild(box); }
    box.innerHTML = `<button class="nc-lookbtn" data-look title="${looking ? "Show the game again" : "Hide the bubbles and buttons, to just look"}" aria-label="${looking ? "Show the game again" : "Just look"}">${looking ? EYE_OFF : EYE}</button>`
      + (looking ? `<button class="nc-lookbtn" data-snap title="Take a photo of the café" aria-label="Take a photo of the café">${CAMERA}</button>` : "");
    box.querySelector("[data-look]").addEventListener("click", () => { looking = !looking; document.body.classList.toggle("nc-look", looking); drawLook(); if (state && state.made) fit(); });
    const sn = box.querySelector("[data-snap]");
    if (sn) sn.addEventListener("click", snap);
  }
  /** The café's outline on the screen: its floor (with its edge) and its walls up to the cap -- the night sky's ring. */
  function cafeRing(v) {
    const world = $("nc-world"), b = world.getBoundingClientRect(), sc = b.width / parseFloat(world.style.width);
    const ws = sized("wall-l", TW / 2 + 1), up = Math.round(((META["wall-l"] || {}).yr || 0.78) * ws.h) + 18, z = v.size, edge = 10;
    const pt = (c, r, lift) => { const p = at(v, c, r); return [b.left + (p.x - BOX.x) * sc, b.top + (p.y - lift - BOX.y) * sc]; };
    if (v.patio) { const W = z + v.patio.depth, rail = 80;            // (V24: the patio too, up to its railings' tops)
      return [pt(0, z, -edge), pt(0, z, up), pt(0, 0, up), pt(z, 0, up), pt(z, 0, rail), pt(W, 0, rail), pt(W, 0, -edge), pt(W, z, -edge), pt(z, z, -edge)]; }
    return [pt(0, z, -edge), pt(0, z, up), pt(0, 0, up), pt(z, 0, up), pt(z, 0, -edge), pt(z, z, -edge)];
  }
  const ringBox = (r) => { const xs = r.map((p) => p[0]), ys = r.map((p) => p[1]), x = Math.min(...xs), y = Math.min(...ys); return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }; };
  const frames = (n) => new Promise((ok) => { const f = () => (n-- > 0 ? requestAnimationFrame(f) : ok()); f(); });
  async function snap() {
    if (snapping || !state || !state.made) return;
    snapping = true;
    const v = C.view(state, now()), keep = Object.assign({}, view), main = $("nc-main").getBoundingClientRect();
    document.body.classList.add("nc-snapping");
    try {
      // wherever you've scrolled to: the café fills the window, in its middle
      view.z = 1; view.x = 0; view.y = 0; fit();
      let r = ringBox(cafeRing(v));
      view.z = Math.min(main.width * 0.96 / r.w, main.height * 0.96 / r.h); fit();
      r = ringBox(cafeRing(v));
      view.x += main.left + main.width / 2 - (r.x + r.w / 2); view.y += main.top + main.height / 2 - (r.y + r.h / 2); fit();
      await frames(4);
      const res = await Store.call("cafe_snap", [cafeRing(v)]);
      if (res && res.path) { flashShot(); toast(`📷 Photo saved: ${res.name || res.path}`); }
      else toast((res && res.error) || "Couldn't take the photo.", true);
    } catch (e) {
      toast("Couldn't take the photo.", true);
    } finally {
      Object.assign(view, keep); fit();
      document.body.classList.remove("nc-snapping");
      snapping = false;
    }
  }
  function flashShot() {
    const f = document.createElement("div");
    f.className = "nc-shutter";
    document.body.appendChild(f);
    setTimeout(() => f.remove(), 600);
  }
  // look around (2026-10-21): the wheel zooms, dragging the ground pans; a drag never counts as a click
  (function camWire() {
    const main = $("nc-main");
    let drag = null, dragged = false;
    // the wheel zooms towards the pointer, from well out (the whole street) to close in (PT45: "zoom was reduced")
    main.addEventListener("wheel", (e) => {
      e.preventDefault();
      const z = Math.max(0.45, Math.min(5, view.z * (e.deltaY < 0 ? 1.15 : 1 / 1.15))), k = z / view.z, world = $("nc-world"), r = main.getBoundingClientRect();
      const cx = parseFloat(world.style.left) + view.x, cy = parseFloat(world.style.top) + view.y, px = e.clientX - r.left, py = e.clientY - r.top;
      view.x = px - (px - cx) * k - parseFloat(world.style.left);
      view.y = py - (py - cy) * k - parseFloat(world.style.top);
      view.z = z;
      fit();
    }, { passive: false });
    main.addEventListener("dragstart", (e) => e.preventDefault());      // (no picture dragging: it swallowed the fence drag)
    main.addEventListener("mousedown", (e) => {
      if (e.button !== 0 || e.target.closest(".nc-fab")) return;
      const th = e.target.closest(".nc-thing:not(.ghost)"), pr = e.target.closest("[data-decor]");
      const busy = build && (build.place || build.move || build.paint || build.walls || build.hwalls || build.floors || build.hang || build.moveHang || build.placeDecor || build.moveDecor);
      if (build && build.hwalls && (build.style || build.erase)) {   // (2026-11-08) a half wall: press on a line, drag along it
        e.preventDefault();
        const a = edgeAt(C.view(state, now()), e);
        hwDrag = { a, p: a };
        return;
      }
      // N49 i3: in Build, press on a thing and drag it where it goes
      if (build && !busy && !build.street && th) { thingDrag = { uid: +th.dataset.uid, x: e.clientX, y: e.clientY }; return; }
      if (build && !busy && build.street && pr && pr.dataset.decor) { thingDrag = { decor: +pr.dataset.decor, x: e.clientX, y: e.clientY }; return; }
      // N49 i10: in play, press on a stove and sweep over the others -- each ready one serves, each dirty one cleans
      if (build && build.select) {                                  // (2026-10-25) Build > Select: inside the chosen box drags it, else a new box
        e.preventDefault();
        const g = groundAt(C.view(state, now()), e, true), b = sel && sel.box;
        selDrag = b && g.x >= b.x0 && g.x <= b.x1 && g.y >= b.y0 && g.y <= b.y1 ? { kind: "drag", from: g, dx: 0, dy: 0 } : { kind: "box", a: g, x: e.clientX, y: e.clientY };
        return;
      }
      if (build && build.terrain && build.brush) {                  // (2026-10-24) painting the ground: the stroke starts here
        e.preventDefault();
        const g = groundAt(C.view(state, now()), e, true);
        stroke = { t: build.brush, r: build.size || 1, pts: [[g.x, g.y]] };
        drawTerrain(C.view(state, now()));
        return;
      }
      if (lineHeld()) { e.preventDefault(); const g = groundAt(C.view(state, now()), e); line = { a: build.placePlot ? { x: Math.floor(g.x), y: Math.floor(g.y) } : g, x: e.clientX, y: e.clientY }; return; }
      if (!build && !potionMode && th && C.cooks({ kind: th.dataset.kind })) { sweep = new Set([+th.dataset.uid]); return; }
      const pb = !build && !potionMode && e.target.closest("[data-plot]");
      if (pb) { plotSweep = { first: +pb.dataset.plot, done: new Set([+pb.dataset.plot]), moved: false }; return; }   // (no panning off a plot: it sweeps)
      if (!(build && (build.paint || (build.paper && e.target.closest("[data-wall]"))))) { drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y }; dragged = false; }
    });
    main.addEventListener("mouseover", (e) => {
      const pb = plotSweep && e.buttons === 1 && e.target.closest && e.target.closest("[data-plot]");
      if (pb && !plotSweep.done.has(+pb.dataset.plot)) {
        if (!plotSweep.moved) { plotSweep.moved = true; sweepPlot(plotSweep.first); }    // (the one pressed on counts too)
        plotSweep.done.add(+pb.dataset.plot);
        sweepPlot(+pb.dataset.plot);
      }
      const th = e.target.closest && e.target.closest(".nc-thing:not(.ghost)"), uid = th ? +th.dataset.uid : null;
      hoverUid = uid;
      if (!sweep || !th || e.buttons !== 1 || !C.cooks({ kind: th.dataset.kind }) || sweep.has(uid)) return;
      sweep.add(uid);
      const it = C.view(state, now()).items.find((i) => i.uid === uid), st = it && it.stove && it.stove.status;
      if (st === "ready") act("serve", { uid }); else if (st === "dirty") act("clean", { uid }); else if (st === "burnt") act("throw", { uid });
      else if (st === "free" && hold && it.kind === hold.on) cookHeld(uid);
    });
    main.addEventListener("mouseleave", () => { hoverUid = null; });
    // N49 i4: a right-click turns what you hold; with nothing held it closes what's open, like Esc
    main.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      if (build && build.hwalls && build.style) {                             // (2026-11-08) a half wall's taken down
        const w = edgeAt(C.view(state, now()), e), h = hwHere(state, w);
        if (h) { act("halfWallRemove", { walls: [{ x: h.x, y: h.y, dir: h.dir }] }); return; }
      }
      // (2026-11-08, Cam: "change the indoor half walls with different colors as i could with the old dividers") a half
      // wall's paints in the same pop-up as a thing's: right-click it, in play or in Build (not while holding something)
      const holding = build && (build.place || build.move || build.hang || build.moveHang || build.ceil || build.moveCeil || build.placeDecor || build.moveDecor || (build.hwalls && (build.style || build.erase)));
      const hwEl = !holding && hwAt(e.clientX, e.clientY);
      if (hwEl && swatchPop("hw:" + hwEl.dataset.hw, e.clientX, e.clientY)) return;
      const th = !build && !hold && e.target.closest && e.target.closest(".nc-thing");   // (holding a dish from the book: right-click puts it back, not paints the stove)
      if (th && th.dataset.kind === "jukebox") return jukebox();               // (PT56 / Q8: the jukebox's music)
      if (th && swatchPop(+th.dataset.uid, e.clientX, e.clientY)) return;     // (2026-10-24) your swatches, by it
      const pw = !build && e.target.closest && e.target.closest(".nc-pwall");
      if (pw && swatchPop("pwall", e.clientX, e.clientY)) return;              // (2026-10-25) the patio's brick wall's, the same way
      const fr = !build && e.target.closest && e.target.closest(".nc-art.frame");
      if (fr && framePop(fr.dataset.hang, e.clientX, e.clientY)) return;      // PT56: a photo frame's paints, the same way
      if (!turnHeld(1)) back();
    });
    window.addEventListener("mousemove", (e) => {
      if (hwDrag) {
        const v = C.view(state, now()), p = edgeAt(v, e), k = hwRun(hwDrag.a, p).length + ":" + Math.floor(hwDrag.a.dir ? p.r : p.c);
        if (k === hwDrag.k) return;
        hwDrag.p = p; hwDrag.k = k; hwDrag.moved = true;
        return drawWorld(v);
      }
      if (selDrag) {
        const v = C.view(state, now()), g = groundAt(v, e, true);
        if (selDrag.kind === "box") {
          if (!selDrag.b && Math.hypot(e.clientX - selDrag.x, e.clientY - selDrag.y) < 6) return;
          const a = selDrag.a;
          selDrag.b = { x0: Math.min(a.x, g.x), x1: Math.max(a.x, g.x), y0: Math.min(a.y, g.y), y1: Math.max(a.y, g.y) };
        } else {
          const dx = Math.round(g.x - selDrag.from.x), dy = Math.round(g.y - selDrag.from.y);
          if (dx === selDrag.dx && dy === selDrag.dy) return;
          selDrag.dx = dx; selDrag.dy = dy;
          selTry();
        }
        drawWorld(v);
        return;
      }
      if (stroke) {
        const v = C.view(state, now()), g = groundAt(v, e, true), last = stroke.pts[stroke.pts.length - 1];
        brushAt = g;
        if (Math.hypot(g.x - last[0], g.y - last[1]) >= stroke.r * 0.3 && stroke.pts.length < 600) stroke.pts.push([g.x, g.y]);
        drawTerrain(v);
        return;
      }
      if (line) {
        if (!line.pts && Math.hypot(e.clientX - line.x, e.clientY - line.y) < 6) return;
        const r = linePoints(line.a, groundAt(C.view(state, now()), e)), k = r.pts.map((q) => q.x + "," + q.y).join(" ");
        if (k === line.k) return;
        Object.assign(line, r, { k });
        drawWorld(C.view(state, now()));
        return;
      }
      if (thingDrag) {
        if (thingDrag.on || Math.hypot(e.clientX - thingDrag.x, e.clientY - thingDrag.y) < 6) return;
        thingDrag.on = true;
        if (thingDrag.decor) { build = { ...streetHome(), moveDecor: thingDrag.decor }; hoverP = null; } else { build = { on: true, move: thingDrag.uid }; hover = null; }
        draw();
        return;
      }
      if (!drag) return;
      if (!dragged && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6) return;
      dragged = true;
      const lim = 1.4 * Math.max(main.clientWidth, main.clientHeight) * view.z;
      view.x = Math.max(-lim, Math.min(lim, drag.vx + e.clientX - drag.x));
      view.y = Math.max(-lim, Math.min(lim, drag.vy + e.clientY - drag.y));
      fit();
    });
    window.addEventListener("mouseup", (e) => {
      drag = null; sweep = null;
      if (hwDrag) {
        const d = hwDrag; hwDrag = null;
        if (e.target instanceof Node && main.contains(e.target)) { dragged = true; setTimeout(() => { dragged = false; }, 0); }
        if (build && build.hwalls) hwDo(hwRun(d.a, d.p));
        return drawWorld(C.view(state, now()));
      }
      if (plotSweep) { if (plotSweep.moved) { plotSwept = true; setTimeout(() => { plotSwept = false; }, 0); } plotSweep = null; }
      if (selDrag) {
        const d = selDrag; selDrag = null;
        if (e.target instanceof Node && main.contains(e.target)) { dragged = true; setTimeout(() => { dragged = false; }, 0); }
        if (d.kind === "box") {
          sel = d.b ? { box: d.b, mode: (sel && sel.mode) || "move" } : null;
          if (sel && !C.areaSays(state, C.areaPick(state, sel.box))) { sel = null; toast("Nothing outside the café in that box.", true); }
          return draw();
        }
        peek = null;
        if (!d.dx && !d.dy) return draw();
        if (d.bad || !d.r) { if (d.bad) toast(d.bad, true); return draw(); }
        const go = () => {
          const r = act("area", Object.assign({ op: sel.mode, dx: d.dx, dy: d.dy, free: freePlace }, sel.box));
          if (r && r.ok) { const b = sel.box; sel.box = { x0: b.x0 + d.dx, x1: b.x1 + d.dx, y0: b.y0 + d.dy, y1: b.y1 + d.dy }; if (r.msg) toast(r.msg); draw(); }
        };
        const not = (d.r.msg || "").split(" Not copied: ")[1];
        if (sel.mode === "copy") { draw(); return confirmBox(`Put a copy here ${d.r.cost ? `for ${num(d.r.cost)} coins` : "(it's free)"}?${not ? ` (Not copied: ${not.replace(/\.$/, "")}.)` : ""}`, go); }
        return go();
      }
      if (stroke) {
        const st = stroke; stroke = null;
        if (main.contains(e.target)) { dragged = true; setTimeout(() => { dragged = false; }, 0); }
        const r = act("terrain", { t: st.t, r: st.r, pts: st.pts }, true);
        if (!r || !r.ok) { terrainKey = ""; drawTerrain(C.view(state, now())); if (r && r.error) toast(r.error, true); }
        return;
      }
      if (line) {
        const long = line.pts && line.pts.length > (build.placePlot ? 1 : 0);
        if (long && e.target instanceof Node && main.contains(e.target)) { dragged = true; setTimeout(() => { dragged = false; }, 0); }   // (no click after)
        if (long) lineDrop(); else line = null;                       // (a short press stays a click: one piece)
        return;
      }
      const td = thingDrag; thingDrag = null;
      if (!td || !td.on) return;
      if (main.contains(e.target)) { dragged = true; setTimeout(() => { dragged = false; }, 0); }   // (the click that follows isn't a click)
      const v = C.view(state, now());
      if (td.decor) dropDecorAt(groundAt(v, e)); else dropItemAt(tileAt(v, e));
    });
    main.addEventListener("click", (e) => { if (dragged) { e.stopPropagation(); e.preventDefault(); dragged = false; } }, true);
    main.addEventListener("dblclick", () => { view = { z: 1, x: 0, y: 0 }; fit(); });
  })();

  /** The tile under the pointer (the floor's diamonds, worked out from the point); out: outside the café too (PT56). */
  function tileAt(v, ev, out) {
    const world = $("nc-world"), b = world.getBoundingClientRect(), sc = b.width / parseFloat(world.style.width);
    const x = (ev.clientX - b.left) / sc + BOX.x - v.size * TW / 2, y = (ev.clientY - b.top) / sc + BOX.y - WALL;
    const c = Math.floor((x / (TW / 2) + y / (TH / 2)) / 2), r = Math.floor((y / (TH / 2) - x / (TW / 2)) / 2);
    return out || (c >= 0 && r >= 0 && c < (v.cafeW || v.size) && r < v.size) ? { x: c, y: r } : null;
  }

  // ---- half walls (2026-11-08, Cam): they stand on the lines between tiles -- {x, y, dir}: dir 0 along x from (x, y),
  // between tiles (x, y-1) and (x, y); dir 1 along y from (x, y), between (x-1, y) and (x, y)
  /** The tile edge nearest the pointer: whichever grid line is nearer decides across (0) or down (1). c, r: the point. */
  function edgeAt(v, ev) {
    const world = $("nc-world"), b = world.getBoundingClientRect(), sc = b.width / parseFloat(world.style.width);
    const x = (ev.clientX - b.left) / sc + BOX.x - v.size * TW / 2, y = (ev.clientY - b.top) / sc + BOX.y - WALL;
    const c = (x / (TW / 2) + y / (TH / 2)) / 2, r = (y / (TH / 2) - x / (TW / 2)) / 2;
    return Math.abs(c - Math.round(c)) < Math.abs(r - Math.round(r)) ? { x: Math.round(c), y: Math.floor(r), dir: 1, c, r } : { x: Math.floor(c), y: Math.round(r), dir: 0, c, r };
  }
  /** A dragged run: straight on from the first edge, along its line, to level with the pointer (30 pieces at most). */
  function hwRun(a, p) {
    const out = [], to = a.dir ? Math.floor(p.r) : Math.floor(p.c), from = a.dir ? a.y : a.x, n = Math.max(-29, Math.min(29, to - from));
    for (let i = Math.min(0, n); i <= Math.max(0, n); i++) out.push(a.dir ? { x: a.x, y: a.y + i, dir: 1 } : { x: a.x + i, y: a.y, dir: 0 });
    return out;
  }
  const hwHere = (v, w) => (v.hwalls || []).find((h) => h.x === w.x && h.y === w.y && h.dir === w.dir);
  /** A style's paint material: part 1 (a railing's own, else the divider's), part 2 (a two-tone divider's second). */
  const hwStyle = (id) => C.HALF_WALL_OF[id] || {};
  const hwPic = (x) => x.rail ? `prop-rail_${x.rail}-l` : x.id + "-l";
  const hwMat = (id, part) => part === 2 ? (hwStyle(id).rail ? "" : matOf(id, 2)) : hwStyle(id).mat || matOf(id);
  /** One piece. A divider style: its picture's front edge a tile long, straddling the line (the divider's own run,
      from a tile half a step back: thingHTML's sums). A railing: its near post's foot on the line's near end, a tile
      long, its thickness centred on the line (as the patio's were) -- -r runs along x, -l along y. Drawn over the far
      tile's things and under the near tile's; outside behind the café (the street side), in the street's back layer. */
  function hwallHTML(v, w, extra) {
    const R = hwStyle(w.style).rail, r = !!w.dir;
    const f = R ? { id: `prop-rail_${R}-${r ? "l" : "r"}`, flip: false } : face(w.style, r ? 1 : 0), m = META[f.id] && META[f.id].run;
    if (!m || !ART[f.id]) return "";
    const [lx, ly, bx, by, rx, ry] = m;
    let sw, sh, left, top;
    if (R) {
      const edge = r ? rx - bx : bx - lx, t = (r ? bx - lx : rx - bx) / edge;
      sw = Math.round(TW / 2 / edge); sh = sized(f.id, sw).h;
      const P = r ? at(v, w.x + t / 2, w.y + 1) : at(v, w.x + 1, w.y + t / 2);
      left = Math.round(P.x - bx * sw); top = Math.round(P.y - by * sh);
    } else {
      const edge = r ? rx - bx : bx - lx, t = (r ? bx - lx : rx - bx) / edge;
      sw = Math.round(TW / 2 / edge); sh = sized(f.id, sw).h;
      const P = r ? at(v, w.x + t / 2, w.y) : at(v, w.x, w.y + t / 2);
      left = Math.round(P.x - (r ? rx : lx) * sw); top = Math.round(P.y - (r ? ry : ly) * sh);
    }
    const md = C.hwMid(w), back = md.x < 0 || md.y < 0, z = back ? 1000 + Math.round((md.x + md.y) * 10) : 10 + (w.x + w.y - 1) * 10 + 8;
    const m1 = hwMat(w.style, 1), m2 = hwMat(w.style, 2);
    const fab = (m1 && has(f.id + "-fab") ? fabTag(art(f.id + "-fab"), w.tint, m1, false) : "") + (m2 && has(f.id + "-fab2") ? fabTag(art(f.id + "-fab2"), w.tint2, m2, false, true) : "");
    const html = `<span class="nc-hwall${extra ? " " + extra : ""}"${extra ? "" : ` data-hw="${w.x},${w.y},${w.dir}"`} style="left:${left}px;top:${top}px;width:${sw}px;height:${sh}px;z-index:${z}"><img class="nc-body" alt="" src="${art(f.id)}">${fab}</span>`;
    return back ? { back: html, room: "" } : { back: "", room: html };
  }
  /** All of them, and in Build > Half walls the pieces under the pointer: green to build (in the colours picked), red
      where they can't go (or to take down). {back, room}: the street's back layer's, the café's. */
  function hwallsHTML(v) {
    const B = build && build.hwalls && (build.style || build.erase) && build, run = B ? (hwDrag ? hwRun(hwDrag.a, hwDrag.p) : hoverE ? [hoverE] : []) : [];
    const mark = new Set(B && B.erase ? run.filter((w) => hwHere(v, w)).map((w) => w.x + "," + w.y + "," + w.dir) : []);
    const out = { back: "", room: "" }, add = (h) => { if (h) { out.back += h.back; out.room += h.room; } };
    (v.hwalls || []).forEach((w) => add(hwallHTML(v, w, mark.has(w.x + "," + w.y + "," + w.dir) ? "erase" : "")));
    if (B && !B.erase) run.forEach((w) => add(hwallHTML(v, Object.assign({}, w, hwLook()), C.hwEdgeProblem(state, w, state.items) ? "ghost bad" : "ghost")));
    return out;
  }
  /** What a new piece looks like: the style, and the colours picked for it. */
  const hwLook = () => Object.assign({ style: build.style }, build.tint ? { tint: build.tint } : {}, build.tint2 ? { tint2: build.tint2 } : {});
  /** The half wall at a point on screen, if it's the topmost thing there (they don't take the pointer otherwise, so
      the lines under them can be picked). */
  function hwAt(x, y) {
    document.body.classList.add("nc-hwhit");
    const el = document.elementFromPoint(x, y);
    document.body.classList.remove("nc-hwhit");
    return el && el.closest && el.closest(".nc-hwall[data-hw]");
  }
  /** Build (or take down) a run of them. */
  function hwDo(run) {
    if (!run.length) return;
    if (build.erase) { const mine = run.filter((w) => hwHere(state, w)); if (mine.length) act("halfWallRemove", { walls: mine }); return; }
    const r = act("halfWall", Object.assign({ walls: run }, hwLook()));
    if (r && r.ok && r.msg) toast(r.msg);
  }

  /** Whether the ceiling's lights take the pointer (and the café goes faint): holding, moving or picking one, or looking
      at Buy > Lighting > Ceiling lights. */
  function ceilMode() {
    if (!build || build.street) return false;
    if (build.ceil || build.moveCeil || build.pickCeil) return true;
    const busy = build.floors || build.walls || build.hwalls || build.expand || build.place || build.move || build.pick || build.hang || build.moveHang || build.pickHang;
    return !busy && buyTab === "lighting" && buyCat.lighting === "ceiling";
  }
  function wireWorld(v) {
    const world = $("nc-world");
    world.querySelectorAll(".nc-thing:not(.ghost)").forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); clickThing(+b.dataset.uid, e); }));
    document.body.classList.toggle("nc-street", !!(build && build.street));
    document.body.classList.toggle("nc-selecting", !!(build && build.select));              // (Build > Select: the ground takes the pointer)
    document.body.classList.toggle("nc-painting", !!(build && (build.floors || build.terrain || build.hwalls)));   // PT48: laying floors, things go see-through
    document.body.classList.toggle("nc-papering", !!(build && ((build.walls && build.paper) || build.hang || build.moveHang)));   // N43: the walls take the pointer
    document.body.classList.toggle("nc-building", !!(build && !build.street));                 // V22: paintings can be picked
    world.querySelectorAll(".nc-art:not(.ghost)").forEach((im) => im.addEventListener("click", (e) => {
      if (!build && im.classList.contains("light")) {                           // (a wall light, on or off)
        e.stopPropagation();
        const r = act("light", { hang: im.dataset.hang });
        if (r && r.ok) toast(`${C.PAINTING[state.hang[im.dataset.hang]].name}: ${(state.hangOff || {})[im.dataset.hang] ? "off" : "on"}`);
        return;
      }
      if (!build || build.street || build.hang || build.moveHang || build.paper || build.paint) return;   // (those modes use the click themselves)
      e.stopPropagation(); build = { on: true, pickHang: im.dataset.hang }; draw();
    }));
    world.querySelectorAll("[data-switch]").forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); if (!build) act("light", { all: "ceil" }); }));
    document.body.classList.toggle("nc-ceiling", ceilMode());
    world.querySelectorAll(".nc-ceil:not(.ghost)").forEach((im) => im.addEventListener("click", (e) => {
      if (!ceilMode() || build.ceil || build.moveCeil) return;                  // (holding one, the click puts it up)
      e.stopPropagation(); build = { on: true, pickCeil: im.dataset.ceil }; draw();
    }));
    world.querySelectorAll("[data-order]").forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); if (!build) homeSheet(+b.dataset.order); }));
    world.querySelectorAll("[data-aunty]").forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); if (!build) auntyDoor(); }));
    world.querySelectorAll("[data-cart]").forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); if (!build) cartSheet(); }));
    world.querySelectorAll("[data-plot]").forEach((b) => b.addEventListener("click", (e) => {
      if (potionMode && !build) {                                    // (2026-11-07) the Fresh potion works on a plot that's gone over
        e.stopPropagation();
        const r = act("usePotion", { kind: potionMode, plot: +b.dataset.plot });
        if (r && r.ok) { toast(r.msg); potionMode = null; document.body.classList.remove("nc-potion"); }
        return;
      }
      if (!build) { e.stopPropagation(); return plotSwept ? undefined : plotTap(+b.dataset.plot, e); }
      // in Buy's street tabs with nothing in hand: pick the plot (to move or fill in); holding something, the click goes to the ground
      if (build.street && !build.placeDecor && !build.moveDecor && !build.placePlot && !build.movePlot) { e.stopPropagation(); build = { ...streetHome(), pickPlot: +b.dataset.plot }; draw(); }
    }));
    world.querySelectorAll("[data-decor]").forEach((im) => { if (im.dataset.decor) im.addEventListener("click", (e) => {
      if (!build && im.classList.contains("nc-coop")) { e.stopPropagation(); return coopTap(+im.dataset.decor); }
      if (!build && im.classList.contains("nc-stall")) { e.stopPropagation(); return stallTap(+im.dataset.decor); }
      if (!build && im.classList.contains("nc-shop")) { e.stopPropagation(); bookAt = { sec: null, i: 0 }; return furnitureStore(); }
      if (!build && im.classList.contains("nc-home")) { e.stopPropagation(); return homeSheet(+im.dataset.decor); }
      if (!build && im.classList.contains("nc-haunt")) {
        e.stopPropagation();
        // (Cam, 2026-11-01) a house that opens to the public (C.HAUNT): its own sheet, except while its event is on
        const dc = state.decor.find((o) => o.uid === +im.dataset.decor), hv = dc && C.view(state, now());
        if (dc && C.HAUNT[dc.id] && !(hv.event && hv.event.on && im.dataset.house === hv.event.id)) return hauntSheet(dc.id);
        evAt = im.dataset.house || "halloween"; return eventBook();
      }
      if (!build || !build.street || build.placeDecor || build.moveDecor) return;
      e.stopPropagation();
      const dc = state.decor.find((o) => o.uid === +im.dataset.decor);
      if (e.altKey && dc) { build = { ...streetHome(), placeDecor: dc.id, dir: dc.dir | 0, scale: dc.scale | 0 }; hoverP = null; toast(`Another ${C.DECO[dc.id].name.toLowerCase()} -- click the ground.`); return draw(); }   // N49 i13
      build = { ...streetHome(), pickDecor: +im.dataset.decor }; draw();
    }); });
    // on the whole view, not just the café's box: the ground beyond lets clicks through to it (PT47: "can't place far away")
    const view_ = $("nc-main");
    view_.onmousemove = (e) => {
      if (build && build.terrain && build.brush && !stroke) { brushAt = groundAt(v, e, true); return drawTerrain(C.view(state, now())); }
      if (build && build.street) {
        if (!(build.placeDecor || build.moveDecor || build.placePlot || build.movePlot)) return;
        const g = groundAt(v, e);
        if (hoverP && g.x === hoverP.x && g.y === hoverP.y) return;
        hoverP = g;
        return drawWorld(C.view(state, now()));
      }
      if (build && (build.hang || build.moveHang)) {             // hanging a painting: the panel under the pointer
        const w = e.target.closest && e.target.closest("[data-wall]"), key = w ? w.dataset.wall : null;
        if (key === hoverW) return;
        hoverW = key;
        return drawWorld(C.view(state, now()));
      }
      if (build && build.walls && build.paper) {                 // papering: the panel under the pointer, drag along a wall
        const w = e.target.closest && e.target.closest("[data-wall]"), key = w ? w.dataset.wall : null;
        if (key && e.buttons === 1 && key !== hoverW) act("wallPaint", { id: build.paper, side: key[0], i: +key.slice(1) }, true);
        if (key === hoverW) return;
        hoverW = key;
        return drawWorld(C.view(state, now()));
      }
      if (build && build.hwalls && (build.style || build.erase)) {   // (2026-11-08) the line under the pointer
        if (hwDrag) return;
        const w = edgeAt(v, e);
        if (hoverE && w.x === hoverE.x && w.y === hoverE.y && w.dir === hoverE.dir) return;
        hoverE = { x: w.x, y: w.y, dir: w.dir };
        return drawWorld(C.view(state, now()));
      }
      if (build && build.paint) {
        const t = tileAt(v, e, true);
        if (t && e.buttons === 1 && !(hover && t.x === hover.x && t.y === hover.y)) act("floorPaint", { id: build.paint, x: t.x, y: t.y }, true);
        if ((t && hover && t.x === hover.x && t.y === hover.y) || (!t && !hover)) return;
        hover = t;
        return drawWorld(C.view(state, now()));
      }
      if (!build || !(build.place || build.move || build.ceil || build.moveCeil)) return;
      const t = tileAt(v, e);
      if ((t && hover && t.x === hover.x && t.y === hover.y) || (!t && !hover)) return;
      hover = t;
      drawWorld(C.view(state, now()));
    };
    view_.onclick = (e) => {
      if (!build) return;
      if (build.street) {
        if (build.placeDecor || build.moveDecor) return dropDecorAt(groundAt(v, e));
        if (build.placePlot || build.movePlot) return dropPlotAt(groundAt(v, e));
        if (build.pickDecor || build.pickPlot) { build = streetHome(); draw(); }
        return;
      }
      if (build.paint) { const t = tileAt(v, e, true); if (t) act("floorPaint", { id: build.paint, x: t.x, y: t.y }); return; }
      if (build.walls) { const w = e.target.closest && e.target.closest("[data-wall]"); if (w && build.paper) act("wallPaint", { id: build.paper, side: w.dataset.wall[0], i: +w.dataset.wall.slice(1) }); return; }
      if (build.hang || build.moveHang) {                           // V22: a painting onto the panel clicked
        const w = e.target.closest && e.target.closest("[data-wall]");
        if (!w) return;
        const k = w.dataset.wall, r = build.hang ? act("hang", { id: build.hang, side: k[0], i: +k.slice(1), photo: build.photo }) : act("moveHang", { from: build.moveHang, side: k[0], i: +k.slice(1) });
        // (PT56: a painting, wall thing or frame stays in your hand for another while there's one to have)
        if (r && r.ok) { buyTab = C.PAINTING[build.hang || state.hang[k]].light ? "lighting" : "decor"; build = build.hang && C.canHang(state, build.hang) ? { on: true, hang: build.hang, photo: build.photo } : { on: true }; hoverW = null; draw(); }
        return;
      }
      if (build.place || build.move) return dropItemAt(tileAt(v, e));
      if (build.ceil || build.moveCeil) {                           // (2026-10-24) a ceiling light over the tile clicked
        const t = tileAt(v, e);
        if (!t) return;
        const r = build.ceil ? act("ceilPut", { id: build.ceil, x: t.x, y: t.y }) : act("ceilMove", { from: build.moveCeil, x: t.x, y: t.y });
        if (r && r.ok) { build = build.ceil && C.canCeil(state, build.ceil) ? { on: true, ceil: build.ceil } : { on: true }; hover = null; draw(); }
        return;
      }
      if (build.pick || build.pickCeil) { build = { on: true }; draw(); }
    };
  }
  /** Can another of this kind be had right now (from storage, or bought)? (N49 i1/i13) */
  function canHave(v, kind) {
    const sh = v.shop.find((x) => x.kind === kind);
    return (v.ware[kind] || 0) > 0 || !!(sh && v.level >= sh.level && sh.have < sh.allowed && v.coins >= sh.price);
  }
  /** Put the thing in your hand down on a tile. A new one comes from storage, or is bought as it's put down (N49 i1:
      another of the same stays in your hand while there's one to have -- Esc or a right-click puts it away). */
  function dropItemAt(t) {
    if (!t || !(build.place || build.move)) return false;
    const v = C.view(state, now()), dir = heldDir(v);
    hover = t;
    if (build.move) {
      const r = act("move", { uid: build.move, x: t.x, y: t.y, dir });
      if (r && r.ok) { build = { on: true }; hover = null; draw(); }
      return !!(r && r.ok);
    }
    const kind = build.place, why = ghostWhy(v, kind, dir);
    if (why) { toast(why, true); return false; }
    let bought = false;
    if (!(state.ware[kind] > 0)) { const b = act("buy", { kind }); if (!b || !b.ok) return false; bought = true; }
    const r = act("place", { kind, x: t.x, y: t.y, dir, scale: build.scale | 0 });
    if (!r || !r.ok) return false;
    if ((bought || build.fresh) && undo.length > 1) undo.splice(-1, 1);   // one Ctrl+Z puts back both the buying and the placing
    const vv = C.view(state, now());
    build = canHave(vv, kind) ? { on: true, place: kind, dir: build.dir, turned: build.turned, scale: build.scale | 0 } : { on: true };
    draw();
    return true;
  }
  /** N47 a6 (Cam: "click and drag to place a fence ... the plow tool to operate the same way"): with a fence or the plow
      in your hand, press, drag along the ground and let go -- a straight row (along whichever way you dragged further),
      each fence piece turned along it, as close as they may stand; the plow one plot a tile. */
  function lineHeld() {
    return !!(build && build.street && (build.placePlot || (build.placeDecor && C.DECO[build.placeDecor] && C.DECO[build.placeDecor].fence)));
  }
  function linePoints(a, b) {
    const ax = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y), out = [];
    if (build.placePlot) {
      const x0 = Math.floor(a.x), y0 = Math.floor(a.y), n = ax ? Math.floor(b.x) - x0 : Math.floor(b.y) - y0, sg = n < 0 ? -1 : 1;
      for (let i = 0; i <= Math.min(Math.abs(n), 40); i++) out.push(ax ? { x: x0 + i * sg, y: y0 } : { x: x0, y: y0 + i * sg });
      return { pts: out, dir: ax ? 0 : 1 };
    }
    // a fence (PT56): from the corner you pressed on (an end post, to carry on another way) to the corner you're over,
    // a segment a tile
    const ca = { x: Math.round(a.x), y: Math.round(a.y) }, d = ax ? Math.round(b.x) - ca.x : Math.round(b.y) - ca.y, sg = d < 0 ? -1 : 1;
    for (let i = 0; i < Math.min(Math.abs(d), 60); i++) out.push(ax ? { x: ca.x + (i + 0.5) * sg, y: ca.y } : { x: ca.x, y: ca.y + (i + 0.5) * sg });
    return { pts: out, dir: ax ? 0 : 1 };
  }
  /** Put the whole row down as one move (one undo): piece by piece till one can't go (the money, the room, the plots). */
  function lineDrop() {
    const L = line; line = null;
    if (!L || !L.pts || L.pts.length < (build.placePlot ? 2 : 1)) return false;
    const before = state;
    let done = 0, why = "";
    for (const q of L.pts) {
      const r = build.placePlot ? C.act(state, "plow", { x: q.x, y: q.y }, now()) : C.act(state, "decorPlace", { id: build.placeDecor, x: q.x, y: q.y, dir: L.dir, free: freePlace, scale: build.scale | 0 }, now());
      if (!r.ok) { why = r.error; break; }
      state = r.state; done++;
      (r.events || []).forEach(happened);
    }
    if (done) { undo.push(before); if (undo.length > 30) undo.shift(); save(); cue("place"); } else cue("no");
    const what = build.placePlot ? "plot" : C.DECO[build.placeDecor].name.toLowerCase();
    toast(done ? `${done} ${what}${done > 1 ? "s" : ""} down${why ? ` -- then: ${why}` : ""}` : why, !done);
    const vv = C.view(state, now()), id = build.placeDecor;
    if (build.placePlot) build = vv.field && vv.field.have < vv.field.allowed && state.coins >= vv.field.price ? { on: true, street: true, farm: true, placePlot: true } : streetHome();
    else build = vv.dware[id] || vv.coins >= C.DECO[id].price ? { ...streetHome(), placeDecor: id, dir: L.dir, scale: build.scale | 0 } : streetHome();
    hoverP = null; draw();
    return true;
  }
  /** The plow (2026-10-22): dig a plot on the tile clicked -- the plow stays in your hand while there's room for more.
      Or put down a plot being moved. */
  function dropPlotAt(g) {
    if (!g) return false;
    const x = Math.floor(g.x), y = Math.floor(g.y);
    if (build.movePlot) { const r = act("plotMove", { uid: build.movePlot, x, y }); if (r && r.ok) { build = streetHome(); draw(); } return !!(r && r.ok); }
    const r = act("plow", { x, y });
    if (r && r.ok) { const f = C.view(state, now()).field; build = f.have < f.allowed && state.coins >= f.price ? { on: true, street: true, farm: true, placePlot: true } : streetHome(); draw(); }
    return !!(r && r.ok);
  }
  function dropDecorAt(g) {
    if (!g || !(build.placeDecor || build.moveDecor)) return false;
    const r = build.placeDecor ? act("decorPlace", { id: build.placeDecor, x: g.x, y: g.y, dir: build.dir || 0, free: freePlace, scale: build.scale | 0 }) : act("decorMove", { uid: build.moveDecor, x: g.x, y: g.y, dir: build.dir, free: freePlace });
    // placing again straight after is the usual thing (a row of lamps): stay on the same thing while there's more
    if (r && r.ok) { const id = build.placeDecor, vv = C.view(state, now()); build = id && (vv.dware[id] || (!C.DECO[id].vale && vv.coins >= C.DECO[id].price)) ? { ...streetHome(), placeDecor: id, dir: build.dir, scale: build.scale | 0 } : streetHome(); draw(); }
    return !!(r && r.ok);
  }

  /** A home's order (2026-10-24): what they'd like, what it pays, what you have on the counters -- and Deliver. */
  const HOME_WHO = ["the Bakers", "the Fletchers", "the Wrens", "old Mrs Hale", "the Ashdowns", "the Pipers", "Mr Thorne", "the Larkins"];
  // (Cam, 2026-11-01): the haunted house out of season -- open it to the public, then it takes visitors every night
  const hourAt = (h) => `${h % 12 || 12} ${h < 12 ? "am" : "pm"}`;
  function hauntSheet(id) {
    const v = C.view(state, now()), H = v.haunts.find((x) => x.id === id);
    if (!H) return;
    const when = `${hourAt(H.from)} to ${hourAt(H.to)}`;
    const body = H.bought
      ? `<p>${H.on ? `<b>Open now</b> -- visitors walk in from the street every so often, ${coins(H.fee)} each.` : `Open every night from <b>${when}</b>. ${v.event && v.event.on && v.event.id === "halloween" ? "" : `Visitors pay ${coins(H.fee)} each to go in.`}`}</p>
         <p class="nc-hs-pay">${num(H.visitors)} visitors so far · ${coins(H.earned)}</p>
         <p class="nc-hs-count">Through Halloween it's the candy store instead.</p>
         <div class="nc-row"><button class="nc-btn" data-close>Close</button></div>`
      : `<p>Open it to the public: every night from <b>${when}</b>, visitors come in off the street (through your cobweb arch, if it's near) and pay ${coins(H.fee)} each to go in -- about ${num(Math.round((((H.to - H.from + 24) % 24) * 3600) / H.gap))} a night.</p>
         <p class="nc-hs-count">Through Halloween it stays the candy store.</p>
         <div class="nc-row"><button class="nc-btn" data-haunt ${v.coins < H.price ? "disabled" : ""}>Open it ${coins(H.price)}</button><button class="nc-btn ghost" data-close>Later</button></div>`;
    const m = modal(`<img class="nc-hs-dish" alt="" src="${art(propPic(id))}"><h3 class="nc-sub">${esc(H.name)}</h3>${body}`, "small home haunt");
    const b = m.querySelector("[data-haunt]");
    if (b) b.addEventListener("click", () => confirmBox(`Open ${H.name.toLowerCase()} to the public for ${num(H.price)} coins?`, () => { const r = act("hauntOpen", { id }); if (r && r.ok) { toast("🏚️ " + r.msg); hauntSheet(id); } }));
  }
  function homeSheet(uid) {
    const v = C.view(state, now()), o = v.decor.find((d) => d.uid === uid), hs = (v.homes || {})[uid];
    if (!o) return;
    const who = HOME_WHO[uid % HOME_WHO.length], name = C.DECO[o.id].name;
    let body;
    if (hs && hs.order) {
      const od = hs.order, ok = od.have >= od.n;
      body = `<img class="nc-hs-dish" alt="" src="${art("dish-" + od.dish.id)}"><p>${esc(who.charAt(0).toUpperCase() + who.slice(1))} at the ${esc(name.toLowerCase())} would like <b>${od.n} × ${esc(od.dish.name)}</b> delivered.</p>
        <p class="nc-hs-pay">${coins(od.value)} <span>+${od.xp} XP</span></p><p class="nc-hs-have${ok ? "" : " lack"}">You have ${od.have} on your counters${ok ? "" : ` -- cook ${od.n - od.have} more`}.</p>
        <div class="nc-row"><button class="nc-btn" data-deliver ${ok ? "" : "disabled"}>Deliver</button><button class="nc-btn ghost" data-close>Later</button></div>`;
    } else {
      const left = hs ? Math.max(0, hs.next - now()) : 0;
      body = `<p>${hs && hs.done >= v.homeCap ? `${esc(who)} have had all they need today -- ${v.homeCap} orders. More tomorrow.` : `Nothing yet -- ${esc(who)} will ask for something ${left > 60000 ? `in about ${Math.round(left / 60000)} minutes` : "any moment now"}.`}</p><div class="nc-row"><button class="nc-btn" data-close>OK</button></div>`;
    }
    const m = modal(`<h3 class="nc-sub">${esc(name)}</h3>${body}<small class="nc-hs-count">${hs ? hs.done : 0} of ${v.homeCap} orders today</small>`, "small home");
    const b = m.querySelector("[data-deliver]");
    if (b) b.addEventListener("click", () => { const r = act("deliver", { uid }); if (r && r.ok) { close(); toast("🚚 " + r.msg); } });
  }
  // ---- a recipe in hand (2026-10-25, Cam: "that selected recipe to stay active so i can select multiple stoves"): cook
  // from the book and the dish stays held -- click (or sweep over) free stoves to cook it on each; Esc puts it down and
  // opens the book on it again. Build mode, a potion or the tutorial let go of it.
  // (2026-10-26, Cam: "I want the seed sowing to work like the cookbook"): Giles's seeds are held the same way -- click
  // (or sweep over) empty plots to sow each; Esc opens his book on it again, the little cross puts it down
  let hold = null;                                                // {dish, on: the kind of cooker it's cooked on} | {seed: crop}
  function holdStart(id, seed) {
    const D = seed ? C.CROP[id] : C.DISH[id];
    if (!D || (state && C.view(state, now()).tut)) return;
    hold = seed ? { seed: id } : { dish: id, on: C.cookerOf(D) };
    let el = $("nc-hold");
    if (!el) { el = document.createElement("div"); el.id = "nc-hold"; el.className = "nc-holdchip"; document.body.appendChild(el); }
    const what = seed ? "Click or drag over empty plots to sow it" : `Click ${hold.on === "stove" ? "free stoves" : `a free ${esc(C.THINGS[hold.on].name.toLowerCase())}`} to cook it`;
    el.innerHTML = `<img alt="" src="${art(seed ? "crop-" + id + "-4" : "dish-" + id)}"><span><b>${esc(D.name)}</b><small>${what} · Esc: back to the book</small></span><button class="nc-holdx" aria-label="Put it down" title="Put it down">${CLOSE_IC}</button>`;
    el.querySelector(".nc-holdx").addEventListener("click", holdDrop);
    el.hidden = false;
    let css = $("nc-holdcss");
    if (!css) { css = document.createElement("style"); css.id = "nc-holdcss"; document.head.appendChild(css); }
    css.textContent = seed ? `.nc-plot.empty { filter: brightness(1.2) drop-shadow(0 0 4px #f6d27a); } .nc-main, .nc-plot { cursor: copy; }`
      : `.nc-thing.${hold.on}.free > .nc-body { filter: drop-shadow(0 0 4px #f6d27a) drop-shadow(0 0 2px #9a5a22); } .nc-main, .nc-thing { cursor: copy; }`;
  }
  function holdDrop() {
    if (!hold) return;
    hold = null;
    const el = $("nc-hold"), css = $("nc-holdcss");
    if (el) el.hidden = true;
    if (css) css.textContent = "";
  }
  function cookHeld(uid) { act("cook", { uid, dish: hold.dish }); }
  function clickThing(uid, e) {
    const v = C.view(state, now()), it = v.items.find((i) => i.uid === uid);
    if (!it) return;
    if (build && !build.street && e && e.altKey && it.kind !== "till") {     // N49 i13: Alt+click picks up a copy
      if (!canHave(v, it.kind)) return toast(`No more ${C.THINGS[it.kind].name.toLowerCase()}s to have just now (your level's number, or the coins).`, true);
      build = { on: true, place: it.kind, dir: it.dir, turned: true }; hover = null;
      toast(`Another ${C.THINGS[it.kind].name.toLowerCase()} -- click a tile.`);
      return draw();
    }
    if (build) { if (build.street) return; build = { on: true, pick: uid }; draw(); return; }
    if (potionMode) {                                               // V23: a potion from the Inventory, on this
      const r = act("usePotion", { kind: potionMode, uid });
      if (r && r.ok) { toast(r.msg); potionMode = null; document.body.classList.remove("nc-potion"); }
      return;
    }
    if (C.cooks(it)) {
      const s = it.stove.status;
      if (s === "free") {
        if (hold) { if (it.kind === hold.on) return cookHeld(uid); holdDrop(); return cookbook(uid); }
        // N49 i9: a second click straight after (a double-click) cooks the dish it cooked last; one click opens the cookbook
        const last = it.last && C.DISH[it.last];
        if (!last) return cookbook(uid);
        if (stoveTap && stoveTap.uid === uid) { clearTimeout(stoveTap.t); stoveTap = null; return sameAgain(uid); }
        stoveTap = { uid, t: setTimeout(() => { stoveTap = null; cookbook(uid); }, 280) };
        return;
      }
      if (s === "ready") return act("serve", { uid });
      if (s === "burnt") return act("throw", { uid });
      if (s === "dirty") return act("clean", { uid });
      if (v.tut) return toast(`${it.stove.dish.name}: ${clock(it.stove.left)} to go.`);
      const dn = it.stove.dish;
      return confirmBox(`${dn.name}: ${clock(it.stove.left)} to go. Cancel it? The stove is free again${it.stove.paid ? `, but the ${num(it.stove.paid)} coins it cost are gone` : ""}.`, () => { const r = act("cancel", { uid }); if (r && r.ok) toast(r.msg); });
    }
    if (it.dry) return refill({ uid });                            // V26 q1: run dry -- a click refills it
    if (it.kind === "till") return act("collect", {});
    if (C.isVend(it)) return act("vendCollect", { uid });
    if (it.tip || it.candy) return act("tip", { uid });
    if (C.MACHINES[it.kind]) return act("machineCollect", { uid });
    if (C.THINGS[it.kind] && C.THINGS[it.kind].pantry) return pantryBook();
    if (C.THINGS[it.kind] && C.THINGS[it.kind].lamp) return pullCord(uid);
    if (C.isSeat(it)) return toast(it.seat ? "A seat: customers sit here to eat, and may leave a tip on the table." : "Turn it to face a table to make it a seat.");
    if (it.kind === "counter" || it.kind === "buffet" || C.isShelf(it)) return counterSheet(uid);
  }

  /** V26 q1: refill a machine, a counter's espresso beans, a cart or the cinema -- its coins out, less the cut. */
  function refill(o) { const r = act("refill", o); if (r && r.ok) toast(r.msg); }
  /** A cart or the cinema clicked: refill it when it's dry, else take its coins. */
  function stallTap(uid) {
    const o = C.view(state, now()).decor.find((d) => d.uid === uid);
    if (!o || !o.stall) return;
    if (o.stall.dry) return refill({ decor: uid });
    // (Cam, 25 Oct: no message at the top when collecting -- the coins float up from the cart, and that says it)
    if (o.stall.coins) { act("stallCollect", { uid }); return; }
    const C0 = C.CARTS[o.id];
    toast(C0 ? `${C.DECO[o.id].name}: sells from ${hr(C0.from)} to ${hr(C0.to)}, coins waiting in it till you collect them.` : "The cinema shows a film at 7, 9 and 11 pm -- benches and picnic tables near it fill the seats.");
  }
  /** A stall's word above it, and its whole story for the tooltip. */
  function stallShort(o) {
    const C0 = C.CARTS[o.id];
    if (!C0) return new Date(now()).getHours() >= 19 ? "Film on" : "Films 7, 9, 11 pm";
    return o.stall.selling ? "Selling…" : `Opens ${hr(C0.from)}`;
  }
  function stallSays(o) {
    const C0 = C.CARTS[o.id], nm = C.DECO[o.id].name;
    if (o.stall.dry) return `${nm}: sold out -- click to restock (the coins in it come out, less 20%)`;
    if (!C0) return `${nm}: films at 7, 9 and 11 pm; benches and picnic tables within 4 tiles fill its seats${o.stall.coins ? ` -- ${o.stall.coins} coins, click to take them` : ""}`;
    return `${nm}: sells from ${hr(C0.from)} to ${hr(C0.to)} on its own, ${C0.coins} coins every 5 minutes while the café's open${o.stall.coins ? ` -- ${o.stall.coins} coins in it, click to take them` : o.stall.selling ? " -- selling now" : " -- closed till then"}`;
  }
  const hr = (h) => h % 24 === 0 ? "midnight" : h === 12 ? "noon" : h < 12 ? h + " am" : (h - 12) + " pm";
  /** A lamp's pull cord (2026-10-24): on or off, with a little tug. */
  function pullCord(uid) {
    const r = act("light", { uid });
    const el = r && r.ok && document.querySelector(`.nc-thing[data-uid="${uid}"]:not(.ghost)`);
    if (el) { el.classList.add("pull"); setTimeout(() => el.classList.remove("pull"), 350); }
  }

  // ---- customers walking (positions worked out from the clock) ------------------------------------------
  const LOOK = { woman: "woman", oldman: "oldman", boy: "boy", dracula: "dracula", frank: "frank", witch: "witch", pumpkinhead: "pumpkinhead" };   // (V25 q7: the Halloween guests)
  /** Where along a walk (points in tiles, middles of tiles at +0.5) someone is at t, going at an even pace. */
  function along(pts, t0, t1, t) {
    const last = pts[pts.length - 1];
    if (pts.length < 2 || t1 <= t0) return { x: last.x, y: last.y, dx: 0, dy: 0 };
    const len = C.lengthOf(pts);
    let d = Math.max(0, Math.min(1, (t - t0) / (t1 - t0))) * len;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], l = Math.hypot(b.x - a.x, b.y - a.y);
      if (d <= l || i === pts.length - 1) { const f = l ? Math.min(1, d / l) : 1; return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, dx: b.x - a.x, dy: b.y - a.y }; }
      d -= l;
    }
    return { x: last.x, y: last.y, dx: 0, dy: 0 };
  }
  const mids = (pts) => pts.map((p) => ({ x: p.x + 0.5, y: p.y + 0.5 }));
  function where(v, c, t) {
    // in along the pavement, through the door, to the counter; then the till; then out and off along the street
    const door = [{ x: -0.5, y: v.door + 0.5 }];
    const a = (c.si || door).concat(mids(c.a)), o = mids(c.o).concat(c.so || door);
    if (t < c.take - 600) return along(a, c.at, c.take - 600, t);
    // waiting at the counter (its plate's tile), then the till: facing it
    const facing = (p, cell) => ({ x: p.x, y: p.y, dx: cell ? Math.sign(cell.x + 0.5 - p.x) : 1, dy: cell && cell.x + 0.5 === p.x ? Math.sign(cell.y + 0.5 - p.y) : 0, still: true });
    const ci = v.items.find((i) => i.uid === (c.counter || c.vend)), till = v.items.find((i) => i.kind === "till");
    if (t < c.take) {
      const fp = facing(a[a.length - 1], ci && (ci.cells[c.p || 0] || ci.cells[0]));
      // V25 q3: at a reader's table, sat on the floor in front of it for the reading
      if (c.vend && ci && C.THINGS[ci.kind] && C.THINGS[ci.kind].reader && t >= c.take - (C.MACHINES[ci.kind].stay || 0) + 800) {
        const k = C.FACE.findIndex((f) => f[0] === fp.dx && f[1] === fp.dy);
        return Object.assign({}, fp, { sitting: { kind: "cushion", sitDir: k < 0 ? 0 : k } });
      }
      return fp;
    }
    if (t < c.pay - 800) return along(mids(c.b), c.take, c.pay - 800, t);
    if (t < c.pay) return facing(mids(c.b)[c.b.length - 1], till);
    // to a seat, sat at the table to eat, then out (2026-10-21)
    if (c.seat && c.s) {
      const ch = v.items.find((i) => i.uid === c.seat);
      if (t < c.sit) return along(mids(c.s), c.pay, c.sit, t);
      // on a sofa, their own half of it (c.sp)
      if (t < c.up && ch) { const f = C.FACE[(ch.sitDir != null ? ch.sitDir : ch.dir) % 4], sp = (ch.cells && ch.cells[c.sp || 0]) || ch; return { x: sp.x + 0.5, y: sp.y + 0.5, dx: f[0], dy: f[1], still: true, sitting: ch, spot: sp }; }
      return along(o, c.up, c.gone, t);
    }
    // (2026-10-24) takeaway eaten on a bench outside: out to it, sat a while, then off down the street
    if (c.bench) {
      const b = c.bench;
      if (t < c.bsit) return along(o, c.pay, c.bsit, t);
      if (t < c.bup) return { x: b.x, y: b.y, dx: 0, dy: 0, still: true, sitting: { kind: "bench", sitDir: b.face, bx: b.bx, by: b.by, picnic: b.kind === "picnic" }, bench: b };
      return along(c.so2, c.bup, c.gone, t);
    }
    return along(o, c.pay, c.gone, t);
  }
  /** (Cam, 2026-11-01) the haunted house's visitors: in from the street, through the nearest cobweb arch, up to the house
      and gone inside -- one for every visitor the coins are counted for (C.hauntArrive: the same times). */
  let hauntRoute = null, hauntPaid = {};
  function hauntWalkers(v, t, box, seen) {
    (v.haunts || []).forEach((H) => {
      if (!H.bought || !H.placed) return;
      const o = state.decor.find((d) => d.id === H.id);
      if (!o) return;
      const key = JSON.stringify([o.x, o.y, o.dir, state.decor.filter((d) => d.id === "hw_spiderarch").map((d) => [d.x, d.y]), walkKey]);
      if (!hauntRoute || hauntRoute.key !== key) hauntRoute = { key, ...hauntPath(o) };
      const R = hauntRoute;
      if (!R.pts) return;
      const g = H.gap * 1000, len = R.len, el = document.querySelector(`[data-decor="${o.uid}"]`);
      for (let k = Math.floor((t - len) / g) - 1; k * g <= t; k++) {
        const a = C.hauntArrive(H.id, k);
        if (!C.hauntOn(state, H.id, a)) continue;
        if (t >= a) { if (t - a < 2500 && !hauntPaid[k] && el) { hauntPaid[k] = 1; floatAt(el, `+${H.fee}`, "coin"); } continue; }
        if (t < a - len) continue;
        const id = "hv" + k;
        personAt(box, id, ["woman", "oldman", "boy"][k % 3], along(R.pts, a - len, a, t), v, "");
        seen[id] = 1;
      }
    });
  }
  function hauntPath(o) {
    const F = C.footOf(o.id, o.x, o.y, o.dir | 0), cx = (F.x0 + F.x1) / 2, cy = (F.y0 + F.y1) / 2;
    const doors = [{ x: F.x1 + 0.2, y: cy }, { x: cx, y: F.y1 + 0.2 }, { x: F.x0 - 0.2, y: cy }, { x: cx, y: F.y0 - 0.2 }];
    const arch = state.decor.filter((d) => d.id === "hw_spiderarch").map((d) => ({ x: d.x, y: d.y, d: Math.hypot(d.x - cx, d.y - cy) })).filter((d) => d.d < 10).sort((a, b) => a.d - b.d)[0];
    let pts = null;
    if (arch) {
      const door = doors.slice().sort((a, b) => Math.hypot(a.x - arch.x, a.y - arch.y) - Math.hypot(b.x - arch.x, b.y - arch.y))[0], come = C.benchOut(state, arch.x, arch.y);
      if (come) pts = come.slice().reverse().concat(C.streetPath(state, [{ x: arch.x, y: arch.y }, door]).slice(1));
    }
    if (!pts) pts = doors.map((d) => C.benchOut(state, d.x, d.y)).filter(Boolean).map((p) => p.slice().reverse()).sort((a, b) => C.lengthOf(a) - C.lengthOf(b))[0] || null;
    // (only the last stretch: from the street's far end is a long walk)
    if (pts) { let left = 14, i = pts.length - 1; while (i > 0) { const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); if (d >= left) { const f = left / d; pts = [{ x: pts[i].x + (pts[i - 1].x - pts[i].x) * f, y: pts[i].y + (pts[i - 1].y - pts[i].y) * f }].concat(pts.slice(i)); break; } left -= d; i--; } }
    return { pts, len: pts ? C.lengthOf(pts) * 1000 / C.WALK : 0 };
  }
  /** Passers-by who stop for a sit (2026-10-24): every so often (a slot of BENCH_SLOT), by each free place outside, someone
      walks up from the pavement, sits a while and walks on -- from the clock alone, so it's the same each time it's drawn. */
  const BENCH_SLOT = 150 * 1000, BENCH_PASS = 0.3;
  const hash01 = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 10000) / 10000; };
  function benchSitters(v, t, taken) {
    const out = [], slot = Math.floor(t / BENCH_SLOT), u = t - slot * BENCH_SLOT;
    C.benchPlaces(state).forEach((b) => {
      if (taken[b.key] || hash01(b.key + ":" + slot) >= BENCH_PASS) return;
      const back = C.benchOut(state, b.ax, b.ay);
      if (!back) return;                                         // (fenced in: no one can get to it)
      const come = back.slice().reverse(), len = C.lengthOf(back) * 1000 / C.WALK;
      const walkIn = Math.min(len, 30000), sitFor = 45000 + hash01(b.key + "s" + slot) * 40000, start = hash01(b.key + "t" + slot) * Math.max(0, BENCH_SLOT - 2 * walkIn - sitFor);
      const k = u - start, id = "b" + b.key.replace(":", "-") + "-" + slot, look = ["woman", "oldman", "boy"][Math.floor(hash01(id) * 3)];
      // (they come only the last stretch of the way -- from the street's end is a long walk)
      const near = come.slice(Math.max(0, come.length - 2));
      if (k < 0 || k >= 2 * walkIn + sitFor) return;
      if (k < walkIn) out.push({ id, look, p: along(near, 0, walkIn, k) });
      else if (k < walkIn + sitFor) out.push({ id, look, p: { x: b.x, y: b.y, dx: 0, dy: 0, still: true, sitting: { kind: "bench", sitDir: b.face, bx: b.bx, by: b.by, picnic: b.kind === "picnic" } } });
      else out.push({ id, look, p: along(back, walkIn + sitFor, walkIn + sitFor + len, k) });
    });
    return out;
  }
  // people walking by (2026-10-21): along the four pavements and round our corner, each on their own loop of the clock
  const WALKS = (() => {
    const F = 15, n = -0.6, f = 2 * -(1.2 + 0.12 + 1.14) + 0.6;      // our pavements' middles, and the far side's
    const routes = [
      [{ x: n, y: F }, { x: n, y: n }, { x: F, y: n }],
      [{ x: n, y: F }, { x: n, y: -F }],
      [{ x: F, y: n }, { x: -F, y: n }],
      [{ x: f, y: F }, { x: f, y: -F }],
      [{ x: F, y: f }, { x: -F, y: f }],
      [{ x: f, y: F }, { x: f, y: f }, { x: -F, y: f }]
    ];
    const out = [];
    for (let k = 0; k < 9; k++) {
      const r = routes[k % routes.length], back = k % 2 === 1, speed = 1.0 + ((k * 37) % 7) / 12;
      const pts = back ? r.slice().reverse() : r, len = C.lengthOf(pts);
      out.push({ id: "w" + k, look: ["woman", "oldman", "boy"][k % 3], pts, walk: len / speed * 1000, cycle: (len / speed + 4 + ((k * 53) % 17)) * 1000, phase: (k * 7919) % 30000 });
    }
    return out;
  })();
  // 2026-10-25 (Cam: "the people will need collision with the houses so they dont walk through them and that the
  // house dont layer over them"): the walkers' loops go round anything set across them (C.streetPath), worked out again
  // whenever what's outside changes; and a house, drawn at its front corner, is a box on the ground -- someone beyond
  // its front faces is drawn over it, someone behind its back faces under it, whatever the one-point depth says.
  let walkKey = null, walkDecor = null;
  function walkRoutes(v) {
    if (state.decor === walkDecor && walkKey) return;                  // (unchanged since the last frame: no work)
    walkDecor = state.decor;
    const key = JSON.stringify([v.size, v.cafeW, v.decor.map((o) => [o.id, o.x, o.y, o.dir])]);
    if (key === walkKey) return;
    walkKey = key;
    WALKS.forEach((w) => { w.pts2 = C.streetPath(state, w.pts); w.walk2 = w.walk * C.lengthOf(w.pts2) / C.lengthOf(w.pts); });
  }
  function byHouses(p, outside, z) {
    (state.decor || []).forEach((o) => {
      if (!C.FOOT[o.id] || (o.x < 0 || o.y < 0) !== outside) return;      // (only the houses drawn in the same layer)
      const F = C.footOf(o.id, o.x, o.y, o.dir);
      if (p.x < F.x0 - 2.5 || p.y < F.y0 - 2.5 || p.x > F.x1 + 2.5 || p.y > F.y1 + 2.5) return;   // (too far off to overlap)
      const hz = outside ? 1000 + Math.round((o.x + o.y) * 10) : 10 + Math.round((o.x + o.y - 0.5) * 10) + 5;
      if (p.x >= F.x1 - 0.05 || p.y >= F.y1 - 0.05) z = Math.max(z, hz + 1);
      else if (p.x <= F.x0 + 0.05 || p.y <= F.y0 + 0.05) z = Math.min(z, hz - 1);
    });
    return z;
  }
  /** Where someone sits: their seat's middle -- on a sofa, their half pulled in a little towards its middle (the sofa
      is drawn a bit shorter than its two tiles). 2026-10-24: the sofa pictures are straightened onto the floor's slope
      (cut_cafe_art.py true_sofa), so the pull is the same both ways -- it was mostly up and down for the flatter painting. */
  function seatXY(v, p) {
    const xy = at(v, p.x, p.y), cs = p.sitting.cells;
    if (!cs || cs.length < 2) return xy;
    const a = at(v, cs[0].x + 0.5, cs[0].y + 0.5), b = at(v, cs[1].x + 0.5, cs[1].y + 0.5), m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    return { x: m.x + (xy.x - m.x) * 0.8, y: m.y + (xy.y - m.y) * 0.8 };
  }
  const BENCH_LIFT = 6;                                         // (a bench's seat sits a little higher than a chair's)
  function personAt(box, id, look, p, v, carry) {
    // which way they face, by the way they're going on screen: +x down-right, +y down-left, -x up-left, -y up-right.
    // The pictures: tl walks down-left, tr down-right, ar up-LEFT and al up-RIGHT (as painted on Characters Sheet 01 --
    // PT45: the two away ones were the wrong way round, so people heading up a street walked across it)
    const big = Math.abs(p.dx) >= Math.abs(p.dy);
    const pose = big && p.dx > 0 ? "tr" : !big && p.dy > 0 ? "tl" : big && p.dx < 0 ? "ar" : "al";
    // walking frames when they're painted (Characters Sheet 02, N34): towards you (tl) and away (ar), the other two
    // facings mirrored, four frames a step at 8 a second; till then the one standing picture with a sway
    // painted frames: towards you down-left (tl) and away up-left (ar); down-right and up-right are those mirrored
    const who = LOOK[look] || "woman", base = pose === "tr" ? "tl" : pose === "al" ? "ar" : pose;
    let n = 0;
    while (has(`${who}-${base}-${n + 1}`)) n++;
    // sitting (N36): <who>-sit-f facing down-left, <who>-sit-b facing up-left; the other two mirrored
    if (p.sitting && has(`${who}-sit-f`)) {
      // sat: about three-quarters of their standing height, on the seat
      // a stool (N41): perched higher, with no back to hide behind; <who>-stool-f/-b when painted, else the chair poses
      const stool = !!(C.THINGS[p.sitting.kind] && C.THINGS[p.sitting.kind].stool), ch = (p.sitting.sitDir != null ? p.sitting.sitDir : p.sitting.dir) % 4;
      // V25 q2/q4: on a floor cushion, cross-legged (<who>-floor-f/-b, Characters Sheets 08 and 10) -- till then the chair pose, lower
      const lowSeat = !!(C.THINGS[p.sitting.kind] && C.THINGS[p.sitting.kind].low);
      const fb = ch >= 2 ? "b" : "f", sid = lowSeat && has(`${who}-floor-${fb}`) ? `${who}-floor-${fb}` : stool && has(`${who}-stool-${fb}`) ? `${who}-stool-${fb}` : `${who}-sit-${fb}`;
      const st0 = sized(who + "-tl", 40), sa = ART[sid] || [1, 1], sh = Math.round(st0.h * (sid.includes("-stool-") ? 0.8 : sid.includes("-floor-") ? 0.68 : 0.74)), ss = { w: Math.round(sh * sa[0] / sa[1]), h: sh }, xy0 = seatXY(v, p);
      let e0 = document.querySelector(`.nc-person[data-cid="${id}"]`);
      if (!e0) { e0 = document.createElement("div"); e0.className = "nc-person"; e0.dataset.cid = id; e0.innerHTML = `<img alt=""><span class="nc-carry"></span>`; }
      const bench = p.sitting.kind === "bench", out0 = bench && (p.sitting.bx < 0 || p.sitting.by < 0), home0 = out0 ? $("nc-out") || box : box;
      if (e0.parentNode !== home0) home0.appendChild(e0);
      e0.classList.toggle("nc-outdoor", p.sitting.bx != null);           // (on a bench or picnic table: not in a photo)
      const im0 = e0.firstChild;
      if (im0.dataset.src !== sid) { im0.src = art(sid); im0.dataset.src = sid; }
      // facing away (up-left, up-right) the chair's back is nearer to us than they are: they sit behind it (PT49)
      // on the stool's own poses (Sheet 07, N44) the feet rest on its footrest, about a third of the way up the stool
      // on a sofa both sit level with its nearer end (it's one picture: the far one mustn't drop behind it)
      const sofaZ = (q) => q.sitting.cells && q.sitting.cells.length > 1 ? 10 + Math.max(...q.sitting.cells.map((c) => c.x + c.y)) * 10 : 10 + Math.round((q.x + q.y - 1) * 10);
      const perched = sid.includes("-stool-"), lift = lowSeat ? (sid.includes("-floor-") ? 0 : -12) : !stool ? 0 : perched ? Math.round(sized(p.sitting.kind, THING_W[p.sitting.kind] || THING_W.stool).h * 0.3) : 9;
      // (on a bench outside: sorted with the street things -- in front of it, or behind its back facing away)
      const benchZ = bench ? (out0 ? 1000 + Math.round((p.sitting.bx + p.sitting.by) * 10) : 10 + Math.round((p.sitting.bx + p.sitting.by - 0.5) * 10) + 5) + ((p.sitting.picnic ? ch < 2 : ch >= 2) ? -1 : 2) : 0;   // (facing away on a bench: behind its back; on a picnic table's far side: behind the table)
      Object.assign(e0.style, { left: Math.round(xy0.x - ss.w / 2) + "px", top: Math.round(xy0.y - ss.h + 4 - lift - (bench ? BENCH_LIFT : 0)) + "px", width: ss.w + "px", height: ss.h + "px", zIndex: bench ? benchZ : sofaZ(p) + (ch >= 2 && !stool && !lowSeat ? -1 : 7) });
      e0.classList.toggle("flip", ch % 2 === 1); e0.classList.remove("walk");
      e0.querySelector(".nc-carry").innerHTML = ""; e0.querySelector(".nc-carry").dataset.src = "";
      return;
    }
    const frames = !p.still && n > 1, flip = frames && base !== pose;
    // one step every half second, however many frames it was painted in (two frames is a simple step)
    const pid = frames ? `${who}-${base}-${1 + Math.floor(now() / (500 / n)) % n}` : who + "-" + pose;
    // frames are cut by one box (tools/cut_cafe_art.py FRAME_BOX): the person as tall as standing, the box's middle on
    // their spot and the lowest foot of the step on the ground -- so they walk straight, not side to side
    const stand = sized(who + "-" + pose, 40), xy = at(v, p.x, p.y);
    let s = stand, foot = 1;
    if (frames) {
      const seq = Array.from({ length: n }, (_, i) => META[`${who}-${base}-${i + 1}`] || { top: 0, foot: 1 });
      const tall = Math.max(...seq.map((m) => m.foot - m.top)), a = ART[pid] || [1, 1], h = Math.round(stand.h / tall);
      s = { w: Math.round(h * a[0] / a[1]), h };
      foot = Math.max(...seq.map((m) => m.foot));
    }
    // out on the street they're sorted in with the lamps and trees, behind the café's walls
    const outside = p.x < 0 || p.y < 0, home = outside ? $("nc-out") || box : box;
    let el = document.querySelector(`.nc-person[data-cid="${id}"]`);
    if (!el) { el = document.createElement("div"); el.className = "nc-person"; el.dataset.cid = id; el.innerHTML = `<img alt=""><span class="nc-carry"></span>`; }
    if (el.parentNode !== home) home.appendChild(el);
    el.classList.toggle("nc-outdoor", outside || p.x > C.cafeW(state) || p.y > state.size);   // (out of the café: not in a photo)
    const img = el.firstChild;
    if (img.dataset.src !== pid) { img.src = art(pid); img.dataset.src = pid; }
    // feet on the floor: the picture's bottom (their feet) on the spot they stand on
    el.style.left = Math.round(xy.x - s.w / 2) + "px";
    el.style.top = Math.round(xy.y - s.h * foot + 3 - (p.sitting ? 14 : 0)) + "px";
    el.style.width = s.w + "px";
    el.style.height = s.h + "px";
    // a carried plate: the standing picture's size, at their hands, whatever the frame's box
    el.style.setProperty("--carry-w", Math.round(stand.w * 0.6) + "px");
    el.style.setProperty("--carry-top", Math.round(s.h * foot - stand.h * 0.62) + "px");
    // out on the street they're behind the walls; inside, in front of what's behind them
    el.style.zIndex = byHouses(p, outside, outside ? 1000 + Math.round((p.x + p.y) * 10) + 3 : 10 + Math.round((p.x + p.y - 1) * 10) + 6);
    el.classList.toggle("walk", !p.still && !frames);
    el.classList.toggle("flip", flip);
    const c = el.querySelector(".nc-carry"), want = carry ? art("dish-" + carry) : "";
    if (c.dataset.src !== want) { const k = carry ? dishK(carry) : 1; c.innerHTML = want ? `<img alt="" src="${want}"${k < 1 ? ` style="width:calc(var(--carry-w) * ${k.toFixed(2)});margin-left:calc(var(--carry-w) * ${(-k / 2).toFixed(3)})"` : ""}>` : ""; c.dataset.src = want; }
  }
  /** A seated customer's plate, on the table in front of them -- near their edge of it (two on a sofa share one table). */
  function meal(box, c, ch, v, spot) {
    const f = C.FACE[(ch.sitDir != null ? ch.sitDir : ch.dir) % 4], sp = spot || ch, tb = ch.table || { x: sp.x + f[0], y: sp.y + f[1] };
    const p = at(v, tb.x + 0.5 + (sp.x - tb.x) * 0.22, tb.y + 0.5 + (sp.y - tb.y) * 0.22);
    let el = box.querySelector(`.nc-meal[data-cid="${c.id}"]`);
    if (!el) { el = document.createElement("img"); el.className = "nc-meal"; el.dataset.cid = c.id; el.src = art("dish-" + c.dish); box.appendChild(el); }
    const mw = Math.round(34 * dishK(c.dish));
    el.style.width = mw + "px";
    el.style.left = Math.round(p.x - mw / 2) + "px";
    el.style.top = Math.round(p.y - 46) + "px";
    el.style.zIndex = 10 + Math.round((tb.x + tb.y) * 10) + 8;
    el.dataset.seen = "1";
  }
  /** (2026-10-24, Cam: "food left on the ground") -- outside, the plate goes on the picnic table in front of them, or on
      the bench beside them, not where a café table would be. */
  function benchMeal(box, c, b, v) {
    // a park bench: on their lap -- only seen when they face us; a picnic table: on the table in front of them
    const bench = b.kind !== "picnic";
    if (bench && b.face >= 2) return;
    const k = bench ? 0 : 0.45, x = b.bx + (b.x - b.bx) * (1 - k) * (bench ? 1 : 0) + (bench ? 0 : (b.x - b.bx) * k), y = b.by + (b.y - b.by) * (bench ? 1 : k);
    const p = at(v, bench ? b.x : x, bench ? b.y : y), out = b.bx < 0 || b.by < 0, home = out ? $("nc-out") || box : box;
    let el = document.querySelector(`.nc-meal[data-cid="${c.id}"]`);
    if (!el) { el = document.createElement("img"); el.className = "nc-meal nc-outdoor"; el.dataset.cid = c.id; el.src = art("dish-" + c.dish); }
    if (el.parentNode !== home) home.appendChild(el);
    const bw = Math.round(18 * dishK(c.dish));
    el.style.left = Math.round(p.x - bw / 2) + "px";
    el.style.top = Math.round(p.y - (bench ? 24 + BENCH_LIFT : 40)) + "px";
    el.style.width = bw + "px";
    el.style.zIndex = (out ? 1000 + Math.round((b.bx + b.by) * 10) : 10 + Math.round((b.bx + b.by - 0.5) * 10) + 5) + (bench ? 3 : 1);
    el.dataset.seen = "1";
  }
  function people(v) {
    const box = $("nc-people");
    if (!box) return;
    const t = now(), seen = {};
    v.customers.forEach((c) => {
      if (t < c.at || t >= c.gone) return;
      const wh = where(v, c, t);
      // (Cam, 2026-10-24: no dish held in front of them any more -- it read as food in their belly; the plate shows on
      // the table while they eat)
      personAt(box, c.id, c.look, wh, v, "");
      if (wh.bench) benchMeal(box, c, wh.bench, v);
      else if (wh.sitting) meal(box, c, wh.sitting, v, wh.spot);
      seen[c.id] = 1;
    });
    // (2026-10-24) a delivery: someone from the café walks it round to the home's door and back
    (v.runs || []).forEach((rn) => {
      const o = v.decor.find((d) => d.uid === rn.to), f = o && C.HOME_FOOT[o.id];
      if (!f) return;
      const d = o.dir % 4, door = d === 0 || d === 3 ? { x: o.x - f[0] / 2, y: o.y + 0.35 } : { x: o.x + 0.35, y: o.y - f[0] / 2 };
      const go = C.benchIn(state, door.x, door.y);
      if (!go) return;                                           // (no way round to the door: delivered unseen)
      const len = C.lengthOf(go) * 1000 / C.WALK, u = t - rn.at, id = "run" + rn.at;
      if (u < 0 || u >= 2 * len + 3000) return;
      const p = u < len ? along(go, 0, len, u) : u < len + 3000 ? { x: door.x, y: door.y, dx: 0, dy: -1, still: true } : along(go.slice().reverse(), len + 3000, 2 * len + 3000, u);
      personAt(box, id, "boy", p, v, ""); seen[id] = 1;
    });
    hauntWalkers(v, t, box, seen);
    const takenB = {};
    v.customers.forEach((c) => { if (c.bench && t >= c.at && t < c.gone) takenB[c.bench.key] = 1; });
    benchSitters(v, t, takenB).forEach((q) => { personAt(box, q.id, q.look, q.p, v, ""); seen[q.id] = 1; });
    walkRoutes(v);
    WALKS.forEach((w) => {
      const u = (t + w.phase) % Math.max(w.cycle, w.walk2 + 2000);
      if (u >= w.walk2) return;
      personAt(box, w.id, w.look, along(w.pts2, 0, w.walk2, u), v, "");
      seen[w.id] = 1;
    });
    document.querySelectorAll(".nc-person").forEach((el) => { if (!seen[el.dataset.cid]) el.remove(); });
    document.querySelectorAll(".nc-meal").forEach((el) => { if (el.dataset.seen !== "1") el.remove(); else el.dataset.seen = ""; });
  }

  // ---- the top bar, the build drawer --------------------------------------------------------------------
  /** The customers-a-minute bubble's tip (2026-10-24): each part of what draws them. */
  function popTip(v) {
    const p = v.popularity;
    if (!p) return "Customers a minute";
    const sg = (n) => (n >= 0 ? "+" : "") + n;
    return [`Customers a minute: ${C.RATE.base} to start (at least ${C.RATE.min} while there's food out)`,
      `${sg(p.variety)} variety (${p.dishes} dishes out)`, `${sg(p.stock)} full counters (${p.full})`, `${sg(p.quality)} food quality (${p.stars}★ mastery on average)`,
      `${sg(p.comfort)} comfort (${p.seatN} seats -- armchairs and sofas count most)`, `${sg(p.looks)} the café's looks`, `${sg(p.fun)} entertainment`,
      p.dark ? `${sg(p.light)} lighting (${p.lightN} lights on${p.light < 0 ? " -- too dark" : ""})` : "",
      "Food in a counter's fridge doesn't count -- only what's out", v.rush ? `×${v.rush.x} in the ${v.rush.name.toLowerCase()}` : ""].filter(Boolean).join("\n");
  }
  function drawHud(v) {
    $("nc-name").textContent = v.name || "NeuroCafe";
    const pct = v.max ? 100 : Math.round(100 * (v.xp - v.xpFrom) / Math.max(1, v.xpTo - v.xpFrom));
    // the Open / Closed sign (2026-10-21): always in sight; click to turn it
    $("nc-stats").innerHTML = `<button class="nc-sign ${v.open ? "open" : "closed"}" data-sign title="${v.open ? "Open -- click to close: no new customers" : "Closed -- click to open"}">${v.open ? "Open" : "Closed"}</button>${v.sandbox ? `<span class="nc-sandbox" title="Nothing here touches your café">Sandbox</span>` : ""}<span class="nc-pop" title="${esc(popTip(v))}">☺ ${v.open ? v.perMin : 0}<small>/min</small>${v.rush && v.open ? `<i class="nc-rushx">×${v.rush.x}</i>` : ""}</span><span class="nc-level" title="${v.max ? "Top level" : `${num(v.xp)} / ${num(v.xpTo)} XP`}"><b${v.level >= 100 ? ' class="big"' : ""}>${v.level}</b><span class="nc-xp"><i style="width:${pct}%"></i></span><small>${v.max ? "MAX" : `${num(v.xp - v.xpFrom)} / ${num(v.xpTo - v.xpFrom)} XP`}</small></span>${v.event.on || v.candy ? `<button class="nc-candy" data-candy title="${v.event.on ? `Halloween candy: one for every dish you serve, and sometimes a few left on a table. Spend it at the haunted house till ${v.event.until}.` : "Halloween candy -- when Halloween ends, what's left is baked into Halloween dishes for your counters."}">🍬 ${num(v.candy)}</button>` : ""}${coins(v.coins, "big")}`;
    document.body.classList.toggle("nc-in-sandbox", !!v.sandbox);
    const cb = $("nc-stats").querySelector("[data-candy]");
    if (cb) cb.addEventListener("click", () => v.event.mansion ? mansionShop() : toast(v.event.build ? "🎃 Build the haunted house (Build > Buildings) to spend your candy." : "🎃 The haunted house can only be built from 10 to 31 October."));
    $("nc-stats").querySelector("[data-sign]").addEventListener("click", () => {
      if (v.open) confirmBox("Close the café? No new customers will come in until you open again (those inside finish, and the food waits on the counters).", () => { const r = act("setOpen", { open: false }); if (r && r.ok) toast(r.msg); });
      else { const r = act("setOpen", { open: true }); if (r && r.ok) toast(r.msg); }
    });
    // the round buttons (N43, PT52 -- Cam: "make the cookbook a round button as well ... and another button on the bottom
    // right called settings ... this way we have removed the need for the sidebar"): NeuroPets' old coin for Buy, a maul
    // for Build; the Buy button shows how many things wait in the warehouses
    const stored = Object.values(v.ware || {}).reduce((a, b) => a + b, 0) + Object.values(v.dware || {}).reduce((a, b) => a + b, 0) + Object.values(v.pware || {}).reduce((a, b) => a + b, 0) + Object.values(v.cware || {}).reduce((a, b) => a + b, 0), m = menuOf(build);
    // 2026-10-24 (Cam: "change the round buttons to be tabs on the bottom of the screen that when hovered on will pop up a
    // little to reveal the icon, then clicked to open the respective menu"): a row of tabs along the bottom, each showing
    // its name and, hovered, rising to show its picture; the open one stays up. A drawer open (Build, Buy, the farm):
    // the tabs sit on its top edge, and the open one's tab closes it again.
    // (2026-10-25, Cam: "the tabs at the bottom ... to be moved into top left as a transparent icon like the eye icon in
    // the top right"): a column of see-through round buttons down the top left, in his order; the name shows on hover
    const tab = (k, pic, label, title, on, badge) => `<button class="nc-tab${on ? " on" : ""}" data-menu="${k}" title="${title}" aria-label="${label}"><span class="nc-tab-ic">${pic}</span><span class="nc-tab-l">${label}</span>${badge ? `<i class="nc-badge" title="${badge} in it">${badge}</i>` : ""}</button>`;
    const items = tab("buy", `<img alt="" src="cafe/art/ui/icon-coin.webp">`, "Buy", "Buy: furniture, decor, stoves, counters and things outside (U)", m === "buy")
      + tab("build", `<img alt="" src="cafe/art/ui/icon-maul.webp">`, "Build", "Build: floors, walls, a bigger café, buildings (B; Ctrl+Z undoes)", m === "build")
      + (v.field ? tab("field", `<img alt="" src="${art("crop-wheat-4")}">`, "Farm", "The farm: dig plots with the plow, and fences, a windmill and more to put round them (F)", m === "field", farmWaiting(v)) : "")
      + tab("upgrades", WRENCH, "Upgrades", "Upgrades: fridge components for counters, self-cleaning stoves (P)")
      + tab("book", `<img alt="" src="${art("book-closed")}">`, "Cookbook", "The cookbook: every dish, its time, cost and takings (C)", cookOpen())
      + tab("diary", DIARY_IC, "Diary", "The café diary: what's happened, and everything that came and went (L)", false, v.diaryNew)
      + tab("bag", `<img alt="" src="cafe/art/ui/icon-bag.webp">`, "Bag", "Your bag: potions, Aunty's food and the things you've stored (G)", false, Object.values(v.inv || {}).reduce((a, b) => a + b, 0) + (v.food || []).length)
      + tab("settings", GEAR, "Settings", "Settings: music, sounds, the sandbox" + (v.sandbox ? " and its dev tools" : ""), false)
      + (v.sandbox ? tab("dev", `<span class="nc-round-ic">⚙</span>`, "Dev", "The sandbox's dev tools", devOpen) : "");
    // (Cam: the round buttons "keep flashing off and back on quickly"): the top bar is drawn every tick, so the tabs are
    // only rebuilt when something on them changed
    const fabHTML = `<nav class="nc-tabs">${items}</nav>`;
    // 2026-10-22: say so once when Aunty's box arrives (at the start, or at midnight with the café open)
    if (v.cart && cartSeen !== v.cart.day + v.cart.tutor.id) { cartSeen = v.cart.day + v.cart.tutor.id; toast(`🐴 ${v.cart.tutor.name} from NeuroVale has pulled up out the front with an order!`); }
    if (v.feast && feastSeen !== v.feast.year && $("nc-modal").hidden) { feastSeen = v.feast.year; halloweenFarewell(v.feast); }
    diaryNews(v);
    if (v.aunty && v.aunty.waiting && auntySeen !== state.aunty.day) { auntySeen = state.aunty.day; toast("📦 A delivery from Aunty has arrived!"); }
    if (lastFab === fabHTML) return;
    lastFab = fabHTML;
    $("nc-fab").innerHTML = fabHTML;
    $("nc-fab-r").innerHTML = "";
    document.querySelectorAll("#nc-fab [data-menu]").forEach((b) => b.addEventListener("click", (e) => {
      e.stopPropagation();
      const k = b.dataset.menu;
      if (k === "book") return cookOpen() ? close() : cookbook(null);
      if (k === "bag") return bag();
      if (k === "diary") { diaryFresh = new Set(); diaryAt = { tab: "all", pick: null }; return diaryBook(); }
      if (k === "upgrades") return upgrades();
      if (k === "aunty") return auntyDoor();
      if (k === "field") return openTab("farm");
      if (k === "settings") return settings();
      if (k === "dev") { devOpen = !devOpen; return draw(); }
      if (menuOf(build) === k) { build = null; hover = null; hoverP = null; hoverW = null; return draw(); }
      if (k === "buy") cue("bell");
      openTab(k === "build" ? "floors" : buyTab);
    }));
  }
  let lastFab = "";
  const cookOpen = () => !$("nc-modal").hidden && !!$("nc-modal").querySelector(".nc-cookbook");
  // V26 q1: run dry -- a round refill arrow, readable from zoomed out
  // the Terrain tools (Cam, 25 Oct): a shovel, and a spirit level
  const SHOVEL_IC = `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M33 5l9 9-3 3-9-9z" fill="#c9973f" stroke="#4e2414" stroke-width="2" stroke-linejoin="round"/><path d="M34.5 12.5L18 29" stroke="#8a5a2b" stroke-width="5" stroke-linecap="round"/><path d="M34.5 12.5L18 29" stroke="#4e2414" stroke-width="1.4" stroke-linecap="round" opacity=".5"/><path d="M19 22l7 7-9 12c-3 3-9 1-11-1s-4-8-1-11z" fill="#9aa6a8" stroke="#3a3f40" stroke-width="2.2" stroke-linejoin="round"/><path d="M11 32l4 4" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".6"/></svg>`;
  const LEVEL_IC = `<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="3" y="18" width="42" height="12" rx="2.5" fill="#e0a63a" stroke="#4e2414" stroke-width="2.2"/><rect x="17" y="20.5" width="14" height="7" rx="3.5" fill="#bfe8c8" stroke="#2e5a3a" stroke-width="1.6"/><circle cx="24" cy="24" r="2.2" fill="#fff" stroke="#2e5a3a" stroke-width="1"/><path d="M21 21v6M27 21v6" stroke="#2e5a3a" stroke-width="1"/><circle cx="8.5" cy="24" r="1.6" fill="#4e2414"/><circle cx="39.5" cy="24" r="1.6" fill="#4e2414"/></svg>`;
  const EMPTY_IC = `<svg class="nc-ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M13 8a5 5 0 1 1-1.5-3.6" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/><path d="M12.6 1.6v3.6H9" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const CLOSE_IC = `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M9 9l14 14M23 9L9 23" fill="none" stroke="#4e2414" stroke-width="3.6" stroke-linecap="round"/><path d="M9 9l14 14M23 9L9 23" fill="none" stroke="#d9a441" stroke-width="1.7" stroke-linecap="round"/></svg>`;
  const MENU_IC = `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M7 9h18M7 16h18M7 23h18" fill="none" stroke="#4e2414" stroke-width="3.4" stroke-linecap="round"/><path d="M7 9h18M7 16h18M7 23h18" fill="none" stroke="#d9a441" stroke-width="1.6" stroke-linecap="round"/></svg>`;
  const GEAR = `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M13.6 3h4.8l.7 3.4 2.5 1.1 2.9-1.9 3.4 3.4-1.9 2.9 1.1 2.5 3.4.7v4.8l-3.4.7-1.1 2.5 1.9 2.9-3.4 3.4-2.9-1.9-2.5 1.1-.7 3.4h-4.8l-.7-3.4-2.5-1.1-2.9 1.9-3.4-3.4 1.9-2.9-1.1-2.5L1.5 18.4v-4.8l3.4-.7 1.1-2.5-1.9-2.9 3.4-3.4 2.9 1.9 2.5-1.1z" fill="#d9a441" stroke="#4e2414" stroke-width="1.6" stroke-linejoin="round"/><circle cx="16" cy="16" r="4.6" fill="#7a3c25" stroke="#4e2414" stroke-width="1.6"/></svg>`;
  /** Settings (PT52): the music, and the sandbox (a café to try things in, with dev tools). */
  /* ---- graphics (the performance audit, 3 Nov 2026; Cam, PT71 g1: "Maybe these settings should find themselve in Neurocafe
     as well", and g3: on a tiling desktop the game is never behind another window, so it's the ACTIVE tile that counts).
     The café's clock runs on whatever is chosen -- it's worked out from the time; only the drawing rests. */
  const FX_CHOICES = [
    ["full", "Full", "Everything moving, always: bobbing bubbles, smoke, lamp flicker, the walkers' sway, the jukebox's colours."],
    ["balanced", "Balanced", "Everything moving while the café is the window you're using; while you're in another one, it rests (customers still come and go)."],
    ["light", "Light", "Calm: nothing bobs, sways or flickers, and the machines' glows are off. The lightest on the computer."]];
  let focused = document.hasFocus(), slowAt = 0;
  const onFocus = (f) => { const was = focused; focused = !!f; if (focused !== was) { applyFx(); if (focused && state && state.made) { sig = ""; tick(); } } };
  window.addEventListener("focus", () => onFocus(true)); window.addEventListener("blur", () => onFocus(false));
  window.NCFocus = (f) => onFocus(f);                       // (from the shell, when the window itself gains or loses focus)
  /** Resting: the motion stops (Light always; Balanced while the café isn't the window in use). */
  function resting() { const fx = state ? C.prefs(state).fx : "balanced"; return fx === "light" || (fx === "balanced" && !focused); }
  function applyFx() {
    const fx = state ? C.prefs(state).fx : "balanced";
    document.body.dataset.fx = fx;
    document.body.classList.toggle("nc-rest", resting());
    if (resting()) document.querySelectorAll(".nc-up, .nc-sway").forEach((e) => e.classList.remove("nc-up", "nc-sway"));
    beatAt = { up: null, sway: null };
  }
  function settings() {
    const v = C.view(state, now()), p = C.prefs(state);
    const md = modal(`<h2>Settings</h2>
      <div class="nc-set"><b>Music</b><label class="nc-check"><input type="checkbox" data-music ${p.music ? "checked" : ""}> Music in the background</label>
        <label class="nc-vol">Volume <input type="range" min="0" max="100" step="5" value="${Math.round(p.vol * 100)}" data-vol></label>
        <button class="nc-btn ghost" data-jukebox>🎵 Choose the music</button></div>
      <div class="nc-set"><b>Sounds</b><label class="nc-check"><input type="checkbox" data-sfx ${p.sfx ? "checked" : ""}> Sound effects</label>
        <label class="nc-vol">Volume <input type="range" min="0" max="100" step="5" value="${Math.round(p.sfxVol * 100)}" data-sfxvol></label></div>
      <div class="nc-set"><b>Happenings</b><label class="nc-check"><input type="checkbox" data-happen ${p.happen ? "checked" : ""}> Now and then something happens at the café, good or bad (it goes in your diary)</label></div>
      <div class="nc-set"><b>Graphics</b>
        <div class="nc-row nc-fx">${FX_CHOICES.map(([k, name]) => `<button class="nc-btn sm${p.fx === k ? "" : " ghost"}" data-fx="${k}" aria-pressed="${p.fx === k}">${name}</button>`).join("")}</div>
        <p class="nc-hint">${esc((FX_CHOICES.find((x) => x[0] === p.fx) || FX_CHOICES[1])[2])}</p></div>
      <div class="nc-set"><b>Sandbox</b><p>${v.sandbox ? "You're in the sandbox: nothing here touches your café." : "A copy of your café to try things in, with dev tools to set your level and coins, cook instantly and skip time. Your café stays exactly as it is."}</p>
        <button class="nc-btn" data-slot>${v.sandbox ? "Back to your café" : "Open the sandbox"}</button>
        ${v.sandbox ? `<button class="nc-btn ghost" data-devt>${devOpen ? "Hide the dev tools" : "Show the dev tools"}</button>` : ""}</div>
      <div class="nc-row"><button class="nc-btn" data-close>Done</button></div>`, "small");
    md.querySelector("[data-music]").addEventListener("change", (e) => setPrefs({ music: e.target.checked }));
    md.querySelector("[data-vol]").addEventListener("input", (e) => { music.volume(+e.target.value / 100); });
    md.querySelector("[data-vol]").addEventListener("change", (e) => setPrefs({ vol: +e.target.value / 100 }));
    md.querySelector("[data-sfx]").addEventListener("change", (e) => { setPrefs({ sfx: e.target.checked }); cue("click"); });
    md.querySelector("[data-happen]").addEventListener("change", (e) => { setPrefs({ happen: e.target.checked }); cue("click"); });
    // (let go of the slider and you hear how loud they'll be)
    md.querySelector("[data-sfxvol]").addEventListener("change", (e) => { setPrefs({ sfxVol: +e.target.value / 100 }); cue("coin"); });
    md.querySelector("[data-slot]").addEventListener("click", () => { close(); openSlot(v.sandbox ? "main" : "sandbox"); });
    md.querySelector("[data-jukebox]").addEventListener("click", () => jukebox());
    md.querySelectorAll("[data-fx]").forEach((b) => b.addEventListener("click", () => { setPrefs({ fx: b.dataset.fx }); applyFx(); close(); settings(); }));
    const dt = md.querySelector("[data-devt]");
    if (dt) dt.addEventListener("click", () => { close(); devOpen = !devOpen; draw(); });
  }
  /** The jukebox (PT56 / Q8): what's playing, the café radio and your playlists to pick from, shuffle, skip. Right-click
      a jukebox in play, or Settings > Choose the music. */
  async function jukebox(fresh) {
    if (fresh !== false) await loadMusic();
    const p = C.prefs(state), L = music.lib || { radio: [], playlists: [] };
    const src = (id, name, n, extra) => `<div class="nc-jb-src${p.src === id ? " on" : ""}"><button class="nc-jb-pick" data-src="${id}"><b>${esc(name)}</b><small>${n} song${n === 1 ? "" : "s"}</small></button>${extra || ""}</div>`;
    const md = modal(`<div class="nc-jukebox"><h2>🎵 The jukebox</h2>
      <div class="nc-jb-now"><small>${p.music ? (music.playing ? "Playing" : "Starting") : "Music's off"}</small><b>${esc(music.playing || "--")}</b>
        <span><button class="nc-btn sm" data-jb="skip" ${p.music ? "" : "disabled"}>Next ⏭</button><button class="nc-btn sm" data-jb="power">${p.music ? "Turn off" : "Turn on"}</button></span></div>
      <h3 class="nc-bk-h">What to play</h3>
      ${src("radio", "Café radio", (L.radio || []).length || 1, `<button class="nc-btn sm ghost" data-jb="folder" title="${esc(L.folder || "")}">Add songs…</button>`)}
      <p class="nc-hint">The game's lofi and jazz and every song in your café music folder, shuffled together.</p>
      ${src("game:lofi", "Café lofi", 1)}${src("game:jazz", "Café jazz", 1)}
      <p class="nc-hint">Just the one, round and round.</p>
      <h3 class="nc-bk-h">Playlists</h3>
      ${(L.playlists || []).map((x) => src("pl:" + x.id, x.name, x.songs.length, `<button class="nc-jb-x" data-plx="${x.id}" title="Forget this playlist (its folder is left alone)">${CLOSE_IC}</button>`)).join("") || `<p class="nc-hint">None yet. A playlist is a folder of music: each song plays once, then round again.</p>`}
      <div class="nc-row"><button class="nc-btn ghost" data-jb="add">Add a folder…</button><label class="nc-check"><input type="checkbox" data-shuffle ${p.shuffle ? "checked" : ""}> Shuffle playlists</label></div>
      <label class="nc-vol">Volume <input type="range" min="0" max="100" step="5" value="${Math.round(p.vol * 100)}" data-vol></label>
      <div class="nc-row"><button class="nc-btn" data-close>Done</button></div></div>`, "jb");
    md.querySelectorAll("[data-src]").forEach((b) => b.addEventListener("click", () => { setPrefs({ src: b.dataset.src, music: true }); setTimeout(() => jukebox(false), 400); }));
    md.querySelector("[data-shuffle]").addEventListener("change", (e) => setPrefs({ shuffle: e.target.checked }));
    md.querySelector("[data-vol]").addEventListener("input", (e) => { music.volume(+e.target.value / 100); });
    md.querySelector("[data-vol]").addEventListener("change", (e) => setPrefs({ vol: +e.target.value / 100 }));
    md.querySelectorAll("[data-plx]").forEach((b) => b.addEventListener("click", async (e) => {
      e.stopPropagation();
      await Store.call("cafe_music_remove", [b.dataset.plx]);
      if (p.src === "pl:" + b.dataset.plx) setPrefs({ src: "radio" });
      jukebox();
    }));
    md.querySelectorAll("[data-jb]").forEach((b) => b.addEventListener("click", async () => {
      const k = b.dataset.jb;
      if (k === "skip") { music.skip(); setTimeout(() => jukebox(false), 400); }
      if (k === "power") { setPrefs({ music: !p.music }); setTimeout(() => jukebox(false), 300); }
      if (k === "folder") { const r = await Store.call("cafe_music_folder", []); if (r && r.error) toast(r.error, true); else toast("Drop songs in that folder, then open the jukebox again."); }
      if (k === "add") {
        const r = await Store.call("cafe_music_add", []);
        if (r && r.error) return toast(r.error, true);
        if (r && r.id) { await loadMusic(); setPrefs({ src: "pl:" + r.id, music: true }); }
        jukebox(false);
      }
    }));
  }
  const WRENCH = `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M21.5 3.2a7 7 0 0 0-6.9 9.1L4.2 22.7a3 3 0 0 0 4.2 4.2l10.4-10.4a7 7 0 0 0 9.1-6.9l-4.3 4.3-4.3-1.1-1.1-4.3z" fill="#d9a441" stroke="#4e2414" stroke-width="1.6" stroke-linejoin="round"/><circle cx="6.6" cy="25.2" r="1.3" fill="#4e2414"/></svg>`;
  const SNOW = `<svg class="nc-snow" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5v13M2.4 4.8l11.2 6.4M2.4 11.2l11.2-6.4M6.3 2.6 8 4.2l1.7-1.6M6.3 13.4 8 11.8l1.7 1.6" fill="none" stroke="#2c6d99" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const coldNote = (it) => it.fridge ? (it.under.length ? ` -- in the fridge: ${it.under.map((u) => `${u.dish.name} ${u.n}`).join(", ")}` : " -- the fridge is empty") : "";
  /** The upgrade buttons for one stove or counter: fitted, or a button with its price (free from a spare part). */
  function upgradeRow(v, it) {
    return Object.values(v.upgrades).filter((U) => U.on.includes(it.kind)).map((U) => {
      const spare = (v.parts || {})[U.id] > 0, locked = v.level < U.level;
      return `<div class="nc-upg"><b>${esc(U.name)}</b><small>${esc(U.says)}</small>${it[U.id] ? `<span class="nc-fitted">Fitted ✓</span>`
        : `<button class="nc-btn sm" data-upg="${U.id}" data-uid="${it.uid}" ${locked ? "disabled" : ""}>${locked ? `Level ${U.level}` : spare ? `Install ${esc(U.name.toLowerCase())} (spare part)` : `Install ${esc(U.name.toLowerCase())} ${coins(U.price)}`}</button>`}</div>`;
    }).join("");
  }
  function wireUpgrades(m, again) {
    m.querySelectorAll("[data-upg]").forEach((b) => b.addEventListener("click", () => {
      const r = act("upgrade", { uid: +b.dataset.uid, part: b.dataset.upg });
      if (r && r.ok) { toast(r.msg); again(); }
    }));
  }
  /** Clicking a counter (2026-10-21, Cam): what's on it, what's in its fridge, and its upgrade. */
  function counterSheet(uid) {
    const v = C.view(state, now()), it = v.items.find((i) => i.uid === uid);
    if (!it) return close();
    const tops = it.kind === "buffet" || C.isShelf(it) ? it.plates : [{ dish: it.dish, n: it.n }];
    const dish = (d, n, cold) => `<div class="nc-card${d ? "" : " locked"}">${d ? `<img alt="" src="${art("dish-" + d.id)}"><b>${esc(d.name)}</b><small>${n} servings${cold ? " (cold)" : ""}</small>` : `<b>Empty</b><small>${cold ? "Room in the fridge" : C.isShelf(it) ? `Serve from a ${esc(C.THINGS[makerOf(it.kind)].name.toLowerCase())}` : "Serve a dish from a stove"}</small>`}</div>`;
    const under = it.fridge ? Array.from({ length: it.cap }, (_, i) => it.under[i] ? dish(it.under[i].dish, it.under[i].n, true) : dish(null, 0, true)).join("") : "";
    const m = modal(`<button class="nc-x" data-close aria-label="Close">×</button><div class="nc-cb-head"><span class="nc-ribbon">${esc(C.THINGS[it.kind].name)}</span></div>
      <h3 class="nc-sub">On top</h3><div class="nc-cards wrap">${tops.map((p) => dish(p.dish, p.n)).join("")}</div>
      ${it.fridge ? `<h3 class="nc-sub">${SNOW} In the fridge underneath</h3><div class="nc-cards wrap">${under}</div><p class="nc-hint">When a dish on top sells out, the one from the fridge goes up.</p>` : ""}
      ${upgradeRow(v, it) ? `<h3 class="nc-sub">Upgrade</h3>${upgradeRow(v, it)}` : ""}`, "bag");
    wireUpgrades(m, () => counterSheet(uid));
  }
  /** The Upgrades button (2026-10-21, Cam): every stove and counter with what can be fitted to it -- a book like the
   * cookbook (2026-10-25, Cam: "like the books with the tabs on the left"): a tab for each kind, the pieces on the left
   * page (a tick when all fitted, a green dot when one can be), the picked one's upgrades on the right. */
  let upAt = { sec: null, uid: null };
  function upgrades() {
    const v = C.view(state, now()), parts = Object.keys(v.parts || {}).filter((k) => v.parts[k] > 0);
    const secs = [{ id: "stoves", name: "Stoves", kinds: ["stove"] }, { id: "outdoor", name: "Outdoor cooking", kinds: C.APPLIANCES }, { id: "counters", name: "Counters", kinds: ["counter", "buffet"] }, { id: "till", name: "Cash register", kinds: ["till"] }]
      .map((x) => ({ ...x, its: v.items.filter((i) => x.kinds.includes(i.kind)) })).filter((x) => x.its.length);
    if (!secs.length) return toast("Buy a stove or a counter first -- their upgrades are fitted here.", true);
    const sec = secs.find((x) => x.id === upAt.sec) || secs[0], it = sec.its.find((i) => i.uid === upAt.uid) || sec.its[0];
    upAt = { sec: sec.id, uid: it.uid };
    const ups = (i) => Object.values(v.upgrades).filter((U) => U.on.includes(i.kind));
    const can = (i) => ups(i).some((U) => !i[U.id] && v.level >= U.level && ((v.parts || {})[U.id] > 0 || v.coins >= U.price));
    const tabs = bookTabs(secs.map((x) => ({ id: x.id, title: x.name, pic: `<img alt="" src="${art(BOOK_ART(x.its[0].kind))}">` })), sec.id, "upsec");
    const nameOf = (i) => `${C.THINGS[i.kind].name} ${sec.its.filter((j) => j.kind === i.kind).indexOf(i) + 1}`;
    const left = `<h3 class="nc-bk-h">${esc(sec.name)}<small>${sec.its.length}</small></h3>
      <div class="nc-cb-dishes">${sec.its.map((i) => `<button class="nc-cb-dish${i === it ? " on" : ""}${ups(i).every((U) => i[U.id]) ? " done" : can(i) ? " can" : ""}" data-uppick="${i.uid}" title="${esc(nameOf(i))}"><img alt="" src="${art(BOOK_ART(i.kind))}"><small>${esc(nameOf(i).replace(/^.* /, "No. "))}</small></button>`).join("")}</div>
      <p class="nc-bk-say">${parts.length ? `Spare parts, fitted free: ${parts.map((k) => `${esc(v.upgrades[k].name)} × ${v.parts[k]}`).join(", ")}.` : "Store or sell an upgraded stove or counter and its upgrade is kept as a spare part, fitted free to the next one."}</p>`;
    const right = `<div class="nc-cb-detail"><img class="nc-cb-big" alt="" src="${art(BOOK_ART(it.kind))}"><h2>${esc(nameOf(it))}</h2><p>${ups(it).filter((U) => it[U.id]).length} of ${ups(it).length} fitted</p></div>
      <h3 class="nc-bk-h">Upgrades</h3>${upgradeRow(v, it)}`;
    const m = bookModal(tabs, left, right, "upgrades:" + sec.id);
    m.querySelectorAll("[data-upsec]").forEach((b) => b.addEventListener("click", () => { upAt = { sec: b.dataset.upsec, uid: null }; upgrades(); }));
    m.querySelectorAll("[data-uppick]").forEach((b) => b.addEventListener("click", () => { upAt.uid = +b.dataset.uppick; upgrades(); }));
    wireUpgrades(m, upgrades);
  }
  /** The Bag (V23 q6, NeuroPets' satchel): potions to use, the things you've stored, collectibles later. */
  /** Everything in storage, as drawer cards (Build > Storage, 2026-10-25). */
  function storedCards(v) {
    return Object.keys(v.ware || {}).filter((k) => v.ware[k] > 0).map((k) => `<div class="nc-card ware"><img alt="" src="${art(shopPic(k))}"><b>${esc(C.THINGS[k].name)}</b><small>× ${v.ware[k]}</small>
        <span class="nc-row"><button class="nc-btn sm" data-place="${k}">Place</button><button class="nc-btn sm" data-sellware="${k}">${coins(Math.floor(C.THINGS[k].price / 2))}</button></span></div>`).join("")
      + Object.keys(v.pware || {}).filter((k) => v.pware[k] > 0).map((k) => `<div class="nc-card ware"><img alt="" src="${art(C.PAINTING[k].pic)}"><b>${esc(C.PAINTING[k].name)}</b><small>× ${v.pware[k]}</small>
        <span class="nc-row"><button class="nc-btn sm" data-hangbuy="${k}">Hang</button><button class="nc-btn sm" data-sellpware="${k}">${coins(Math.floor(C.PAINTING[k].price / 2))}</button></span></div>`).join("")
      + Object.keys(v.cware || {}).filter((k) => v.cware[k] > 0 && C.CEIL[k]).map((k) => `<div class="nc-card ware"><img alt="" src="${art(C.CEIL[k].pic)}"><b>${esc(C.CEIL[k].name)}</b><small>× ${v.cware[k]}</small>
        <span class="nc-row"><button class="nc-btn sm" data-ceilbuy="${k}">Put up</button><button class="nc-btn sm" data-sellcware="${k}">${coins(Math.floor(C.CEIL[k].price / 2))}</button></span></div>`).join("")
      + Object.keys(v.dware || {}).filter((k) => v.dware[k] > 0).map((k) => `<div class="nc-card ware"><img alt="" src="${art(propPic(k))}"><b>${esc(C.DECO[k].name)}</b><small>× ${v.dware[k]} (outside)</small>
        <span class="nc-row"><button class="nc-btn sm" data-put="${k}">Place</button></span></div>`).join("");
  }
  // The Bag (V23 q6) as a book like the cookbook (Cam, 25 Oct: "the bag to also be done as a book with tabs ... collectibles
  // can have Auntys secret recipes and event object collectibles ... The bag can have Potions and other items"): tabs down
  // the left, the things on the left page, the one picked on the right. Storage is in Build, the pantry is a cupboard.
  let bagAt = { sec: "potions", pick: null };
  function bag() {
    const v = C.view(state, now()), inv = v.inv || {};
    const P = { fresh: "potion-fresh", quick: "potion-quick", sell: "potion-sell" };
    ["golden", "crowd", "chef", "mastery"].forEach((k) => { if (inv[k] > 0 || v.candyStore) P[k] = "potion-" + k; });   // (V25 q1: the candy store's)
    // every entry: {id, pic, name, small (on its tile), title, says, have, foot (the right page's button or line)}
    const potions = Object.keys(P).map((k) => ({ id: "p:" + k, pic: `cafe/art/ui/${P[k]}.webp`, name: v.potions[k].name, small: `× ${inv[k] || 0}`, locked: !inv[k],
      says: v.potions[k].says, line: inv[k] ? `You have ${inv[k]}` : "None yet -- potions come with levelling up (a chest every 10 levels) and from the candy store",
      foot: `<button class="nc-btn nc-cb-cook" data-potion="${k}" ${inv[k] ? "" : "disabled"}>Use it</button>` }));
    const items = (v.food || []).map((f, i) => ({ id: "f:" + i, pic: art("dish-" + f.dish.id), name: f.dish.name, small: `× ${f.n}`, says: `${f.n} servings from Aunty.`, line: "It goes out by itself -- onto a counter with the same dish or an empty one, or into a counter's fridge -- as soon as there's room." }))
      .concat(C.CROPS.filter((c) => (v.seeds || {})[c.id] > 0).map((c) => ({ id: "s:" + c.id, pic: art("crop-" + c.id + "-1"), name: c.name + " seed", small: `× ${v.seeds[c.id]}`, says: `${v.seeds[c.id]} packets of ${c.name.toLowerCase()} seed.`, line: "Each one sows a plot for free -- click an empty plot and pick it in Farmer Giles's seed book." })));
    // collectibles: Aunty's secret recipes (the ones still to come hidden), and what you've earned at each event
    // (Cam, 25 Oct: the ones still to come show a question mark, not the recipe)
    const secrets = v.cookbook.filter((d) => d.menu === "aunty").map((d) => ({ id: "r:" + d.id, pic: art("dish-" + d.id), name: d.open ? d.name : "A family secret", small: "", qmark: !d.open, locked: !d.open,
      says: d.open ? `One of Aunty's secret recipes -- in your cookbook's Aunty tab.` : "Aunty keeps this one close.", line: d.open ? "Yours" : `She shares more of them as your café grows${d.level > v.level ? ` -- not before level ${d.level}` : ""}.` }));
    const evPic = (x) => art(x.kind === "thing" || x.kind === "machine" ? shopPic(x.id) : has(x.pic) ? x.pic : String(x.pic || "").replace(/-l$/, ""));
    const evs = ((v.event && v.event.items) || []).map((x) => ({ id: "e:" + x.id, pic: evPic(x), name: x.got ? x.name : "A surprise", locked: !x.got, qmark: !x.got, small: x.got ? "" : `🍬 ${num(x.candy)}`,
      says: `${v.event.name || "Halloween"}: ${(EV_KINDS.find((k) => k[0] === x.kind) || ["", "A collectible"])[1].replace(/s$/, "").toLowerCase()}.`, line: x.got ? "Yours for good" : `Unlock it with ${num(x.candy)} candy at the haunted house` }));
    const VL = v.vale || { weapons: [], keeps: [] }, vale = {
      weapons: VL.weapons.map((w) => ({ id: "w:" + w.id, pic: art(w.pic), name: w.got ? w.name : "A surprise", locked: !w.got, qmark: !w.got,
        says: w.got ? "A mounted weapon from NeuroVale -- yours to hang (Buy > Decor > Wall weapons)." : "Something from NeuroVale.", line: w.got ? `Yours -- ${num(w.price)} coins for another` : "Fill a NeuroVale cart's order and the tutor may leave it for you" })),
      keeps: VL.keeps.map((d) => ({ id: "k:" + d.id, pic: art(propPic(d.id)), name: d.got ? d.name : "A surprise", locked: !d.got, qmark: !d.got,
        says: d.got ? "A keepsake from NeuroVale, for outside." : "Something from NeuroVale.", line: d.got ? "Yours -- place it from Build > Storage when it's stored" : "Now and then a tutor leaves one when their cart is full" })) };
    const secs = [{ id: "potions", name: "Potions", pic: "cafe/art/ui/potion-fresh.webp", groups: [["", potions]] },
                  { id: "items", name: "Items", pic: "cafe/art/ui/icon-bag.webp", groups: [["", items]], none: "Nothing here yet. Food Aunty sends that's waiting for a counter, and seed packets, are kept here -- and more things later." },
                  { id: "collect", name: "Collectibles", pic: "cafe/art/ui/aunty-book.webp", groups: [["Aunty's secret recipes", secrets], [`${(v.event && v.event.name) || "Halloween"}`, evs]] },
                  // (Cam, 25 Oct: "add to collection logs NeuroVale and move all the mounted weapons there") -- won from full carts
                  { id: "vale", name: "NeuroVale", pic: "cafe/art/ui/aunty-page.webp", groups: [["Mounted weapons", vale.weapons], ["Keepsakes", vale.keeps]] }];
    const sec = secs.find((x) => x.id === bagAt.sec) || secs[0];
    bagAt.sec = sec.id;
    const all = sec.groups.reduce((a2, g) => a2.concat(g[1]), []), x = all.find((y) => y.id === bagAt.pick) || all.find((y) => !y.locked) || all[0];
    if (x) bagAt.pick = x.id;
    const tabs = bookTabs(secs.map((s2) => ({ id: s2.id, title: s2.name, pic: `<img alt="" src="${s2.pic}">` })), sec.id, "bagsec");
    const tile = (y) => `<button class="nc-cb-dish${x && y.id === x.id ? " on" : ""}${y.locked ? " locked" : ""}" data-bagpick="${esc(y.id)}" title="${esc(y.name)}">${y.qmark ? `<span class="nc-qmark">?</span>` : `<img alt="" class="${y.hidden ? "nc-hidden" : ""}" src="${y.pic}">`}${y.small ? `<small>${esc(y.small)}</small>` : ""}</button>`;
    const left = sec.groups.filter((g) => g[1].length).map((g, i) => (g[0] ? `<h4 class="nc-bk-sub">${esc(g[0])} <small>${g[1].filter((y) => !y.locked).length} / ${g[1].length}</small></h4>` : i ? "" : "")
        + `<div class="nc-cb-dishes">${g[1].map(tile).join("")}</div>`).join("");
    const right = x ? `<div class="nc-cb-detail">${x.qmark ? `<span class="nc-qmark big">?</span>` : `<img class="nc-cb-big${x.hidden ? " nc-hidden" : ""}" alt="" src="${x.pic}">`}<h2>${esc(x.name)}</h2><p>${esc(x.says)}</p>
        <p class="nc-bk-say">${esc(x.line)}</p><div class="nc-cb-foot">${x.foot || ""}</div></div>` : `<p class="nc-cb-none">${esc(sec.none || "Nothing here yet.")}</p>`;
    const m = bookModal(tabs, `<h3 class="nc-bk-h">${esc(sec.name)}</h3>${left || `<p class="nc-bk-say">${esc(sec.none || "")}</p>`}`, right, "bag:" + sec.id);
    m.querySelectorAll("[data-bagsec]").forEach((b2) => b2.addEventListener("click", () => { bagAt = { sec: b2.dataset.bagsec, pick: null }; bag(); }));
    m.querySelectorAll("[data-bagpick]").forEach((b2) => b2.addEventListener("click", () => { bagAt.pick = b2.dataset.bagpick; bag(); }));
    m.querySelectorAll("[data-potion]").forEach((b2) => b2.addEventListener("click", () => {
      if (["golden", "crowd", "chef", "mastery"].includes(b2.dataset.potion)) { const r = act("usePotion", { kind: b2.dataset.potion }); if (r && r.ok) { toast("✨ " + r.msg); bag(); } return; }   // (no target: the whole café)
      potionMode = b2.dataset.potion; build = null; close(); document.body.classList.add("nc-potion"); draw();
      toast(potionMode === "quick" ? "Click a stove that's cooking (Esc to stop)." : potionMode === "sell" ? "Click a counter with food on it (Esc to stop)." : "Click a plot whose crop has gone over (Esc to stop).");
    }));
  }
  /** The pantry cupboard (Cam, 25 Oct: "Pantry will become a cupboard object that is placed"): click it -- your harvest and
      eggs as a book, the one picked with the dishes it goes in. */
  let pantryPick = null;
  function pantryBook() {
    const v = C.view(state, now()), have = v.pantry || {};
    const goods = C.CROPS.concat(Object.values(C.GOODS)).map((c) => ({ id: c.id, name: c.name, n: have[c.id] || 0 }));
    const x = goods.find((g) => g.id === pantryPick) || goods.find((g) => g.n > 0) || goods[0];
    pantryPick = x.id;
    const uses = v.cookbook.filter((d) => d.open && d.needs.some((nd) => nd.crop === x.id)).map((d) => d.name);
    const tabs = bookTabs([{ id: "pantry", title: "The pantry", pic: `<img alt="" src="${art("cupboard")}">` }], "pantry", "pantrysec");
    const left = `<h3 class="nc-bk-h">The pantry<small>${goods.filter((g) => g.n > 0).length} of ${goods.length}</small></h3>
      <div class="nc-cb-dishes">${goods.map((g) => `<button class="nc-cb-dish${g.id === x.id ? " on" : ""}${g.n ? "" : " locked"}" data-pantry="${g.id}" title="${esc(g.name)}"><img alt="" src="${art("item-" + g.id)}"><small>× ${g.n}</small></button>`).join("")}</div>
      <p class="nc-bk-say">Your harvest and the hens' eggs. A dish with every ingredient here cooks for nothing, and its servings sell for a quarter more.</p>`;
    const right = `<div class="nc-cb-detail"><img class="nc-cb-big" alt="" src="${art("item-" + x.id)}"><h2>${esc(x.name)}</h2><p>${x.n ? `${x.n} in the pantry` : "None in the pantry"}</p>
      <h4>Goes in</h4><p class="nc-bk-say">${uses.length ? esc(uses.join(", ")) : "Dishes still to come"}</p></div>`;
    const m = bookModal(tabs, left, right, "pantry");
    m.querySelectorAll("[data-pantry]").forEach((b2) => b2.addEventListener("click", () => { pantryPick = b2.dataset.pantry; pantryBook(); }));
  }

  // ---- Aunty's daily delivery (2026-10-22, Cam): a box a day with a note from Aunty; gone at midnight if not opened ----
  const giftPic = (g) => g.kind === "coins" ? "cafe/art/ui/icon-coin.webp" : g.kind === "potion" ? `cafe/art/ui/potion-${g.id}.webp` : g.kind === "food" ? art("dish-" + g.id)
    : g.kind === "decor" ? art(propPic(g.id)) : g.kind === "painting" ? art(C.PAINTING[g.id].pic) : g.kind === "seeds" ? art("crop-" + g.id + "-2") : g.kind === "paint" ? paintTin(g.id) : "cafe/art/ui/aunty-page.webp";
  const giftName = (g) => g.kind === "coins" ? `${num(g.n)} coins` : g.kind === "potion" ? `${g.n > 1 ? g.n + " × " : ""}${C.POTIONS[g.id].name}` : g.kind === "food" ? `${g.n} servings of ${C.DISH[g.id].name.toLowerCase()}`
    : g.kind === "decor" ? C.DECO[g.id].name : g.kind === "painting" ? C.PAINTING[g.id].name : g.kind === "paint" ? `A tin of ${g.id.toLowerCase()} furniture paint` : g.kind === "seeds" ? `${g.n} packets of ${C.CROP[g.id].name.toLowerCase()} seed` : `Secret recipe: ${C.DISH[g.id].name}`;
  const giftSays = (g) => g.kind === "paint" ? "Yours for every piece of furniture: pick one in Build mode" : g.kind === "food" ? "In your bag -- out on a counter as soon as there's room" : g.kind === "decor" ? "In your bag, to put outside" : g.kind === "painting" ? "In your bag, to hang"
    : g.kind === "recipe" ? "In your cookbook, under Aunty's secrets" : g.kind === "seeds" ? "In your bag -- each sows a plot for free" : g.kind === "potion" ? "In your bag" : "Straight into your coins";
  function auntyDoor() {
    const v = C.view(state, now()), a = v.aunty;
    if (!a) return toast("Aunty's first box comes once Chef Rosa's tutorial is done.");
    const secrets = `<p class="nc-hint"><img class="nc-inline" alt="" src="cafe/art/ui/aunty-book.webp"> Aunty's secret recipes: <b>${a.secrets} of ${a.of}</b></p>`;
    if (!a.waiting) {
      const mid = new Date(now()); mid.setHours(24, 0, 0, 0);
      return modal(`<button class="nc-x" data-close aria-label="Close">×</button><div class="nc-cb-head"><span class="nc-ribbon">Aunty's delivery</span></div>
        <img class="nc-crate" alt="" src="cafe/art/ui/icon-crate.webp" style="opacity:.55"><p>You've opened today's box. Aunty's next one comes in <b>${clock(mid - now())}</b>.</p>${secrets}
        <button class="nc-btn" data-close>Lovely</button>`, "small aunty");
    }
    const m = modal(`<button class="nc-x" data-close aria-label="Close">×</button><div class="nc-cb-head"><span class="nc-ribbon">Aunty's delivery</span></div>
      <img class="nc-crate shake" alt="" src="cafe/art/ui/icon-crate.webp"><p>A box from Aunty is on the doorstep! Open it today -- it won't keep past midnight.</p>${secrets}
      <button class="nc-btn" data-open>Open the box</button>`, "small aunty");
    m.querySelector("[data-open]").addEventListener("click", () => act("aunty", {}));
  }
  /** The coop (2026-10-23): click it to collect the eggs. */
  function farmWaiting(v) { return v.field.plots.filter((p) => p.ready || p.spoiled).length + v.decor.filter((d) => d.coop && d.coop.full).length; }
  // ---- the furniture store (2026-10-24, the sandbox): paints for every piece of furniture, and the paint mixer -------
  // ---- the furniture catalogue (2026-10-24, Cam: "turn the UI into a book style UI, think catalogue"): the furniture
  // store's book. It opens on its contents -- a pill for each section -- and each section is a spread per piece of
  // furniture: the piece on the left page, every swatch you can buy for it on the right. The arrow at a page's bottom
  // corner turns to the next (or last) piece in the section; the Contents tab on the side goes back to the start.
  let bookAt = { sec: null, i: 0 };
  const BOOK_ART = (kind) => kind === "counter" ? "counter-l" : kind === "buffet" ? "buffet-l" : shopPic(kind);
  const MATERIAL_NAME = { blue: "Upholstered fabric", leather: "Leather", wood: "Wood", darkwood: "Dark wood", pot: "Terracotta pot", shade: "Fabric shade", linen: "Linen", light: "White paint", dark: "Black iron", enamel: "Enamel", mint: "Painted panels", pink: "Painted metal" };
  /** The catalogue's sections: the Buy menu's categories with recolourable furniture in them, counters first; then the mixer. */
  function bookSections(v) {
    const out = [];
    SECTIONS.forEach((sec) => (sec.cats || []).forEach((c) => {
      if (!c.thing) return;
      const kinds = v.shop.filter((x) => c.thing(x.kind, C.THINGS[x.kind] || {}) && matOf(x.kind)).sort((a, b) => a.level - b.level).map((x) => x.kind);
      if (kinds.length) out.push({ id: c.id, name: c.name, pic: c.pic, kinds });
    }));
    out.sort((a, b) => (b.id === "counters") - (a.id === "counters"));
    if (v.halfWalls) out.push({ id: "halfwalls", name: "Half walls", pic: "halfwall-l", hw: true, kinds: v.halfWalls.styles.map((x) => x.id) });   // (2026-11-08: the old dividers)
    out.push({ id: "mixer", name: "Paint mixer", mixer: true, kinds: [null] });
    out.push({ id: "photos", name: "Photo frames", photos: true, pic: "mount-gilded", kinds: [null] });   // (2026-10-24: your own photos)
    return out;
  }
  /** A photo from your computer (2026-10-24): made small (640px at most) as a JPEG and kept by cafe.py. */
  function addPhoto(file) {
    const rd = new FileReader();
    rd.onload = () => {
      const im = new Image();
      im.onload = async () => {
        const k = Math.min(1, 640 / Math.max(im.width, im.height)), cv = document.createElement("canvas");
        cv.width = Math.max(1, Math.round(im.width * k)); cv.height = Math.max(1, Math.round(im.height * k));
        cv.getContext("2d").drawImage(im, 0, 0, cv.width, cv.height);
        const url = cv.toDataURL("image/jpeg", 0.85), r = await Store.call("cafe_photo_add", [url]);
        if (!r || r.error || !r.id) return toast((r && r.error) || "Couldn't keep the photo.", true);
        PHOTOS[r.id] = url; bookAt.photo = r.id; furnitureStore();
      };
      im.onerror = () => toast("That file isn't a picture NeuroCafe can read.", true);
      im.src = rd.result;
    };
    rd.readAsDataURL(file);
  }
  const ARROW = (dir) => `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="${dir > 0 ? "M14 8l14 12-14 12" : "M26 8L12 20l14 12"}" fill="none" stroke="#5a2e12" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="${dir > 0 ? "M14 8l14 12-14 12" : "M26 8L12 20l14 12"}" fill="none" stroke="#f6d27a" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  // (2026-10-24, Cam: "all book menus to match the cook book ... tabs down left for the categories with just the icon,
  // the items in the category on the left side of the book and when clicked info will open on the right"): every book
  // is the cookbook's -- bookTabs() down its left edge, a page of pictures, a page about the one picked
  function bookTabs(list, on, attr) {
    return `<div class="nc-cb-tabs2">${list.map((x) => `<button class="nc-cb-tab2${x.id === on ? " on" : ""}${x.shut ? " shut" : ""}" data-${attr}="${x.id}" title="${esc(x.title)}" aria-label="${esc(x.title)}">${x.pic}</button>`).join("")}</div>`;
  }
  const bookTile = (attr, id, pic, title, on, extra) => `<button class="nc-cb-dish${on ? " on" : ""}${extra || ""}" data-${attr}="${id}" title="${esc(title)}"><img alt="" src="${pic}"></button>`;
  function bookModal(tabs, left, right, key, rtabs) {
    // (rtabs: a second set of tabs down the book's right edge -- the frame builder's frames, 2026-10-26)
    return modal(`<div class="nc-book nc-cookbook">${tabs}${rtabs || ""}<div class="nc-page l">${left}</div><div class="nc-page r">${right}</div><button class="nc-bk-close" data-close aria-label="Close">${CLOSE_IC}</button></div>`, "book cookbook" + (rtabs ? " rtabs" : ""), key);
  }
  function furnitureStore() {
    const v = C.view(state, now()), P = v.paints;
    if (!P) return;
    const secs = bookSections(v), sec = secs.find((x) => x.id === bookAt.sec) || secs[0];
    bookAt.sec = sec.id;
    const tabs = bookTabs(secs.map((x) => ({ id: x.id, title: x.name, pic: x.mixer ? `<span class="nc-paint mixer sm"></span>` : `<img alt="" src="${art(x.pic)}">` })), sec.id, "bsec");
    const owned = `<span class="nc-bk-owned">${P.owned.length} of ${P.shop.length} paints yours${P.mixer ? " · the paint mixer" : ""}</span>`;
    let left, right, rtabs = "";
    if (sec.photos) {
      // your photos in frames (Cam, 2026-10-24): add photos from your computer, pick one and a frame, then hang it
      const ids = Object.keys(PHOTOS), sel = ids.includes(bookAt.photo) ? bookAt.photo : ids[0];
      left = `<h3 class="nc-bk-h">Your photos</h3>
        <div class="nc-photos">${ids.map((id) => `<button class="nc-photo${id === sel ? " on" : ""}" data-photo="${id}" title="Use this photo"><img alt="" src="${PHOTOS[id]}"><i data-photodel="${id}" title="Remove this photo">${CLOSE_IC}</i></button>`).join("")}
          <label class="nc-photo add" title="Add a photo from your computer"><input type="file" accept="image/*" data-photoadd hidden><b>+</b><small>Add a photo</small></label></div>
        <p class="nc-bk-say">${ids.length ? "Pick a photo, then a frame for it on the right." : "Add a photo from your computer -- it's kept with your café, made small."}</p>`;
      // (2026-10-26, Cam: "when i unlock frames from events i want them to become frames in the picture frame builder
      // ... their own tab on the right hand side of the book with the event icon"): the frames' own tabs, down the right
      const fsecs = [{ id: "frames", title: "Photo frames", pic: `<img alt="" src="${art("mount-gilded")}">` }];
      [...new Set(v.frameShop.filter((f) => f.event).map((f) => f.event))].forEach((id) => { const E = (C.CALENDAR || []).find((e) => e.id === id) || { name: id, icon: "★" }; fsecs.push({ id, title: `${E.name} frames`, pic: `<span class="nc-tab-emoji">${E.icon}</span>` }); });
      const ftab = fsecs.some((x) => x.id === bookAt.ftab) ? bookAt.ftab : "frames", fsec = fsecs.find((x) => x.id === ftab);
      rtabs = fsecs.length > 1 ? bookTabs(fsecs, ftab, "ftab").replace('class="nc-cb-tabs2"', 'class="nc-cb-tabs2 r"') : "";
      const shown = v.frameShop.filter((f) => (f.event || "frames") === ftab);
      right = `<h3 class="nc-bk-h">${esc(fsec.title)}</h3>${ftab !== "frames" ? `<p class="nc-bk-say">Yours from ${esc(fsec.title.replace(/ frames$/, ""))} -- they take your own photos too.</p>` : ""}<div class="nc-swgrid">${shown.map((f) => `<div class="nc-swi"><span class="nc-swimg"><img alt="" src="${art(f.pic)}"></span><b>${esc(f.name)}</b><small>${f.stored ? `${f.stored} stored` : "Hangs like a painting"}</small>
          <button class="nc-btn sm" data-frame="${f.id}" ${!sel || (!f.stored && v.coins < f.price) ? "disabled" : ""}>${f.stored ? "Hang" : coins(f.price)}</button></div>`).join("")}</div>`;
    } else if (sec.hw) {
      // (2026-11-08, Cam: "half wall swatches will become the dividers and they can be brought in the furniture store")
      const H = v.halfWalls, i = Math.max(0, Math.min(H.styles.length - 1, bookAt.i)), x = H.styles[i];
      left = `<h3 class="nc-bk-h">${esc(sec.name)}<small>${H.styles.filter((y) => y.owned).length} of ${H.styles.length} yours</small></h3><div class="nc-cb-dishes">${H.styles.map((y, j) => bookTile("bpick", j, art(hwPic(y)), y.name, j === i, y.owned ? "" : " locked")).join("")}</div>
        <p class="nc-bk-say">A style is bought once. Then build it in Build > Half walls, on the lines between tiles inside or outside, ${H.seg} coins a piece (back when you take it down), in any of your paints.</p>`;
      right = `<div class="nc-cb-detail"><img class="nc-cb-big" alt="" src="${art(hwPic(x))}"><h2>${esc(x.name)}</h2><p>${x.rail ? "Railing" : "Half wall"} · ${x.price ? `level ${x.level}` : `free from level ${x.level}`}${(v.hwalls || []).some((w) => w.style === x.id) ? ` · ${v.hwalls.filter((w) => w.style === x.id).length} pieces in your café` : ""}</p>
        <div class="nc-cb-foot">${x.owned ? `<b class="nc-bk-yours">Yours</b>` : `<button class="nc-btn nc-cb-cook" data-hwbuy="${x.id}" ${!x.open || v.coins < x.price ? "disabled" : ""}>${x.open ? `Buy it ${coins(x.price)}` : `Level ${x.level}`}</button>`}</div></div>`;
    } else if (sec.mixer) {
      left = `<h3 class="nc-bk-h">${esc(sec.name)}</h3><div class="nc-cb-dishes"><button class="nc-cb-dish on" title="The paint mixer"><span class="nc-paint mixer big"></span></button></div>${owned}`;
      right = `<div class="nc-cb-detail"><span class="nc-paint mixer big"></span><h2>The Paint Mixer</h2><p>${esc(C.MIXER.says)}</p>
        <p class="nc-bk-say">With the mixer, a piece you pick in Build mode shows the Colour, Shade and Vivid sliders under its swatches: any colour at all, on anything.</p>
        <div class="nc-cb-foot">${P.mixer ? `<b class="nc-bk-yours">Yours</b>` : `<button class="nc-btn nc-cb-cook" data-mixer ${v.coins < P.mixerPrice ? "disabled" : ""}>Buy it ${coins(P.mixerPrice)}</button>`}</div></div>`;
    } else {
      const i = Math.max(0, Math.min(sec.kinds.length - 1, bookAt.i)), kind = sec.kinds[i], T = C.THINGS[kind], mat = matOf(kind);
      const out = v.items.filter((it) => it.kind === kind).length;
      left = `<h3 class="nc-bk-h">${esc(sec.name)}<small>${sec.kinds.length}</small></h3><div class="nc-cb-dishes">${sec.kinds.map((k, j) => bookTile("bpick", j, art(BOOK_ART(k)), C.THINGS[k].name, j === i)).join("")}</div>${owned}`;
      // its swatches for sale: a counter's styles first (with the counter in each), then the paints it takes
      const item = (dot, name, status, btn, extra) => `<div class="nc-swi${extra || ""}">${dot}<b>${esc(name)}</b><small>${status}</small>${btn}</div>`;
      const styles = isCounter(kind) ? P.counters.filter((x) => x.id === "wood" || has(`counter-${x.id}-l`)).map((x) => item(`<span class="nc-swimg"><img alt="" src="${art(x.id === "wood" ? "counter-l" : `counter-${x.id}-l`)}"></span>`, x.name,
        x.owned ? (x.price ? "Yours" : "As it comes") : x.open ? "Counter style" : `Level ${x.level}`,
        x.owned ? "" : `<button class="nc-btn sm" data-cstyle="${x.id}" ${!x.open || v.coins < x.price ? "disabled" : ""}>${x.open ? coins(x.price) : "Locked"}</button>`, x.owned ? " yours" : "")).join("") : "";
      const set = (SWATCH_SETS[mat] || []).slice(1), shop = {};
      P.shop.forEach((x) => { shop[x.id] = x; });
      const paints = set.map(([n, c]) => { const x = shop[n];
        if (!x) return item(`<span class="nc-sw big" style="background:${c}"></span>`, n, "As it comes", "", " yours");
        return item(`<span class="nc-sw big" style="background:${c}"></span>`, n, x.have ? "Yours" : x.level ? `Free at level ${x.level}` : "Catalogue only",
          x.have ? "" : `<button class="nc-btn sm" data-paint="${n}" ${v.coins < x.price ? "disabled" : ""}>${coins(x.price)}</button>`, x.have ? " yours" : ""); }).join("");
      right = `<div class="nc-cb-detail"><img class="nc-cb-big" alt="" src="${art(BOOK_ART(kind))}"><h2>${esc(T.name)}</h2><p>${esc(MATERIAL_NAME[mat] || "")}${out ? ` · ${out} in your café` : ""}</p></div>
        ${styles ? `<h3 class="nc-bk-h">Counter styles</h3><div class="nc-swgrid">${styles}</div>` : ""}<h3 class="nc-bk-h">Paints</h3><div class="nc-swgrid">${paints}</div>`;
    }
    const md = bookModal(tabs, left, right, "store:" + bookAt.sec, rtabs);
    md.querySelectorAll("[data-bsec]").forEach((b) => b.addEventListener("click", () => { bookAt = { sec: b.dataset.bsec, i: 0, photo: bookAt.photo, ftab: bookAt.ftab }; furnitureStore(); }));
    md.querySelectorAll("[data-ftab]").forEach((b) => b.addEventListener("click", () => { bookAt.ftab = b.dataset.ftab; furnitureStore(); }));
    md.querySelectorAll("[data-bpick]").forEach((b) => b.addEventListener("click", () => { bookAt.i = +b.dataset.bpick; furnitureStore(); }));
    md.querySelectorAll("[data-photo]").forEach((b) => b.addEventListener("click", (e) => { if (e.target.closest("[data-photodel]")) return; bookAt.photo = b.dataset.photo; furnitureStore(); }));
    md.querySelectorAll("[data-photodel]").forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); const id = b.dataset.photodel;
      if (Object.values(state.hangPhoto || {}).includes(id)) return toast("That photo is up on a wall -- take its frame down first.", true);
      confirmBox("Remove this photo?", async () => { await Store.call("cafe_photo_delete", [id]); delete PHOTOS[id]; furnitureStore(); }); }));
    const pin = md.querySelector("[data-photoadd]");
    if (pin) pin.addEventListener("change", () => { const f = pin.files && pin.files[0]; if (f) addPhoto(f); });
    md.querySelectorAll("[data-frame]").forEach((b) => b.addEventListener("click", () => {
      const ids = Object.keys(PHOTOS), sel = ids.includes(bookAt.photo) ? bookAt.photo : ids[0];
      if (!sel) return;
      $("nc-modal").hidden = true;
      build = { on: true, hang: b.dataset.frame, photo: sel }; hoverW = null; draw();
      toast("Click a wall panel to hang your photo.");
    }));
    md.querySelectorAll("[data-paint]").forEach((b) => b.addEventListener("click", () => { const r = act("buyPaint", { id: b.dataset.paint }); if (r && r.ok) { toast(r.msg); furnitureStore(); } }));
    md.querySelectorAll("[data-hwbuy]").forEach((b) => b.addEventListener("click", () => { const r = act("buyHalfWall", { id: b.dataset.hwbuy }); if (r && r.ok) { toast(r.msg); furnitureStore(); } }));
    md.querySelectorAll("[data-cstyle]").forEach((b) => b.addEventListener("click", () => { const r = act("buyCounterStyle", { id: b.dataset.cstyle }); if (r && r.ok) { toast(r.msg); furnitureStore(); } }));
    const mx = md.querySelector("[data-mixer]");
    if (mx) mx.addEventListener("click", () => { const r = act("buyMixer", {}); if (r && r.ok) { toast(r.msg); furnitureStore(); } });
  }
  // ---- right-click a piece of furniture (2026-10-24, Cam): your swatches in a little see-through parchment pop-up by
  // it -- click one to use it (it stays open to try another); click away or Esc to close. Outside Build mode (there,
  // right-click still turns things).
  function swatchPop(uid, x, y) {
    const v = C.view(state, now()), it = itemOf(v, uid);
    if (!it || !(it.mat || matOf(it.kind))) return false;
    const all = swatchesFor(it, v, 1).concat((it.mat ? it.mat2 : matOf(it.kind, 2)) ? swatchesFor(it, v, 2) : []), mine = all.filter((s) => s.mine);
    let el = $("nc-swpop");
    if (!el) { el = document.createElement("div"); el.id = "nc-swpop"; el.className = "nc-swpop"; document.body.appendChild(el); }
    el.dataset.uid = uid;
    el.innerHTML = `<b>${esc(it.wall ? "Patio wall" : it.hw ? hwStyle(it.kind).name : C.THINGS[it.kind].name)}</b><div class="nc-sw-rows">${swatchRows(it, v, true, true)}</div>${mine.length < all.length ? `<small>More at the furniture store</small>` : ""}`;
    el.hidden = false;
    const r = el.getBoundingClientRect(), W = window.innerWidth, H = window.innerHeight;
    el.style.left = Math.round(Math.max(8, Math.min(W - r.width - 8, x + 12))) + "px";
    el.style.top = Math.round(Math.max(8, Math.min(H - r.height - 8, y - r.height / 2))) + "px";
    el.querySelectorAll("[data-sw]").forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); useSwatch(uid, b.dataset.sw); const p = el.getBoundingClientRect(); swatchPop(uid, p.left - 12, p.top + p.height / 2); }));
    return true;
  }
  /** PT56 (Cam: "work like the tables"): right-click a hung photo frame any time -- its wood paints in the same pop-up. */
  function framePop(key, x, y) {
    const v = C.view(state, now()), P = C.PAINTING[(v.hang || {})[key]];
    if (P && P.card) return cardPop(key, x, y, v, P);
    if (!P || !(P.photo || P.framed)) return false;
    const all = frameSwatches(v, key), mine = all.filter((s) => s.mine);
    let el = $("nc-swpop");
    if (!el) { el = document.createElement("div"); el.id = "nc-swpop"; el.className = "nc-swpop"; document.body.appendChild(el); }
    el.innerHTML = `<b>${esc(P.name)}</b><div class="nc-sw-rows"><span class="nc-sw-row wrap">${mine.map((s) => swDot(s)).join("")}</span></div>${mine.length < all.length ? `<small>More at the furniture store</small>` : ""}`;
    el.hidden = false;
    const r = el.getBoundingClientRect(), W = window.innerWidth, H = window.innerHeight;
    el.style.left = Math.round(Math.max(8, Math.min(W - r.width - 8, x + 12))) + "px";
    el.style.top = Math.round(Math.max(8, Math.min(H - r.height - 8, y - r.height / 2))) + "px";
    el.querySelectorAll("[data-sw]").forEach((b) => b.addEventListener("click", (e) => {
      e.stopPropagation();
      const sw = all.find((s) => s.key === b.dataset.sw);
      if (sw) act("hangTint", { key, h: sw.h, s: sw.s, b: sw.b, sw: sw.name });
      const p = el.getBoundingClientRect(); framePop(key, p.left - 12, p.top + p.height / 2);
    }));
    return true;
  }
  /** V25 q5: a tarot frame's right-click -- pick its Major Arcana card from your deck. */
  function cardPop(key, x, y, v, P) {
    let el = $("nc-swpop");
    if (!el) { el = document.createElement("div"); el.id = "nc-swpop"; el.className = "nc-swpop"; document.body.appendChild(el); }
    const have = !!CARDS[P.card], on = (v.hangCard || {})[key] || "The Fool";
    el.innerHTML = `<b>${esc(P.name)}</b>${have ? `<div class="nc-cardpick">${v.major.map((n) => `<button class="${n === on ? "on" : ""}" data-card="${esc(n)}" title="${esc(n)}"><img alt="${esc(n)}" src="${cardSrc(P.card, n)}"></button>`).join("")}</div>`
      : `<small>${P.card === "crows" ? "The Murder of Crows" : "The Old School Tarot"} deck isn't in NeuroNet's card library on this computer, so the frame shows a card back.</small>`}`;
    el.hidden = false;
    const r = el.getBoundingClientRect(), W = window.innerWidth, H = window.innerHeight;
    el.style.left = Math.round(Math.max(8, Math.min(W - r.width - 8, x + 12))) + "px";
    el.style.top = Math.round(Math.max(8, Math.min(H - r.height - 8, y - r.height / 2))) + "px";
    el.querySelectorAll("[data-card]").forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); act("hangCard", { key, card: b.dataset.card }); const p = el.getBoundingClientRect(); cardPop(key, p.left - 12, p.top + p.height / 2, C.view(state, now()), P); }));
    return true;
  }
  function swatchPopClose() { const el = $("nc-swpop"); if (el) el.hidden = true; }
  document.addEventListener("pointerdown", (e) => { const el = $("nc-swpop"); if (el && !el.hidden && !el.contains(e.target)) swatchPopClose(); }, true);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") swatchPopClose(); });
  function coopTap(uid) {
    const o = C.view(state, now()).decor.find((d) => d.uid === uid);
    if (!o || !o.coop) return;
    if (o.coop.eggs) return act("eggs", { uid });
    toast("🐔 " + coopTip(o.coop) + ".");
  }
  // ---- the field (2026-10-22): click a ripe plot to pick it (Shift: every ripe plot), an empty one to sow -----------
  function plotTap(uid, e) {
    const v = C.view(state, now()), pl = v.field.plots.find((p) => p.uid === uid);
    if (!pl) return;
    if (pl.ready || pl.spoiled) return act(e && e.shiftKey ? "harvestAll" : "harvest", e && e.shiftKey ? {} : { plot: uid });
    if (pl.crop) return toast(`${pl.name}: ${clock(pl.left)} to go.`);
    if (hold && hold.seed) return act("plant", { plot: uid, crop: hold.seed });
    holdDrop();
    seedShop(uid);
  }
  /** Sweeping over plots with the button down: each ripe one is picked, each empty one sown with the seed in hand. */
  function sweepPlot(uid) {
    const pl = C.view(state, now()).field.plots.find((p) => p.uid === uid);
    if (!pl) return;
    if (pl.ready || pl.spoiled) act("harvest", { plot: uid });
    else if (!pl.crop && hold && hold.seed) act("plant", { plot: uid, crop: hold.seed });
  }
  // Farmer Giles's seeds (Cam: "use farmer giles as the character in charge for our farm and seed UI ... make the UI popup
  // look nicer and be along the lines of the cookbook"): his seed cards in the cookbook's recipe-card style
  const GILES = ["Good soil, that. Put something in it.", "Strawberries come up quick -- you'll be picking by teatime.",
    "Can't keep up with it all on my own, I can't. Glad you're growing your own.", "Grow it yourself and it costs you half as much. Less, mostly.",
    "Pick it when it's ripe, mind. Leave it as long again as it took to grow and it's gone over.", "My old mum swore by a bit of compost. And a lot of shouting at the weeds.",
    "Them hens of yours won't lay in a full nest. Fetch the eggs now and then."];
  // (2026-10-25, Cam: "the farming UI needs to match the other book UI"): Giles's seeds are a book like the cookbook --
  // a tab for each kind of crop down the left, its crops on the left page (Giles under them), the one picked on the right
  const SEED_TABS = [{ id: "veg", name: "Vegetables", pic: "tomato", crops: ["tomato", "onion", "cabbage", "carrot", "lettuce", "potato", "beetroot", "sweetcorn", "pumpkin"] },
                     { id: "fruit", name: "Fruit", pic: "strawberry", crops: ["strawberry", "blackberry", "dragonfruit", "starfruit"] },
                     { id: "grain", name: "Grain", pic: "wheat", crops: ["wheat"] }];
  let seedAt = { sec: null, pick: null, plot: null };
  const growTime = (m) => m < 60 ? dp1(m) + " min" : dp1(m / 60) + " h";
  function seedShop(uid) {
    const v = C.view(state, now()), f = v.field, pl = uid != null && f.plots.find((p) => p.uid === uid), last = pl && pl.last;
    if (uid != null && seedAt.plot !== uid) seedAt = { sec: null, pick: last || null, plot: uid };
    // (a crop not in a tab -- one added later -- goes with the vegetables)
    const tabOf = (id) => (SEED_TABS.find((x) => x.crops.includes(id)) || SEED_TABS[0]).id;
    const secs = SEED_TABS.map((x) => ({ ...x, list: f.crops.filter((c) => tabOf(c.id) === x.id).sort((a, b) => a.level - b.level) })).filter((x) => x.list.length);
    const sec = secs.find((x) => x.id === seedAt.sec) || secs.find((x) => x.id === tabOf(seedAt.pick)) || secs[0];
    const can = (c) => c.open && (c.packets > 0 || v.coins >= c.seed);
    const c = sec.list.find((x) => x.id === seedAt.pick) || sec.list.find(can) || sec.list[0];
    seedAt.sec = sec.id; seedAt.pick = c.id;
    const uses = v.cookbook.filter((d) => d.open && d.needs.some((n) => n.crop === c.id)).map((d) => d.name);
    const say = GILES[(Math.floor(now() / 60000) + (uid || 0)) % GILES.length];
    const tabs = bookTabs(secs.map((x) => ({ id: x.id, title: x.name, pic: `<img alt="" src="${art("crop-" + x.pic + "-4")}">` })), sec.id, "seedsec");
    const tile = (x) => `<button class="nc-cb-dish${x.id === c.id ? " on" : ""}${x.open ? "" : " locked"}${can(x) ? " can" : ""}" data-seed="${x.id}" title="${esc(x.name)}">
        ${x.open ? "" : `<i class="nc-cb-lv">${x.level}</i>`}${x.open ? `<img alt="" src="${art("crop-" + x.id + "-4")}">` : QM}${x.id === last ? "<small>Last</small>" : x.open ? "" : `<small>Level ${x.level}</small>`}</button>`;
    const left = `<h3 class="nc-bk-h">${esc(sec.name)}<small>${sec.list.filter((x) => x.open).length} of ${sec.list.length}</small></h3>
      <div class="nc-cb-dishes">${sec.list.map(tile).join("")}</div>
      <div class="nc-giles"><img alt="" src="${art("giles")}"><p>"${esc(say)}"</p></div>`;
    const cost = c.packets ? `<span class="up" title="Seed packets you were given">🌱 ${c.packets} packet${c.packets > 1 ? "s" : ""}</span>` : `<span${v.coins < c.seed ? ` class="lack"` : ""} title="The seed for one plot">${COIN}${num(c.seed)} a plot</span>`;
    const foot = !c.open ? `<span class="nc-cb-hint">🔒 Giles has these at level ${c.level}</span>`
      : can(c) ? `<button class="nc-btn nc-cb-cook" data-sow="${c.id}">${uid == null ? "Sow it on your plots" : c.packets ? "🌱 Sow a packet" : `Sow ${COIN}${num(c.seed)}`}</button>`
      : `<span class="nc-cb-hint">Need ${num(c.seed - v.coins)} more coins</span>`;
    const right = !c.open ? `<div class="nc-cb-detail">${QM_BIG}<h2>A crop still to come</h2><p>Giles has something new for you at level ${c.level}.</p></div>` : `<div class="nc-cb-detail"><img class="nc-cb-big" alt="" src="${art("crop-" + c.id + "-4")}"><h2>${esc(c.name)}</h2>
        <div class="nc-cb-chips">
          <span title="Grows in">${CLOCK}${growTime(c.mins)}</span>${cost}
          <span title="Picked from one plot">${CLOCHE}${c.yield} a plot</span>
          <span title="XP for picking it">${STAR}${c.xp} XP</span>
          <span title="Once it's ripe, pick it within this or it goes over">⏳ ${growTime(c.mins)} to pick</span>
          <span title="In your pantry">🧺 ${c.have} in the pantry</span>
        </div>
        <h4>Grows the ingredients for</h4><p class="nc-bk-say">${c.open ? (uses.length ? esc(uses.join(", ")) : "Dishes still to come") : "Dishes for later"}. With every ingredient in the pantry a dish cooks for no coins, and sells for a quarter more.</p>
        <div class="nc-cb-foot">${foot}</div></div>`;
    const m = bookModal(tabs, left, right, "seeds:" + sec.id);
    // (sowing keeps the seed in hand for the next plots, like a recipe from the cookbook)
    const sow = (id) => { if (uid == null) { close(); return holdStart(id, true); } const r = act("plant", { plot: uid, crop: id }); if (r && r.ok) { close(); holdStart(id, true); } };
    m.querySelectorAll("[data-seedsec]").forEach((b) => b.addEventListener("click", () => { seedAt.sec = b.dataset.seedsec; seedAt.pick = null; seedShop(uid); }));
    m.querySelectorAll("[data-seed]").forEach((b) => {
      b.addEventListener("click", () => { seedAt.pick = b.dataset.seed; seedShop(uid); });
      b.addEventListener("dblclick", () => { const x = sec.list.find((y) => y.id === b.dataset.seed); if (x && can(x)) sow(x.id); });   // (like the cookbook)
    });
    m.querySelectorAll("[data-sow]").forEach((b) => b.addEventListener("click", () => sow(b.dataset.sow)));
  }
  // ---- the request cart (2026-10-22): a guild hall tutor from NeuroVale with an order; load it from the counters ----
  function cartSheet() {
    const v = C.view(state, now()), c = v.cart;
    if (!c) return close();
    const any = c.order.some((l) => l.got < l.n && l.have > 0);
    const rows = c.order.map((l) => {
      const left = l.n - l.got, full = !left, pct = Math.round(l.got / l.n * 100);
      return `<div class="nc-order${full ? " full" : ""}"><img alt="" src="${art("dish-" + l.dish.id)}"><div><b>${esc(l.dish.name)}</b>
        <span class="nc-obar"><i style="width:${pct}%"></i><em>${num(l.got)} / ${num(l.n)}</em></span>
        <small>${full ? "All loaded ✓" : l.have ? `${num(l.have)} on your counters` : "None on your counters -- cook some!"}</small></div>
        ${full ? "" : `<button class="nc-btn sm" data-load="${l.dish.id}" ${l.have ? "" : "disabled"}>Load${l.have ? " " + num(Math.min(left, l.have)) : ""}</button>`}</div>`;
    }).join("");
    const m = modal(`<button class="nc-x" data-close aria-label="Close">×</button><div class="nc-cb-head"><span class="nc-ribbon">An order from NeuroVale</span></div>
      <div class="nc-visit"><img alt="" src="${art("tutor-" + c.tutor.id)}"><div><b>${esc(c.tutor.name)}</b><small>${esc(c.tutor.title)}</small><p>"${esc(c.tutor.hello)}"</p></div></div>
      <div class="nc-orders">${rows}</div>
      <div class="nc-reward"><span>Pays ${coins(c.value)}</span><span>+ a bonus of ${coins(c.bonus)}</span><span><img alt="" src="cafe/art/ui/potion-quick.webp"> and a gift</span></div>
      <p class="nc-hint">The cart waits out the front until midnight -- if it isn't full by then, ${esc(c.tutor.name)} pays for what's loaded, without the bonus.</p>
      <div class="nc-row"><button class="nc-btn" data-load="" ${any ? "" : "disabled"}>Load everything I can</button><button class="nc-btn ghost" data-close>Later</button></div>`, "cart");
    m.querySelectorAll("[data-load]").forEach((b) => b.addEventListener("click", () => {
      const r = act("cartLoad", b.dataset.load ? { dish: b.dataset.load } : {});
      if (r && r.ok && C.view(state, now()).cart) { toast(r.msg); cartSheet(); }
    }));
  }
  function cartThanks(e) {
    const gift = e.gift.kind === "weapon" ? `<div class="nc-unlock secret nc-reveal"><img alt="" src="${art(C.PAINTING[e.gift.id].pic)}"><span>${esc(C.PAINTING[e.gift.id].name)}</span><small>For your NeuroVale collection -- one's in Build > Storage, and you can buy more</small></div>`
      : e.gift.kind === "decor" ? `<div class="nc-unlock secret"><img alt="" src="${art(propPic(e.gift.id))}"><span>${esc(C.DECO[e.gift.id].name)}</span><small>A keepsake from NeuroVale -- in your bag, to put outside</small></div>`
      : e.gift.kind === "seeds" ? `<div class="nc-unlock"><img alt="" src="${art("crop-" + e.gift.id + "-2")}"><span>${e.gift.n} packets of ${esc(C.CROP[e.gift.id].name.toLowerCase())} seed</span><small>In your bag -- each sows a plot for free</small></div>`
      : `<div class="nc-unlock"><img alt="" src="cafe/art/ui/potion-${e.gift.id}.webp"><span>${esc(C.POTIONS[e.gift.id].name)}</span><small>In your bag</small></div>`;
    modal(`<div class="nc-cb-head"><span class="nc-ribbon">Order complete!</span></div>
      <div class="nc-visit"><img alt="" src="${art("tutor-" + e.tutor)}"><div><b>${esc(e.name)}</b><p>"${esc(e.thanks)}"</p></div></div>
      <div class="nc-unlocks"><div class="nc-unlock"><img alt="" src="cafe/art/ui/icon-coin.webp"><span>${num(e.value + e.bonus)} coins</span><small>${num(e.value)} for the food + ${num(e.bonus)} bonus</small></div>${gift}</div>
      <button class="nc-btn" data-close>Safe travels!</button>`, "level aunty");
  }
  // (Cam, 2026-11-01): Halloween's over -- the Death card is drawn, and the candy left over has become Halloween dishes
  function halloweenFarewell(f) {
    const m = modal(`<div class="nc-cb-head"><span class="nc-ribbon">Halloween is over</span></div>
      <img class="nc-fw-pic" alt="" src="${art("tarotreader-l")}">
      <div class="nc-letter"><p>The Death card has been drawn. Alas, we have reached the end for another year -- but every ending is a beginning. Come back next October with all the excitement of the intrepid Fool.</p>
        <p>Your ${num(f.candy)} candy has been baked into Halloween treats, ready on your counters:</p></div>
      <div class="nc-unlocks">${f.dishes.map((d) => `<div class="nc-unlock"><img alt="" src="${art("dish-" + d.id)}"><span><b>× ${num(d.n)}</b>${esc(d.name)}</span></div>`).join("")}</div>
      <button class="nc-btn" data-feast>Until next year</button>`, "level aunty farewell");
    const seen = () => { act("feastSeen", {}, true); close(); };
    m.querySelector("[data-feast]").addEventListener("click", seen);
    m.onclick = (e) => { if (e.target === m) seen(); };
  }
  function auntyLetter(e) {
    modal(`<div class="nc-cb-head"><span class="nc-ribbon">${e.first ? "Your first box!" : "From Aunty"}</span></div>
      <div class="nc-letter"><p>${esc(e.say)}</p><b>${esc(e.sign)}</b></div>
      <div class="nc-unlocks">${e.gifts.map((g) => `<div class="nc-unlock${g.kind === "recipe" ? " secret" : ""}">${g.kind === "recipe" ? `<span class="nc-recipe"><img alt="" src="cafe/art/ui/aunty-book.webp"><img alt="" src="${art("dish-" + g.id)}"></span>` : `<img alt="" src="${giftPic(g)}">`}<span>${esc(giftName(g))}</span><small>${giftSays(g)}</small></div>`).join("")}</div>
      <button class="nc-btn" data-close>Thank you, Aunty</button>`, "level aunty");
  }
  // ---- the café diary (2026-11-07, Cam: "an event diary which has what events have occurred and what was gained or lost
  // from it ... Handy if we quickly closed the window and didn't check what we got"): a book like the cookbook -- the
  // entries down its left page, newest first, the one picked on the right with everything that came or went. Its button
  // shows how many are still to read; opening the book reads them (the new ones keep a dot until it's opened again).
  const DIARY_IC = `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M7 4.5h17.5a2 2 0 0 1 2 2v20a2 2 0 0 1-2 2H7a2.5 2.5 0 0 1-2.5-2.5V7A2.5 2.5 0 0 1 7 4.5z" fill="#3f7a6a" stroke="#1f3b33" stroke-width="1.6" stroke-linejoin="round"/><path d="M8.5 4.5v24" stroke="#1f3b33" stroke-width="1.4"/><rect x="11.5" y="9" width="11" height="6.5" rx="1" fill="#f3e2b8" stroke="#1f3b33" stroke-width="1.2"/><path d="M13.5 11.3h7M13.5 13.4h5" stroke="#9a5a22" stroke-width="1.1" stroke-linecap="round"/><path d="M19.5 4.5v8l2-1.6 2 1.6v-8" fill="#c23a2c" stroke="#6e1a12" stroke-width="1.1" stroke-linejoin="round"/><path d="M26.5 17h2v5h-2" fill="#d9a441" stroke="#4e2414" stroke-width="1.3" stroke-linejoin="round"/></svg>`;
  const DIARY_TABS = [
    { id: "all", title: "Everything", pic: "📖", has: () => true },
    { id: "gifts", title: "Deliveries and visitors: Aunty, NeuroVale's carts, the candy store, Halloween", pic: "📦", has: (e) => e.kind !== "happening" && e.kind !== "level" },
    { id: "happen", title: "Happenings: the good luck and the bad", pic: "🎲", has: (e) => e.kind === "happening" },
    { id: "level", title: "Level rewards", pic: "⭐", has: (e) => e.kind === "level" }];
  let diaryAt = { tab: "all", pick: null }, diaryFresh = new Set(), diaryToasted = null;
  const two = (n) => String(n).padStart(2, "0");
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  /** When an entry happened, as the diary says it: "Today 14:05", "Yesterday 09:12", "3 Nov 14:05". */
  function diaryWhen(at) {
    const d = new Date(at), t = new Date(now()), hm = `${two(d.getHours())}:${two(d.getMinutes())}`;
    const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime(), gap = Math.round((day(t) - day(d)) / 86400000);
    return gap === 0 ? `Today ${hm}` : gap === 1 ? `Yesterday ${hm}` : `${d.getDate()} ${MONTHS[d.getMonth()]}${d.getFullYear() !== t.getFullYear() ? " " + d.getFullYear() : ""} ${hm}`;
  }
  /** An entry's picture: Aunty's letter, the tutor who drove the cart, or the happening's own sign. */
  const diaryPic = (e, big) => e.kind === "aunty" ? `<img alt="" src="cafe/art/ui/aunty-page.webp">` : e.kind === "cart" && has("tutor-" + e.who) ? `<img alt="" src="${art("tutor-" + e.who)}">`
    : `<span class="nc-dy-emoji${big ? " big" : ""}">${e.icon || "📖"}</span>`;
  const BOOSTS = { crowd: (m) => `Twice the customers for ${m} minutes`, golden: (m) => `Every table tip doubled for ${m} minutes` };
  /** One thing that came or went: {pic, name, small, bad}. */
  function diaryGain(g) {
    const ok = (fn) => { try { return fn(); } catch (err) { return null; } };    // (an old entry naming a thing that's gone)
    if (g.kind === "coins") return { pic: "cafe/art/ui/icon-coin.webp", name: `${g.n < 0 ? "−" : "+"}${num(Math.abs(g.n))} coins`, small: g.n < 0 ? "Out of your coins" : "Into your coins", bad: g.n < 0 };
    if (g.kind === "pantry") return { pic: art("item-" + g.id), name: `${g.n < 0 ? "−" : "+"}${Math.abs(g.n)} ${(C.GOODS && C.GOODS[g.id] ? C.GOODS[g.id].name : g.id).toLowerCase()}`, small: g.n < 0 ? "Gone from the pantry" : "Into the pantry", bad: g.n < 0 };
    if (g.kind === "boost") return { pic: `cafe/art/ui/potion-${g.id}.webp`, name: (BOOSTS[g.id] || ((m) => `${m} minutes`))(g.mins), small: "Like the potion, for free" };
    if (g.kind === "lost") return { pic: art("dish-" + g.id), name: g.text, small: "Thrown away", bad: true };
    if (g.kind === "text") return { text: g.text };
    return ok(() => ({ pic: giftPic(g), name: giftName(g), small: giftSays(g) })) || { text: "Something that's no longer in the game" };
  }
  function diaryGainsHTML(e) {
    const L = e.gains.map(diaryGain);
    return `<div class="nc-unlocks nc-dy-gains">${L.filter((x) => !x.text).map((x) => `<div class="nc-unlock${x.bad ? " bad" : ""}"><img alt="" src="${x.pic}"><span>${esc(x.name)}</span><small>${esc(x.small)}</small></div>`).join("")}</div>`
      + L.filter((x) => x.text).map((x) => `<p class="nc-dy-note">${esc(x.text)}</p>`).join("");
  }
  /** The short line under an entry on the left page: its coins, else its first gift. */
  function diarySum(e) {
    const c = e.gains.filter((g) => g.kind === "coins").reduce((a, g) => a + g.n, 0);
    if (c) return `<b class="${c < 0 ? "bad" : "good"}">${c < 0 ? "−" : "+"}${COIN}${num(Math.abs(c))}</b>`;
    const g = e.gains[0], x = g && diaryGain(g);
    return x ? `<b class="${x.bad ? "bad" : "good"}">${esc(x.text || x.name)}</b>` : "";
  }
  function diaryBook() {
    const v = C.view(state, now());
    if (v.diaryNew) { (v.diary || []).slice(0, v.diaryNew).forEach((e) => diaryFresh.add(e.id)); act("diaryRead", {}, true); }
    const tab = DIARY_TABS.find((x) => x.id === diaryAt.tab) || DIARY_TABS[0], list = (v.diary || []).filter(tab.has);
    const e = list.find((x) => x.id === diaryAt.pick) || list[0];
    diaryAt.pick = e ? e.id : null;
    const tabs = bookTabs(DIARY_TABS.map((x) => ({ id: x.id, title: x.title, pic: `<span class="nc-tab-emoji">${x.pic}</span>` })), tab.id, "dytab");
    const left = `<h3 class="nc-bk-h">The café diary<small>${list.length ? list.length + " " + (list.length === 1 ? "entry" : "entries") : ""}</small></h3>`
      + (list.length ? `<div class="nc-dy-list">${list.map((x) => `<button class="nc-dy-row${e && x.id === e.id ? " on" : ""}${x.bad ? " bad" : ""}" data-dypick="${x.id}">
          <span class="nc-dy-pic">${diaryPic(x)}</span><span class="nc-dy-txt"><b>${esc(x.title)}</b><small>${esc(diaryWhen(x.at))}</small></span><span class="nc-dy-sum">${diarySum(x)}</span>${diaryFresh.has(x.id) ? `<i class="nc-dy-new" title="New"></i>` : ""}</button>`).join("")}</div>`
        : `<p class="nc-bk-say">${tab.id === "happen" ? "Nothing's happened yet. Once Rosa's tutorial is done, now and then something turns up: a visit from the mayor, a coach party, a stove that breaks down. It all goes in here." : "Nothing in here yet. Aunty's boxes, NeuroVale's carts, your level rewards and every happening at the café are written down here, with everything that came and went."}</p>`);
    const right = e ? `<div class="nc-cb-detail nc-dy-page"><span class="nc-dy-hero">${diaryPic(e, true)}</span><h2>${esc(e.title)}</h2><p class="nc-dy-when">${esc(diaryWhen(e.at))}</p>
        ${e.says ? `<p class="nc-dy-says">${e.kind === "aunty" || e.kind === "cart" ? `“${esc(e.says)}”` : esc(e.says)}</p>` : ""}
        ${e.gains.length ? `<h4>${e.gains.some((g) => g.n < 0 || g.kind === "lost") ? "What came and went" : "What you got"}</h4>${diaryGainsHTML(e)}` : ""}</div>`
      : `<p class="nc-cb-none">Pick an entry to read it.</p>`;
    const md = bookModal(tabs, left, right, "diary");
    md.querySelectorAll("[data-dytab]").forEach((b) => b.addEventListener("click", () => { diaryAt = { tab: b.dataset.dytab, pick: null }; cue("page"); diaryBook(); }));
    md.querySelectorAll("[data-dypick]").forEach((b) => b.addEventListener("click", () => { diaryAt.pick = +b.dataset.dypick; diaryBook(); }));
  }
  /** A happening that came while the café ticked on: say so once (the diary's button has its count). */
  function diaryNews(v) {
    const top = (v.diary || [])[0];
    if (diaryToasted == null) { diaryToasted = top ? top.id : 0; return; }   // (on opening: what's there is old news)
    if (!top || top.id <= diaryToasted) return;
    (v.diary || []).filter((e) => e.id > diaryToasted && e.kind === "happening").reverse().forEach((e) => { toast(`${e.icon} ${e.title}. It's in your diary.`, e.bad); cue(e.bad ? "no" : "coin"); });
    diaryToasted = top.id;
  }
  function setPrefs(p) { act("prefs", p, true); music.apply(C.prefs(state)); }
  // ---- the two menus (N43, Cam: "a build menu (floors, walls, expansions) and a purchase (furniture, decor, stoves,
  // counters, outside)"), opened from the round buttons at the bottom left
  const BUILD_TABS = [["floors", "Floors"], ["walls", "Walls"], ["hwalls", "Half walls"], ["terrain", "Terrain"], ["expand", "Expansions"], ["buildings", "Buildings"], ["select", "Select"], ["storage", "Storage"]];   // (storage: 2026-10-25, from the Bag)   // (terrain: 2026-10-24)   // (buildings: 2026-10-24)
  // 2026-10-24 (Cam: "redesign the UI for the buy menu so it is more organised" -- Cafeland's tabs over a row of
  // category pictures, the Sims 3's buy-by-function): SECTIONS along the top, each split into categories, the first of
  // them "All". A category takes things (THINGS, by test), or paintings / wall weapons / fire kits / counter styles.
  // A category with nothing in it (the weapons outside the sandbox) isn't shown. Outside and Farm are the street modes.
  const NOT_STAND = ["plant", "palm", "pot_lavender", "pot_flowers", "pot_ferns"];
  const GAMES = ["skeeball", "basketball", "karaoke", "foosball", "lightgun", "airhockey", "dance", "whackamole", "pingpong", "pooltable", "shuffleboard", "airhockey2"];   // (N48, Sheets 21-22)
  const SECTIONS = [
    { id: "kitchen", name: "Kitchen", cats: [
      { id: "stoves", name: "Stoves", pic: "stove-l", thing: (k) => k === "stove" },
      { id: "counters", name: "Counters", pic: "counter-l", thing: (k) => C.COUNTERS.indexOf(k) >= 0 },
      { id: "bars", name: "Milkshakes & sushi", pic: "shakebar-l", thing: (k, T) => T.bar || T.shelf },          // (V26 q6)
      { id: "outdoor", name: "Outdoor cooking", pic: "bbq-l", thing: (k, T) => T.cooker && !T.bar },
      { id: "safety", name: "Fire safety", pic: "firekit", kits: true }] },
    { id: "dining", name: "Dining", cats: [
      { id: "tables", name: "Tables", pic: "table_square", thing: (k, T) => T.table && !T.low },
      { id: "chairs", name: "Chairs", pic: "chair-fl", thing: (k, T) => T.seat && !T.places && !T.stool && k !== "armchair" && !T.low },
      { id: "low", name: "Low tables & cushions", pic: "table_low-l", thing: (k, T) => T.low },     // (V25 q2)
      { id: "stools", name: "Stools", pic: "stool", thing: (k, T) => T.stool },
      { id: "sofas", name: "Sofas & armchairs", pic: "armchair-l", thing: (k) => k === "armchair" || k === "sofa" }] },
    { id: "decor", name: "Decor", cats: [
      { id: "paintings", name: "Paintings", pic: "painting-1", paint: true },
      { id: "windows", name: "Windows", pic: "window-1", wall: ["window"], what: "Window" },
      { id: "curtains", name: "Curtains & blinds", pic: "curtain-1", wall: ["curtain", "blind"], what: "With its window" },
      { id: "clocks", name: "Clocks & wall things", pic: "clock-2", wall: ["clock", "wall"], what: "For the wall" },
      { id: "weapons", name: "Wall weapons", pic: "wpn-steelarms", weapons: true },
      { id: "plants", name: "Plants", pic: "fern", thing: (k) => NOT_STAND.indexOf(k) >= 0 },
      { id: "stands", name: "Shelves & stands", pic: "bookshelf", thing: (k, T) => T.furniture && !T.table && !T.seat && !T.lamp && !T.divider && NOT_STAND.indexOf(k) < 0 },
      // (Cam, 25 Oct: "an event category that holds all unlocked event decor") -- what you've unlocked at the haunted
      // house and the like; their games go in Fun with the rest
      { id: "event", name: "Event", pic: "jackolantern-l", event: true }] },
    { id: "lighting", name: "Lighting", cats: [
      { id: "lamps", name: "Lamps", pic: "lamp_blue", thing: (k, T) => T.lamp },
      { id: "sconces", name: "Wall lights", pic: "sconce-1", wall: ["sconce"], what: "Wall light" },
      { id: "ceiling", name: "Ceiling lights", pic: "ceil-chandelier", ceil: true }] },
    { id: "fun", name: "Fun", cats: [
      { id: "machines", name: "Coin machines", pic: "jukebox-l", thing: (k, T) => T.machine && !GAMES.includes(k) },
      { id: "games", name: "Games", pic: "skeeball-l", thing: (k) => GAMES.includes(k) },
      { id: "vending", name: "Vending", pic: "vending-l", thing: (k, T) => T.vend }] },
    { id: "outside", name: "Outside" }, { id: "farm", name: "Farm" }];
  const BUY_TABS = SECTIONS.map((x) => [x.id, x.name]);
  const OLD_TABS = { furniture: "dining", stoves: "kitchen", counters: "kitchen", events: "decor" };     // (the tabs before 2026-10-24)
  const tabRow = (tabs, on, extra) => `<div class="nc-dtabs">${tabs.map(([k, n]) => `<button class="nc-btn sm${k === on ? " on" : ""}" data-tab="${k}">${n}</button>`).join("")}${extra || ""}</div>`;
  const buildTabs = (on, extra) => tabRow(BUILD_TABS, on, extra);
  const buyTabs = (on) => tabRow(BUY_TABS, on);
  /** Open a tab: the Build ones, or a Purchase one (Outside is the street). */
  function openTab(k) {
    hover = null; hoverP = null; hoverW = null;
    if (k === "floors") build = { on: true, floors: true };
    else if (k === "walls") build = { on: true, walls: true };
    else if (k === "hwalls") { build = { on: true, hwalls: true }; hwDrag = null; hoverE = null; }   // (2026-11-08: half walls)
    else if (k === "expand") build = { on: true, expand: true };
    else if (k === "terrain") build = { on: true, terrain: true, size: 1 };
    else if (k === "select") { build = { on: true, select: true }; sel = null; selDrag = null; peek = null; }
    else if (k === "storage") build = { on: true, storage: true };
    else if (k === "outside") build = { on: true, street: true };
    else if (k === "buildings") build = { on: true, street: true, buildings: true };   // (put out on the street, like Outside's things)
    else if (k === "farm") build = { on: true, street: true, farm: true };   // (2026-10-22: the plow and the farm things)
    else { buyTab = OLD_TABS[k] || k; build = { on: true }; }
    draw();
  }
  /** Put html in a panel only if it changed, keeping how far its rows are scrolled (PT52: "it will bounce back to the
      start of the menu every now and then" -- every sale redrew it). False when nothing changed. */
  function keepScroll(d, html) {
    if (d._html === html) return false;
    const head = html.split('<div class="nc-cards">')[0], same = d._head === head;          // the same tab: stay put
    const was = same ? [...d.querySelectorAll(".nc-cards")].map((c) => c.scrollLeft) : [];
    d.innerHTML = html; d._html = html; d._head = head;
    d.querySelectorAll(".nc-cards").forEach((c, i) => { if (was[i]) c.scrollLeft = was[i]; });
    return true;
  }
  /** Street mode with nothing in hand -- on the Farm tab if that's where you were (2026-10-22). */
  const streetHome = () => build && build.farm ? { on: true, street: true, farm: true } : build && build.buildings ? { on: true, street: true, buildings: true } : { on: true, street: true };
  const menuOf = (b) => !b ? "" : b.farm ? "field" : b.floors || b.walls || b.hwalls || b.expand || b.buildings || b.terrain || b.select || b.storage ? "build" : "buy";
  // "All" in the Buy menu's categories: a gold burst, like Cafeland's
  const ALL_STAR = `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 2l4.6 10.2 10.9-3.4-5.2 10.2 7.7 8.4-11.2 1.3-1.5 11.1L20 32.4l-5.3 7.4-1.5-11.1L2 27.4l7.7-8.4L4.5 8.8l10.9 3.4z" fill="#f6b42a" stroke="#7a3f12" stroke-width="2.4" stroke-linejoin="round"/><circle cx="20" cy="20" r="5" fill="#ffe28a"/></svg>`;
  /** One category's cards (2026-10-24), in the order they open; "" when it has nothing to show. */
  function catCards(v, c) {
    if (c.event) return eventCards(v);
    if (c.thing) {
      // an event's games you've unlocked go in with the rest (Fun); its other things are in Decor > Event
      const fits = (x) => { const T = C.THINGS[x.kind] || {}; return (!T.event || (T.machine && eventGot(v, x.kind))) && c.thing(x.kind, T); };
      return v.shop.filter(fits).sort((a, b) => a.level - b.level || a.price - b.price).map((x) => {
        const full = x.have >= x.allowed, locked = v.level < x.level;
        return `<div class="nc-card${x.kind === "buffet" || x.kind === "sofa" || (C.THINGS[x.kind] && C.THINGS[x.kind].two) ? " wide" : ""}${locked ? " locked" : ""}"><img alt="" src="${art(shopPic(x.kind))}"><b>${esc(x.name)}</b><small>${locked ? (x.kind === "buffet" ? "Holds two dishes" : "") : x.allowed >= 99 ? (x.have ? `${x.have} out` : "") : `${x.have} / ${x.allowed}`}</small>
          <button class="nc-btn sm" data-buy="${x.kind}" ${full || v.coins < x.price ? "disabled" : ""}>${locked ? `Level ${x.level}` : full ? "Level up for more" : coins(x.price)}</button></div>`;
      }).join("");
    }
    // things that hang (paintings, wall weapons): bought and hung, or hung again from storage
    const hangs = (list, what) => (list || []).map((x) => `<div class="nc-card${x.open ? "" : " locked"}"><img alt="" src="${art(x.pic)}"><b>${esc(x.name)}</b><small>${x.open ? (x.stored ? `${x.stored} stored` : what) : `Level ${x.level}`}</small>
          <button class="nc-btn sm" data-hangbuy="${x.id}" ${!x.open || (!x.stored && v.coins < x.price) ? "disabled" : ""}>${x.stored ? "Hang" : x.open ? coins(x.price) : "Locked"}</button></div>`).join("");
    if (c.paint) return hangs(v.paintShop, "Painting");
    if (c.wall) return hangs((v.wallShop || []).filter((x) => c.wall.indexOf(x.group) >= 0), c.what);
    if (c.weapons) return hangs(v.weaponShop, "Wall weapon");
    // (2026-10-24) the ceiling's lights: bought and put up over a tile, or put up again from storage
    if (c.ceil) return (v.ceilShop || []).map((x) => `<div class="nc-card${x.open ? "" : " locked"}"><img alt="" src="${art(x.pic)}"><b>${esc(x.name)}</b><small>${x.open ? (x.stored ? `${x.stored} stored` : "Ceiling light") : `Level ${x.level}`}</small>
          <button class="nc-btn sm" data-ceilbuy="${x.id}" ${!x.open || (!x.stored && v.coins < x.price) ? "disabled" : ""}>${x.stored ? "Put up" : x.open ? coins(x.price) : "Locked"}</button></div>`).join("");
    // the fire kits (V23 q7) hang on a wall, one of each
    if (c.kits) return (v.kitShop || []).map((k) => `<div class="nc-card${k.open ? "" : " locked"}"><img alt="" src="${art(k.pic)}"><b>${esc(k.name)}</b><small>${k.up ? "On your wall" : k.open ? `Saves ${k.saves} a day` : `Level ${k.level}`}</small>
          <button class="nc-btn sm" data-hangbuy="${k.id}" ${k.up || !k.open || (!k.stored && v.coins < k.price) ? "disabled" : ""}>${k.up ? "Up" : k.stored ? "Hang" : k.open ? coins(k.price) : "Locked"}</button></div>`).join("");
    // (counter styles: at the furniture store since 2026-10-24, picked per counter as a swatch)
    if (c.styles) return v.styles.counters.filter((x) => x.id === "wood" || has(`counter-${x.id}-l`)).map((x) => { const pic = x.id === "wood" ? "counter-l" : `counter-${x.id}-l`;
      return `<div class="nc-card${x.open ? "" : " locked"}${x.on ? " on" : ""}"><img alt="" src="${art(pic)}"><b>${esc(x.name)}</b><small>${x.on ? "In use" : x.owned ? "Yours" : x.open ? "Counter style" : `Level ${x.level}`}</small>
          <button class="nc-btn sm" data-style="counters" data-id="${x.id}" ${x.on || !x.open || (!x.owned && v.coins < x.price) ? "disabled" : ""}>${x.on ? "In use" : x.owned ? "Use" : x.open ? coins(x.price) : "Locked"}</button></div>`; }).join("");
    return "";
  }
  /** Whether an event's thing is yours (unlocked with candy), by its id. */
  const eventGot = (v, id) => ((v.event && v.event.items) || []).some((x) => x.id === id && x.got);
  /** Buy > Decor > Event (Cam, 25 Oct): every event decoration and painting you've unlocked, bought for coins any time.
      The ones still to unlock are in the events book at the haunted house; the games go in Fun. */
  function eventCards(v) {
    const things = v.shop.filter((x) => { const T = C.THINGS[x.kind] || {}; return T.event && !T.machine && eventGot(v, x.kind); })
      .map((x) => `<div class="nc-card"><img alt="" src="${art(shopPic(x.kind))}"><b>${esc(x.name)}</b><small>${x.have ? `${x.have} out` : ""}</small>
          <button class="nc-btn sm" data-buy="${x.kind}" ${v.coins < x.price ? "disabled" : ""}>${coins(x.price)}</button></div>`).join("");
    const paints = ((v.event && v.event.paintings) || []).filter((x) => x.open || x.stored).map((x) => `<div class="nc-card"><img alt="" src="${art(x.pic)}"><b>${esc(x.name)}</b><small>${x.stored ? `${x.stored} stored` : "Painting"}</small>
          <button class="nc-btn sm" data-hangbuy="${x.id}" ${!x.stored && v.coins < x.price ? "disabled" : ""}>${x.stored ? "Hang" : coins(x.price)}</button></div>`).join("");
    return things + paints;
  }
  // ---- the events book (PT56, Cam: "the catalogue book should be presented when the haunted house is clicked"): the
  // haunted house opens it, at Halloween. The contents: a pill for each of the year's events, on now or when it's next on;
  // an event's spread: the event on the left, its things on the right (bought, hung or used as they would be in their
  // own menus). The arrows turn to the last or next event.
  let evAt = null;
  const shortDate = (t) => new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short" });
  const evWhen = (e) => e.on ? `On now${e.to ? ` · till ${shortDate(e.to)}` : ""}` : e.from ? `${shortDate(e.from)} – ${shortDate(e.to)}` : "";
  const EV_KINDS = [["thing", "Decorations"], ["machine", "Coin games"], ["painting", "Paintings"], ["wall", "Wallpapers"], ["rail", "Railings"], ["street", "Outside"], ["guest", "Guests"], ["dish", "Recipes"]];
  let evPick = null, evFlip = null;                    // (evFlip: just unlocked -- it turns over to show itself, once)
  function eventBook() {
    const v = C.view(state, now()), cal = v.calendar || [];
    const ev = cal.find((e) => e.id === evAt) || cal.find((e) => e.on) || cal[0];
    if (!ev) return;
    evAt = ev.id;
    const tabs = bookTabs(cal.map((e) => ({ id: e.id, title: `${e.name}${e.on ? " -- on now" : ""}`, pic: `<span class="nc-tab-emoji">${e.icon}</span>`, shut: !e.ready })), ev.id, "evsec");
    const E = v.event, mine = ev.id === E.id;
    const head = `<h3 class="nc-bk-h">${ev.icon} ${esc(ev.name)}<small class="nc-ev-when${ev.on ? " on" : ""}">${esc(evWhen(ev))}</small></h3>${mine ? `<p class="nc-ev-candy">You have <b>🍬 ${num(v.candy || 0)}</b> candy</p>` : ""}`;
    let left, right;
    if (!mine) {
      left = head + `<p class="nc-bk-say">${esc(ev.says)}</p>`;
      right = `<div class="nc-cb-detail"><span class="nc-ev-hero">${ev.icon}</span><h2>Coming soon</h2><p>${esc(ev.name)}'s things are still being painted. When they're ready they'll be here, and you'll earn them while ${esc(ev.name)} is on.</p></div>`;
    } else {
      const pics = (x) => art(x.kind === "thing" || x.kind === "machine" ? shopPic(x.id) : has(x.pic) ? x.pic : x.pic.replace(/-l$/, ""));
      const all = EV_KINDS.reduce((a2, [k]) => a2.concat(E.items.filter((x) => x.kind === k)), []);
      // V25 q1: the candy store, once everything in the catalogue is yours
      const store = (v.candyStore || []).map((p) => ({ ...p, id: "cs:" + p.id, pid: p.id, pic: p.id === "lucky" ? "cafe/art/ui/icon-crate.webp" : `cafe/art/ui/potion-${p.id}.webp` }));
      const csx = store.find((y) => y.id === evPick);
      const x = csx ? null : all.find((y) => y.id === evPick) || all[0];
      if (x) evPick = x.id;
      left = head + EV_KINDS.map(([k, n]) => ({ n, list: E.items.filter((y) => y.kind === k) })).filter((g) => g.list.length)
        .map((g) => `<h4 class="nc-bk-sub">${g.n} <small>${g.list.filter((y) => y.got).length} / ${g.list.length}</small></h4><div class="nc-cb-dishes">${g.list.map((y) => y.got
          ? bookTile("evpick", y.id, pics(y), y.name, y.id === evPick, y.id === evFlip ? " nc-reveal" : "")
          : `<button class="nc-cb-dish locked${y.id === evPick ? " on" : ""}" data-evpick="${y.id}" title="A surprise -- ${num(y.candy)} candy">${QM}<small>🍬 ${num(y.candy)}</small></button>`).join("")}</div>`).join("");
      if (store.length) left = head + `<h4 class="nc-bk-sub">🍬 Candy store <small>everything's yours -- spend your candy here</small></h4><div class="nc-cb-dishes">${store.map((y) => bookTile("evpick", y.id, y.pic, y.name, y.id === evPick, "")).join("")}</div>` + left.slice(head.length);
      right = `<p class="nc-bk-say">${esc(ev.says)}</p>`;
      if (csx) right = `<div class="nc-cb-detail"><img class="nc-cb-big" alt="" src="${csx.pic}"><h2>${esc(csx.name)}</h2><p>${esc(csx.says)}</p>
          <p class="nc-bk-say">${csx.pid === "lucky" ? "Opened at once" : "Goes in your Bag, used when you like"}</p><div class="nc-cb-foot"><button class="nc-btn nc-cb-cook" data-candystore="${csx.pid}" ${!E.on || (v.candy || 0) < csx.candy ? "disabled" : ""}>Buy 🍬 ${num(csx.candy)}</button></div></div>` + right;
      if (x) {
        const shop = x.kind === "thing" || x.kind === "machine" ? v.shop.find((y) => y.kind === x.id) : null, hp = x.kind === "painting" ? E.paintings.find((p) => p.id === x.id) : null;
        let status, btn = "";
        if (!x.got) { status = E.on ? `Unlock it with ${num(x.candy)} candy -- then it's yours for good` : "Unlock it next October"; btn = `<button class="nc-btn nc-cb-cook" data-evunlock="${x.id}" ${!E.on || (v.candy || 0) < x.candy ? "disabled" : ""}>Unlock 🍬 ${num(x.candy)}</button>`; }
        else if (shop) { status = shop.have ? `Yours -- ${shop.have} out` : "Yours to buy, any time"; btn = `<button class="nc-btn nc-cb-cook" data-evbuy="${x.id}" ${v.coins < shop.price ? "disabled" : ""}>Buy ${coins(shop.price)}</button>`; }
        else if (hp) { status = hp.stored ? `Yours -- ${hp.stored} stored` : "Yours: a painting"; btn = `<button class="nc-btn nc-cb-cook" data-evhang="${x.id}" ${!hp.stored && v.coins < hp.price ? "disabled" : ""}>${hp.stored ? "Hang it" : `Buy ${coins(hp.price)}`}</button>`; }
        else if (x.kind === "wall") { status = "Yours: a wallpaper"; btn = `<button class="nc-btn nc-cb-cook" data-evtab="walls">Lay it in Build &gt; Walls</button>`; }
        else if (x.kind === "guest") { status = "Yours: they visit at dusk and after dark, and leave a few coins extra"; }
        else if (x.kind === "rail") { status = "Yours: a railing, for half walls"; btn = `<button class="nc-btn nc-cb-cook" data-evtab="hwalls">Build it in Build &gt; Half walls</button>`; }
        else if (x.kind === "street") { status = "Yours: for outside"; btn = `<button class="nc-btn nc-cb-cook" data-evtab="outside">Place it from Outside</button>`; }
        else status = "Yours: in your cookbook";
        const restR = right;
        right = (!x.got ? `<div class="nc-cb-detail">${QM_BIG}<h2>A surprise</h2><p>${esc((EV_KINDS.find((k) => k[0] === x.kind) || ["", ""])[1].replace(/s$/, ""))} -- unlock it to see what it is</p>`
          : `<div class="nc-cb-detail"><img class="nc-cb-big${x.id === evFlip ? " nc-reveal" : ""}" alt="" src="${pics(x)}"><h2>${esc(x.name)}</h2><p>${esc((EV_KINDS.find((k) => k[0] === x.kind) || ["", ""])[1].replace(/s$/, ""))}</p>`)
          + `<p class="nc-bk-say">${status}</p><div class="nc-cb-foot">${btn}</div></div>` + restR;
      }
    }
    const md = bookModal(tabs, left, right, "events:" + evAt);
    md.querySelectorAll("[data-evsec]").forEach((b) => b.addEventListener("click", () => { evAt = b.dataset.evsec; evPick = null; eventBook(); }));
    md.querySelectorAll("[data-evpick]").forEach((b) => b.addEventListener("click", () => { evPick = b.dataset.evpick; eventBook(); }));
    md.querySelectorAll("[data-evbuy]").forEach((b) => b.addEventListener("click", () => { const r = act("buy", { kind: b.dataset.evbuy }); if (r && r.ok) { close(); build = { on: true, place: b.dataset.evbuy, dir: 0, fresh: true }; draw(); } }));
    md.querySelectorAll("[data-evhang]").forEach((b) => b.addEventListener("click", () => { close(); build = { on: true, hang: b.dataset.evhang }; hoverW = null; draw(); }));
    md.querySelectorAll("[data-evunlock]").forEach((b) => b.addEventListener("click", () => { const r = act("candyBuy", { id: b.dataset.evunlock }); if (r && r.ok) { evFlip = evPick = b.dataset.evunlock; eventBook(); evFlip = null; } }));
    md.querySelectorAll("[data-evtab]").forEach((b) => b.addEventListener("click", () => { close(); openTab(b.dataset.evtab); }));
    md.querySelectorAll("[data-candystore]").forEach((b) => b.addEventListener("click", () => { const r = act("candyStore", { id: b.dataset.candystore }); if (r && r.ok) { toast("🍬 " + r.msg); eventBook(); } }));
  }
  /** Sheet 25's event houses on the Buildings tab: when they can go up. */
  function houseSays(v, o) {
    const e = (v.calendar || []).find((x) => x.id === o.house);
    if (!e) return "An event's house";
    if (o.houseOn) return v.sandbox && !e.on ? `${e.name}'s house (the sandbox: any time)` : `${e.name} is on: build it now`;
    return `Only while ${e.name} is on${e.from ? ` (from ${new Date(e.from).toLocaleDateString(undefined, { day: "numeric", month: "long" })})` : ""}`;
  }
  /** The haunted house (Cam, 2026-10-24): its events book, open at Halloween -- spend the candy there. */
  function mansionShop() { evAt = "halloween"; eventBook(); }
  /** The half wall being built's swatches (2026-11-08): its paints (or a two-tone style's two rows), yours or locked. */
  function hwSwatches(v, cur) {
    const it = { kind: cur.id, tint: build.tint, tint2: build.tint2, mat: hwMat(cur.id, 1), mat2: hwMat(cur.id, 2) };
    if (!it.mat) return "";
    const parts = !cur.rail && C.THINGS[cur.id] && C.THINGS[cur.id].parts;
    const row = (part) => `<span class="nc-sw-row">${swatchesFor(it, v, part).map((x) => swDot(x)).join("")}</span>`;
    return `<div class="nc-swatches nc-hwsw">${parts && it.mat2 ? parts.map((n, i) => `<div class="nc-sw-part"><em>${esc(n)}</em>${row(i + 1)}</div>`).join("") : row(1)}</div>`;
  }
  function drawDrawer(v) {
    const d = $("nc-drawer");
    if (!build) { d.hidden = true; return; }
    d.hidden = false;
    if (build.street) return drawStreetDrawer(v, d);
    const pick = build.pick && v.items.find((i) => i.uid === build.pick);
    let html = "";
    if (build.place || build.move) {
      const hk = build.place || (v.items.find((i) => i.uid === build.move) || {}).kind, hf = face(hk, heldDir(v));
      html = `<div class="nc-dhead"><img alt="" src="${hf.src}"${hf.flip ? ' style="transform:scaleX(-1)"' : ""}><b>${build.place ? `Place the ${C.THINGS[build.place].name.toLowerCase()}` : "Move it"}</b>${build.place ? (v.ware[build.place] ? `<small>${v.ware[build.place]} stored</small>` : coins(C.THINGS[build.place].price)) : ""}<span>Click a tile · ${KEYS_HINT}${C.thingGrowMax(hk) ? " · = − size" : ""}</span>
        <button class="nc-btn sm" data-b="turnnew">Turn ↻</button>${C.thingGrowMax(hk) ? growBtns(build.place ? build.scale | 0 : (v.items.find((i) => i.uid === build.move) || {}).scale | 0, C.thingGrowMax(hk), "data-b") : ""}<button class="nc-btn sm" data-b="cancel">Cancel</button></div>`;
    } else if (pick) {
      const T = C.THINGS[pick.kind];
      const pf = face(pick.kind, pick.dir, false, pick.cstyle), pfab = T.tint && pick.tint && has(pf.id + "-fab");     // (in its colour)
      html = `<div class="nc-dhead">${pfab ? `<span class="nc-dthumb"><img alt="" src="${art(pf.id)}">${fabTag(art(pf.id + "-fab"), pick.tint, matOf(pick.kind), false)}</span>` : `<img alt="" src="${art(pf.id)}">`}<b>${esc(T.name)}</b>
        <button class="nc-btn sm" data-b="move" title="M, or drag it">Move</button><button class="nc-btn sm" data-b="turn" title="Arrow keys or right-click">Turn ↻</button>${C.thingGrowMax(pick.kind) ? growBtns(pick.scale | 0, C.thingGrowMax(pick.kind), "data-b") : ""}
        ${pick.kind !== "till" ? `<button class="nc-btn sm" data-b="store" title="Store (T)">Store</button><button class="nc-btn sm" data-b="sell">Sell ${coins(Math.floor(T.price / 2))}</button>` : ""}
        <button class="nc-btn sm" data-b="cancel">Close</button></div>${T.tint ? swatchHTML(pick, v) : ""}`;
    } else if (build.hang || build.moveHang) {
      // V22: hanging (or moving) a painting -- click a wall panel
      const P = C.PAINTING[build.hang || (v.hang || {})[build.moveHang]], stored = build.hang && (v.pware || {})[build.hang];
      html = `<div class="nc-dhead"><img alt="" src="${art(P.pic)}"><b>${build.hang ? `Hang ${esc(P.name)}` : "Move the painting"}</b>${build.hang ? (stored ? "from storage" : coins(P.price)) : ""}<span>Click a wall panel (not the door)</span>
        <button class="nc-btn sm" data-b="cancel">Cancel</button></div>`;
    } else if ((build.ceil || build.moveCeil) && C.CEIL[build.ceil || ((v.ceil || {})[build.moveCeil] || {}).id]) {
      // (2026-10-24) putting up (or moving) a ceiling light -- click a floor tile
      const L = C.CEIL[build.ceil || ((v.ceil || {})[build.moveCeil] || {}).id], stored = build.ceil && (v.cware || {})[build.ceil];
      html = `<div class="nc-dhead"><img alt="" src="${art(L.pic)}"><b>${build.ceil ? `Put up the ${esc(L.name.toLowerCase())}` : "Move the light"}</b>${build.ceil ? (stored ? "from storage" : coins(L.price)) : ""}<span>Click a floor tile: it hangs from the ceiling over it</span>
        <button class="nc-btn sm" data-b="cancel">Cancel</button></div>`;
    } else if (build.pickCeil && (v.ceil || {})[build.pickCeil]) {
      const c = v.ceil[build.pickCeil], L = C.CEIL[c.id];
      html = `<div class="nc-dhead"><img alt="" src="${art(L.pic)}"><b>${esc(L.name)}</b>
        <button class="nc-btn sm" data-b="cswitch">${c.off ? "Switch on" : "Switch off"}</button><button class="nc-btn sm" data-b="cmove">Move</button><button class="nc-btn sm" data-b="cstore">Take down</button><button class="nc-btn sm" data-b="csell">Sell ${coins(Math.floor(L.price / 2))}</button>
        <button class="nc-btn sm" data-b="cancel">Close</button></div>`;
    } else if (build.pickHang && (v.hang || {})[build.pickHang]) {
      const P = C.PAINTING[v.hang[build.pickHang]];
      html = `<div class="nc-dhead"><img alt="" src="${art(P.pic)}"><b>${esc(P.name)}</b>
        <button class="nc-btn sm" data-b="hmove">Move</button><button class="nc-btn sm" data-b="hstore">Take down</button><button class="nc-btn sm" data-b="hsell">Sell ${coins(Math.floor(P.price / 2))}</button>
        <button class="nc-btn sm" data-b="cancel">Close</button></div>${P.photo || P.framed ? `<div class="nc-swatches"><span class="nc-sw-row">${frameSwatches(v, build.pickHang).map((x) => swDot(x)).join("")}</span></div>` : ""}`;
    } else if (build.floors) {
      // Build > Floors: pick one, then click or drag across the tiles (each tile costs its price); or the whole floor
      const cur = build.paint && C.FLOOR[build.paint];
      // (PT56: outside on the grass too, at least v.outFloor a tile; Grass lifts an outside tile again)
      html = buildTabs("floors", build.paint === "grass" ? `<span class="nc-dhint">Lifting tiles outside -- click or drag across them</span><button class="nc-btn sm" data-b="floorstop">Done</button>`
        : cur ? `<span class="nc-dhint">Laying <b>${esc(cur.name)}</b> ${coins(cur.price)} a tile -- click or drag across the floor, or outside on the grass (${coins(Math.max(v.outFloor, cur.price))} a tile there)</span><button class="nc-btn sm" data-b="floorall">Whole floor ${coins(cur.price * v.size * v.size)}</button><button class="nc-btn sm" data-b="floorstop">Done</button>` : `<span class="nc-dhint">Pick a floor, then lay it a tile at a time -- inside, or outside on the grass</span>`)
        + `<div class="nc-cards"><div class="nc-card${build.paint === "grass" ? " on" : ""}"><img alt="" src="${art("tex-grass")}"><b>Grass</b><small>Lifts a tile outside</small>
          <button class="nc-btn sm" data-floor="grass">Lift tiles</button></div>${v.floorShop.map((f) => `<div class="nc-card${f.open ? "" : " locked"}${build.paint === f.id ? " on" : ""}"><img alt="" src="${art("floor-" + f.id)}"><b>${esc(f.name)}</b><small>${f.open ? (f.price ? `${f.price} a tile` : "Free") + (f.patio ? " -- patio" : "") : `Level ${f.level}`}</small>
          <button class="nc-btn sm" data-floor="${f.id}" ${f.open ? "" : "disabled"}>${f.open ? "Lay it" : "Locked"}</button></div>`).join("")}</div>`;
    } else if (build.walls) {
      // Build > Walls (N43): a wallpaper is bought once, then laid a panel at a time (click or drag along a wall), or on them all
      const cur = build.paper && v.styles.wall.find((x) => x.id === build.paper);
      const papers = v.styles.wall.filter((x) => x.id === "plaster" || has(`wall-${x.id}-l`));
      html = buildTabs("walls", cur ? `<span class="nc-dhint">Papering with <b>${esc(cur.name)}</b>${cur.owned ? " (yours: free)" : ` ${coins(cur.panel)} a panel`} -- click or drag along the walls</span><button class="nc-btn sm" data-b="wallall">All walls${cur.owned ? "" : ` ${coins(cur.price)}`}</button><button class="nc-btn sm" data-b="wallstop">Done</button>` : `<span class="nc-dhint">Pick a wallpaper, then lay it a panel at a time</span>`)
        + `<div class="nc-cards">${papers.map((x) => `<div class="nc-card${x.open ? "" : " locked"}${build.paper === x.id ? " on" : ""}"><img alt="" src="${art(x.id === "plaster" ? "wall-l" : `wall-${x.id}-l`)}"><b>${esc(x.name)}</b><small>${x.owned ? "Yours" : x.open ? `${num(x.panel)} a panel` : `Level ${x.level}`}</small>
          <button class="nc-btn sm" data-paper="${x.id}" ${!x.open || (!x.owned && v.coins < x.panel) ? "disabled" : ""}>${x.open ? "Lay it" : "Locked"}</button></div>`).join("")}</div>`;
      // V24: the patio's side door, moved along (its railings are half walls since 2026-11-08)
      if (v.patio) html = html.replace('<div class="nc-cards">', `<span class="nc-dhint">Patio side door</span><button class="nc-btn sm" data-b="pdoor-1" title="Move the side door along">&#9664;</button><button class="nc-btn sm" data-b="pdoor1" title="Move the side door along">&#9654;</button><div class="nc-cards">`);
    } else if (build.hwalls) {
      // Build > Half walls (2026-11-08, Cam: "a half wall around my kitchen area ... on the line of the box ... horizontal
      // or vertical"; later: "each one should have swatches for colors ... add the railings into the half wall category
      // ... can be placed outside and inside the cafe"): a style and its colours, then drag along the lines between
      // tiles, in the café or out on the grass. The styles are the old dividers and the patio's railings, bought at the
      // furniture store (the white half-wall and the plain wood railing come free)
      const H = v.halfWalls, cur = build.style && H.styles.find((x) => x.id === build.style);
      const card = (x) => `<div class="nc-card${!x.open ? " locked" : x.owned ? "" : " nc-noq"}${build.style === x.id ? " on" : ""}"><img alt="" src="${art(hwPic(x))}"><b>${esc(x.name)}</b><small>${!x.open ? `Level ${x.level}` : x.owned ? `${num(H.seg)} a piece` : `${num(x.price)} at the furniture store`}</small>
          ${!x.open ? `<button class="nc-btn sm" disabled>Locked</button>` : x.owned ? `<button class="nc-btn sm" data-hwstyle="${x.id}">Build</button>` : `<button class="nc-btn sm" data-hwstore="${x.id}">The store</button>`}</div>`;
      html = buildTabs("hwalls", !H.open ? `<span class="nc-dhint">Half walls come at level ${H.level}.</span>`
        : build.erase ? `<span class="nc-dhint">Taking down: click or drag along half walls (${coins(H.seg)} back for each piece)</span><button class="nc-btn sm" data-b="hwstop">Done</button>`
        : cur ? `<span class="nc-dhint">Building <b>${esc(cur.name)}</b> ${coins(H.seg)} a piece: click or drag along the lines between tiles, inside or out. Drag over ones already built to give them this look for free. Right-click one to take it down</span><button class="nc-btn sm" data-b="hwerase">Take down</button><button class="nc-btn sm" data-b="hwstop">Done</button>`
        : `<span class="nc-dhint">Pick a style, then build along the lines between tiles, inside the café or out on the grass: across or down, whichever line is nearest. Right-click a half wall for its colours</span>${v.hwalls.length ? `<button class="nc-btn sm" data-b="hwerase">Take down</button>` : ""}`)
        + (cur ? hwSwatches(v, cur) : "")
        + `<div class="nc-cards">${H.styles.filter((x) => !x.rail).map(card).join("")}<span class="nc-sep" title="Railings"></span>${H.styles.filter((x) => x.rail).map(card).join("")}</div>`;
    } else if (build.select) {
      // Build > Select (2026-10-25, Cam: "highlight an area and choose to delete, duplicate or even move ... plots, fences,
      // hay bales, terrain everything"): drag a box over the ground outside; then drag inside it to move it (or a copy)
      const pk = sel && C.areaPick(state, sel.box), says = pk ? C.areaSays(state, pk) : "";
      html = buildTabs("select", sel ? `<span class="nc-dhint">Selected: <b>${esc(says)}</b> -- ${sel.mode === "copy" ? "drag it to where the copy goes (its price shows on it)" : "drag it to move it"}</span>
          <button class="nc-btn sm${sel.mode === "move" ? " on" : ""}" data-b="selmove">Move</button><button class="nc-btn sm${sel.mode === "copy" ? " on" : ""}" data-b="selcopy">Duplicate</button>
          <button class="nc-btn sm" data-b="seldel">Delete</button><button class="nc-btn sm ghost" data-b="selclear">Clear</button>`
        : `<span class="nc-dhint">Drag a box over the ground outside to select everything in it: street things, plots, floor tiles and the painted ground</span>`);
    } else if (build.storage) {
      // Build > Storage (Cam, 25 Oct: "The storage gets moved to Build menu"): everything stored, to put out again or sell
      const st = storedCards(v);
      html = buildTabs("storage", st ? "" : `<span class="nc-dhint">Nothing stored. Pick something in Build or Buy and Store it -- it waits here.</span>`) + (st ? `<div class="nc-cards">${st}</div>` : "");
    } else if (build.terrain) {
      // Build > Terrain (2026-10-24, Cam: "like sims games ... paint it directly on the ground and not have it locked to
      // the grid"): pick a ground and a brush, then paint -- click or drag anywhere outside; Grass rubs it out
      const SIZES = [[0.5, "Small"], [1, "Medium"], [1.8, "Large"]], tex = (id) => art(id === "paving" ? "tex-pavement" : id === "cobble" ? "tex-road" : "tex-" + id);
      html = buildTabs("terrain", `<span class="nc-dhint">${build.brush ? `${build.brush === "dug" ? "Digging with the <b>shovel</b> -- drag to lower the ground (paint water in the hollow for a lake)" : build.brush === "level" ? "<b>Levelling</b> -- drag over dug ground (and its water) to fill it back in" : `Painting <b>${esc(build.brush === "grass" ? "grass (rubbing out)" : C.TERRAIN[build.brush].name)}</b> -- drag across the ground`}` : "Pick a ground, then paint it on outside -- drag to paint, Grass rubs it out. The shovel digs the ground lower; the level fills it back in"}</span>
          <span class="nc-brushes">${SIZES.map(([r, nm]) => `<button class="nc-btn sm${build.size === r ? " on" : ""}" data-bsize="${r}">${nm}</button>`).join("")}</span>${build.brush ? `<button class="nc-btn sm" data-b="terrstop">Done</button>` : ""}`)
        + `<div class="nc-cards"><div class="nc-card${build.brush === "grass" ? " on" : ""}"><img alt="" src="${art("tex-grass")}"><b>Grass</b><small>Rubs out</small><button class="nc-btn sm" data-brush="grass">Rub out</button></div>
          <div class="nc-card${build.brush === "dug" ? " on" : ""}"><span class="nc-toolic">${SHOVEL_IC}</span><b>Shovel</b><small>Lowers the ground</small><button class="nc-btn sm" data-brush="dug">Dig</button></div>
          <div class="nc-card${build.brush === "level" ? " on" : ""}"><span class="nc-toolic">${LEVEL_IC}</span><b>Level</b><small>Levels it back out</small><button class="nc-btn sm" data-brush="level">Level</button></div>
          ${v.terrainShop.map((t) => `<div class="nc-card${t.open ? "" : " locked"}${build.brush === t.id ? " on" : ""}"><img class="nc-swatchimg" alt="" src="${tex(t.id)}"><b>${esc(t.name)}</b><small>${t.open ? "Free" : `Level ${t.level}`}</small>
            <button class="nc-btn sm" data-brush="${t.id}" ${t.open ? "" : "disabled"}>${t.open ? "Paint" : "Locked"}</button></div>`).join("")}</div>`;
    } else if (build.expand) {
      // Build > Expansions: a bigger floor
      // (V22 q2: all of them in order -- the next one can be bought, the rest wait their turn)
      const ex = v.expand;
      // V24: the patio (and deeper ones), then the café's floors
      const pn = v.patioNext, patioCards = (v.patios || []).map((e) => {
        const next = pn && e.depth === pn.depth;
        return `<div class="nc-card nc-noq${e.done ? " on" : e.open ? "" : " locked"}"><img alt="" src="${art("floor-deck")}"><b>${e.depth === 3 ? "Patio" : `Patio, ${e.depth} deep`}</b><small>${e.done ? "Yours" : !e.open ? `Level ${e.level}` : next ? (e.depth === 3 ? "Eat outside, off the side" : "A tile deeper") : "After the one before"}</small>
          ${e.done ? `<button class="nc-btn sm" disabled>Built</button>` : `<button class="nc-btn sm" ${next ? "data-patio" : ""} ${!next || !e.open || v.coins < e.coins ? "disabled" : ""}>${coins(e.coins)}</button>`}</div>`;
      }).join("");
      html = buildTabs("expand", ex ? "" : `<span class="nc-dhint">Your café is as big as it gets (${v.size}x${v.size}).</span>`) + `<div class="nc-cards">${patioCards}${(v.expansions || []).map((e) => {
        const next = ex && e.size === ex.size;
        return `<div class="nc-card nc-noq${e.done ? " on" : e.open ? "" : " locked"}"><img alt="" src="${art("floor-grey")}"><b>${e.size}x${e.size} café</b><small>${e.done ? "Yours" : e.open ? (next ? "A bigger floor" : "After the one before") : `Level ${e.level}`}</small>
          ${e.done ? `<button class="nc-btn sm" disabled>Built</button>` : `<button class="nc-btn sm" ${next ? "data-expand" : ""} ${!next || !e.open || v.coins < e.coins ? "disabled" : ""}>${coins(e.coins)}</button>`}</div>`;
      }).join("")}</div>`;
    } else {
      // Purchase (2026-10-24): a section's categories as a row of pictures, then that category's cards ("All": every
      // category's, in turn)
      const sec = SECTIONS.find((x) => x.id === buyTab) || SECTIONS[1];
      const cats = (sec.cats || []).map((c) => ({ c, cards: catCards(v, c) })).filter((x) => x.cards);
      const on = cats.some((x) => x.c.id === buyCat[sec.id]) ? buyCat[sec.id] : "all";
      const catBtn = (id, name, pic) => `<button class="nc-cat${id === on ? " on" : ""}" data-cat="${id}" title="${esc(name)}">${pic.startsWith("<") ? pic : `<img alt="" src="${pic}">`}<small>${esc(name)}</small></button>`;
      const row = cats.length > 1 ? `<div class="nc-dcats">${catBtn("all", "All", ALL_STAR)}${cats.map((x) => catBtn(x.c.id, x.c.name, art(x.c.pic))).join("")}</div>` : "";
      const shown = on === "all" ? cats.map((x) => x.cards).join(`<span class="nc-sep"></span>`) : cats.find((x) => x.c.id === on).cards;
      html = buyTabs(sec.id) + row + `<div class="nc-cards">${shown || `<small class="nc-dhint">Nothing here yet.</small>`}</div>`;
    }
    html = mysteryCards(html);
    if (!keepScroll(d, html)) return;          // PT52: unchanged -- leave it (and where it's scrolled to) alone
    d.querySelectorAll("[data-style]").forEach((b) => b.addEventListener("click", () => act("style", { what: b.dataset.style, id: b.dataset.id })));
    d.querySelectorAll("[data-brush]").forEach((b) => b.addEventListener("click", () => { build = { on: true, terrain: true, size: build.size || 1, brush: b.dataset.brush }; draw(); }));
    d.querySelectorAll("[data-bsize]").forEach((b) => b.addEventListener("click", () => { build = Object.assign({}, build, { size: +b.dataset.bsize }); draw(); }));
    d.querySelectorAll("[data-floor]").forEach((b) => b.addEventListener("click", () => { build = { on: true, floors: true, paint: b.dataset.floor }; hover = null; draw(); }));
    d.querySelectorAll("[data-paper]").forEach((b) => b.addEventListener("click", () => { build = { on: true, walls: true, paper: b.dataset.paper }; hoverW = null; draw(); }));
    d.querySelectorAll("[data-hwstyle]").forEach((b) => b.addEventListener("click", () => { build = { on: true, hwalls: true, style: b.dataset.hwstyle }; hoverE = null; draw(); }));
    d.querySelectorAll(".nc-hwsw [data-sw]").forEach((b) => b.addEventListener("click", () => {      // (a colour for the next pieces)
      const cur = build.style, it = { kind: cur, tint: build.tint, tint2: build.tint2, mat: hwMat(cur, 1), mat2: hwMat(cur, 2) };
      const sw = [1, 2].flatMap((part) => swatchesFor(it, v, part)).find((x) => x.key === b.dataset.sw);
      if (!sw) return;
      if (!sw.mine) return toast(sw.why, true);
      build = Object.assign({}, build, { [sw.part === 2 ? "tint2" : "tint"]: { h: sw.h, s: sw.s, b: sw.b, sw: sw.name } }); draw();
    }));
    d.querySelectorAll("[data-hwstore]").forEach((b) => b.addEventListener("click", () => {
      if (!v.paints) return toast("Half-wall styles are sold at the furniture store: put one out on the street (Buy > Outside).", true);
      bookAt = { sec: "halfwalls", i: Math.max(0, v.halfWalls.styles.findIndex((x) => x.id === b.dataset.hwstore)), photo: bookAt.photo, ftab: bookAt.ftab }; furnitureStore(); }));
    d.querySelectorAll("[data-patio]").forEach((b) => b.addEventListener("click", () => {
      const pn = C.view(state, now()).patioNext;
      if (pn) confirmBox(pn.first ? `Build the patio for ${num(pn.coins)} coins? It runs along the café's front-right side, ${pn.depth} tiles deep, with a side door and a wooden railing. Street things in the way go into storage.`
        : `Make the patio ${pn.depth} tiles deep for ${num(pn.coins)} coins?`, () => act("patio"));
    }));
    d.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => openTab(b.dataset.tab)));
    // swatches: a click sets the colour; the sliders recolour it live as they move, and keep it when let go
    const tintOf = () => { const t = {}; d.querySelectorAll("[data-tk]").forEach((r) => { t[r.dataset.tk] = +r.value; }); return t; };
    d.querySelectorAll(".nc-swatches [data-sw]").forEach((b) => b.addEventListener("click", () => {
      if (build.pickHang) {                                   // a photo frame's paint
        const sw = frameSwatches(C.view(state, now()), build.pickHang).find((x) => x.key === b.dataset.sw);
        if (sw && !sw.mine) return toast(sw.why + ".");
        if (sw) act("hangTint", { key: build.pickHang, h: sw.h, s: sw.s, b: sw.b, sw: sw.name });
        return;
      }
      useSwatch(build.pick, b.dataset.sw);
    }));
    d.querySelectorAll("[data-tk]").forEach((r) => {
      const part = () => d.querySelector("[data-swpart]") ? swPart : 1;
      r.addEventListener("input", () => { const el = document.querySelector(`.nc-thing[data-uid="${build.pick}"] .nc-fab${part() === 2 ? ".two" : ":not(.two)"}`), t = tintOf();
        if (el) tintEl(el, t, matOf(C.view(state, now()).items.find((i) => i.uid === build.pick).kind, part())); else act("tint", Object.assign({ uid: build.pick, part: part() }, t), true); });
      r.addEventListener("change", () => act("tint", Object.assign({ uid: build.pick, part: part() }, tintOf()), true));
    });
    d.querySelectorAll("[data-swpart]").forEach((b) => b.addEventListener("click", () => { swPart = +b.dataset.swpart; draw(); }));
    d.querySelectorAll("[data-cat]").forEach((b) => b.addEventListener("click", () => { buyCat[buyTab] = b.dataset.cat; draw(); }));
    d.querySelectorAll("[data-hangbuy]").forEach((b) => b.addEventListener("click", () => { build = { on: true, hang: b.dataset.hangbuy }; hoverW = null; draw(); }));
    d.querySelectorAll("[data-ceilbuy]").forEach((b) => b.addEventListener("click", () => { build = { on: true, ceil: b.dataset.ceilbuy }; hover = null; draw(); }));
    d.querySelectorAll("[data-sellpware]").forEach((b) => b.addEventListener("click", () => confirmBox(`Sell ${C.PAINTING[b.dataset.sellpware].name} for ${Math.floor(C.PAINTING[b.dataset.sellpware].price / 2)} coins?`, () => act("sellPware", { id: b.dataset.sellpware }))));
    d.querySelectorAll("[data-buy]").forEach((b) => b.addEventListener("click", () => { const r = act("buy", { kind: b.dataset.buy }); if (r && r.ok) { build = { on: true, place: b.dataset.buy, dir: 0, fresh: true }; draw(); } }));
    d.querySelectorAll("[data-put]").forEach((b) => b.addEventListener("click", () => { build = { ...streetHome(), placeDecor: b.dataset.put, dir: 0 }; hoverP = null; draw(); }));
    d.querySelectorAll("[data-sellcware]").forEach((b) => b.addEventListener("click", () => confirmBox(`Sell the ${C.CEIL[b.dataset.sellcware].name.toLowerCase()} for ${Math.floor(C.CEIL[b.dataset.sellcware].price / 2)} coins?`, () => act("sellCware", { id: b.dataset.sellcware }))));
    d.querySelectorAll("[data-place]").forEach((b) => b.addEventListener("click", () => { build = { on: true, place: b.dataset.place, dir: 0 }; draw(); }));
    d.querySelectorAll("[data-sellware]").forEach((b) => b.addEventListener("click", () => confirmBox(`Sell a stored ${C.THINGS[b.dataset.sellware].name.toLowerCase()} for ${Math.floor(C.THINGS[b.dataset.sellware].price / 2)} coins?`, () => act("sellWare", { kind: b.dataset.sellware }))));
    d.querySelectorAll("[data-expand]").forEach((b) => b.addEventListener("click", () => { const e = C.view(state, now()).expand; if (e) confirmBox(`Make the café ${e.size}x${e.size} for ${num(e.coins)} coins?`, () => act("expand", {})); }));
    d.querySelectorAll("[data-b]").forEach((b) => b.addEventListener("click", () => {
      const k = b.dataset.b;
      if (k === "cancel") { build = { on: true }; hover = null; return draw(); }
      if (k === "floors") { build = { on: true, floors: true }; hover = null; return draw(); }
      if (k === "cswitch") return act("light", { ceil: build.pickCeil });
      if (k === "cmove") { build = { on: true, moveCeil: build.pickCeil }; hover = null; return draw(); }
      if (k === "cstore") { const r = act("ceilTake", { from: build.pickCeil }); if (r && r.ok) { toast(r.msg); build = { on: true }; draw(); } return; }
      if (k === "csell") { const key = build.pickCeil, L = C.CEIL[v.ceil[key].id]; return confirmBox(`Sell the ${L.name.toLowerCase()} for ${Math.floor(L.price / 2)} coins?`, () => { const r = act("ceilSell", { from: key }); if (r && r.ok) { build = { on: true }; draw(); } }); }
      if (k === "hmove") { build = { on: true, moveHang: build.pickHang }; hoverW = null; return draw(); }
      if (k === "hstore") { const r = act("unhang", { from: build.pickHang }); if (r && r.ok) { toast(r.msg); build = { on: true }; draw(); } return; }
      if (k === "hsell") { const key = build.pickHang, P = C.PAINTING[v.hang[key]]; return confirmBox(`Sell ${P.name} for ${Math.floor(P.price / 2)} coins?`, () => { const r = act("sellHang", { from: key }); if (r && r.ok) { build = { on: true }; draw(); } }); }
      if (k === "selmove" || k === "selcopy") { if (sel) sel.mode = k === "selmove" ? "move" : "copy"; return draw(); }
      if (k === "selclear") { sel = null; peek = null; return draw(); }
      if (k === "seldel" && sel) {
        const pk = C.areaPick(state, sel.box), crops = state.field.some((p) => pk.plots.indexOf(p.uid) >= 0 && p.crop);
        return confirmBox(`Delete ${C.areaSays(state, pk)}? Street things go into storage${pk.plots.length ? ", plots are filled in (half their price back)" : ""}${pk.floors.length || pk.dabs.length ? ", the ground goes back to grass" : ""}.${crops ? " What's growing in the plots is lost." : ""}`,
          () => { const r = act("area", Object.assign({ op: "remove" }, sel.box)); if (r && r.ok) { toast(r.msg); sel = null; draw(); } });
      }
      if (k === "terrstop") { build = { on: true, terrain: true, size: build.size || 1 }; return draw(); }
      if (k === "floorstop") { build = { on: true, floors: true }; hover = null; return draw(); }
      if (k === "pdoor-1" || k === "pdoor1") { const P = v.patio; if (P) act("patioDoor", { y: (P.door + (k === "pdoor1" ? 1 : -1) + v.size) % v.size }); return; }
      if (k === "wallstop") { build = { on: true, walls: true }; hoverW = null; return draw(); }
      if (k === "hwstop") { build = { on: true, hwalls: true }; hwDrag = null; hoverE = null; return draw(); }
      if (k === "hwerase") { build = { on: true, hwalls: true, erase: true }; hwDrag = null; hoverE = null; return draw(); }
      if (k === "wallall") { const x = v.styles.wall.find((w) => w.id === build.paper); return confirmBox(`Paper every wall with ${x.name.toLowerCase()}${x.owned ? "" : ` for ${num(x.price)} coins`}? (Panels you've papered one by one change too.)`, () => act("style", { what: "wall", id: build.paper })); }
      if (k === "floorall") return confirmBox(`Lay ${C.FLOOR[build.paint].name.toLowerCase()} over the whole floor for ${num(C.FLOOR[build.paint].price * v.size * v.size)} coins? (Tiles already laid with it cost nothing.)`, () => act("floorAll", { id: build.paint }));
      if (k === "turnnew") return turnHeld(1);
      if (k === "smaller" || k === "bigger") return growHeld(k === "bigger" ? 1 : -1);
      if (k === "move") { build = { on: true, move: pick.uid }; return draw(); }
      if (k === "turn") return turnHeld(1);
      if (k === "smaller" || k === "bigger") return growHeld(k === "bigger" ? 1 : -1);
      if (k === "store") { const r = act("store", { uid: pick.uid }); if (r && r.ok) { build = { on: true }; draw(); } return; }
      if (k === "sell") confirmBox(`Sell this ${C.THINGS[pick.kind].name.toLowerCase()} for ${Math.floor(C.THINGS[pick.kind].price / 2)} coins?`, () => { const r = act("sell", { uid: pick.uid }); if (r && r.ok) { build = { on: true }; draw(); } });
    }));
  }

  // ---- street build mode (2026-10-21): the catalogue of street things; pick one, click the ground; pick a placed one
  // to move, turn, store or sell it
  function drawStreetDrawer(v, d) {
    const D = C.DECO, pick = build.pickDecor && v.decor.find((o) => o.uid === build.pickDecor);
    let html;
    if (build.placeDecor || build.moveDecor) {
      const id = build.placeDecor || (v.decor.find((o) => o.uid === build.moveDecor) || {}).id, it = D[id];
      const how = build.placeDecor ? (v.dware[id] ? "from the warehouse" : coins(it.price)) : "";
      const pf = propFace(id, heldDir(v));
      html = `<div class="nc-dhead"><img alt="" src="${art(pf.pic)}"${pf.flip ? ' style="transform:scaleX(-1)"' : ""}><b>${build.placeDecor ? `Place the ${esc(it.name.toLowerCase())}` : "Move it"}</b>${how}<span>Click the ground · ${KEYS_HINT}${C.growMax(id) ? " · = − size" : ""}</span>
        <button class="nc-btn sm" data-s="turnnew">Turn ↻</button>${C.growMax(id) ? growBtns(build.placeDecor ? build.scale | 0 : (v.decor.find((o) => o.uid === build.moveDecor) || {}).scale | 0, C.growMax(id)) : ""}<button class="nc-btn sm" data-s="cancel">Cancel</button></div>`;
    } else if (pick) {
      const it = D[pick.id];
      html = `<div class="nc-dhead"><img alt="" src="${art(propPic(pick.id))}"><b>${esc(it.name)}</b>
        <button class="nc-btn sm" data-s="move">Move</button><button class="nc-btn sm" data-s="turn">Turn ↻</button>${C.growMax(pick.id) ? growBtns(pick.scale | 0, C.growMax(pick.id)) : ""}
        <button class="nc-btn sm" data-s="store" title="Store (T)">Store</button><button class="nc-btn sm" data-s="sell">Sell ${coins(Math.floor(it.price / 2))}</button>
        <button class="nc-btn sm" data-s="cancel">Close</button></div>`;
    } else if (build.placePlot || build.movePlot) {
      const f = v.field;
      html = `<div class="nc-dhead"><img alt="" src="${art("field-plow")}"><b>${build.placePlot ? "The plow: dig a plot" : "Move the plot"}</b>${build.placePlot ? (f.price ? coins(f.price) : "Free") : ""}<span>Click a tile outside -- off the road and the pavement · ${f.have} / ${f.allowed} plots · Esc to stop</span>
        <button class="nc-btn sm" data-s="cancel">Done</button></div>`;
    } else if (build.pickPlot) {
      const pl = v.field.plots.find((p) => p.uid === build.pickPlot);
      html = pl ? `<div class="nc-dhead"><img alt="" src="${art(pl.crop ? `crop-${pl.crop}-${pl.stage}` : "field-soil")}"><b>${pl.crop ? `A plot of ${esc(pl.name.toLowerCase())}` : "An empty plot"}</b>
        <button class="nc-btn sm" data-s="pmove">Move</button><button class="nc-btn sm" data-s="premove">Fill in${pl.paid ? ` ${coins(Math.floor(pl.paid / 2))}` : ""}</button>
        <button class="nc-btn sm" data-s="cancel">Close</button></div>` : "";
    } else if (build.farm) {
      const f = v.field;
      html = buyTabs("farm") + (!f ? `<p class="nc-dhint">The farm opens at level ${C.FIELD.level}: dig plots with the plow and grow your own ingredients.</p>` : `<div class="nc-cards">
        <div class="nc-card plow"><img alt="" src="${art("field-plow")}"><b>The plow</b><small>${f.have} / ${f.allowed} plots${f.have >= f.allowed && f.nextAt ? ` · more at level ${f.nextAt}` : ""}</small>
          <button class="nc-btn sm" data-plow ${f.have >= f.allowed || v.coins < f.price ? "disabled" : ""}>${f.have >= f.allowed ? "All dug" : f.price ? coins(f.price) : "Dig (free)"}</button></div>
        ${v.decorShop.filter((o) => o.farm).map((o) => `<div class="nc-card${o.open ? "" : " locked"}"><img alt="" src="${art(propPic(o.id))}"><b>${esc(o.name)}</b><small>${o.ware ? `× ${o.ware} stored` : o.open ? "" : `Level ${o.level}`}</small>
          <button class="nc-btn sm" data-put="${o.id}" ${!o.open || (!o.ware && v.coins < o.price) ? "disabled" : ""}>${o.ware ? "Place" : o.open ? coins(o.price) : "Locked"}</button></div>`).join("")}</div>`);
    } else if (build.buildings) {
      // Build > Buildings (2026-10-24): the furniture store, and the buildings to come
      html = buildTabs("buildings") + `<div class="nc-cards">${v.decorShop.filter((o) => o.building).map((o) => `<div class="nc-card wide${o.open ? "" : " locked"}"><img alt="" src="${art(propPic(o.id))}"><b>${esc(o.name)}</b><small>${o.ware ? `× ${o.ware} stored` : v.decor.some((d) => d.id === o.id) ? "On your street" : !o.open ? `Level ${o.level}` : o.mansion ? (v.event.build ? "Till 31 October: spend Halloween's candy here" : "Only 10-31 October") : o.house ? houseSays(v, o) : "A building for your street"}</small>
          <button class="nc-btn sm" data-put="${o.id}" ${!o.open || v.decor.some((d) => d.id === o.id) || (o.mansion && !v.event.build && !o.ware) || (o.house && !o.mansion && !o.houseOn && !o.ware) || (!o.ware && v.coins < o.price) ? "disabled" : ""}>${o.ware ? "Place" : v.decor.some((d) => d.id === o.id) ? "Built" : o.open ? coins(o.price) : "Locked"}</button></div>`).join("")}</div>`;
    } else {
      // (2026-10-24) Outside in categories: the street's things, rocks, trees, plants
      const OUT_CATS = [["all", "All", ALL_STAR], ["street", "Street", art("prop-lamp")], ["stalls", "Stalls", art("prop-icecart")], ["garden", "Garden", art("prop-fountain")], ["rocks", "Rocks", art("prop-rock_mossy")],
                        ["trees", "Trees", art("prop-tree_apple")], ["plants", "Plants", art("prop-plant_flowers")], ["event", "Event", art("prop-hw_pumpkins")]];
      const evOut = (o) => !!(C.DECO[o.id] && C.DECO[o.id].event);
      const inCat = (o) => outCat === "all" || (outCat === "event" ? evOut(o) : outCat === "street" ? !o.nature && !evOut(o) : o.nature === outCat);
      const catRow = `<div class="nc-dcats">${OUT_CATS.map(([id, nm, pic]) => `<button class="nc-cat${id === outCat ? " on" : ""}" data-ocat="${id}" title="${nm}">${pic.startsWith("<") ? pic : `<img alt="" src="${pic}">`}<small>${nm}</small></button>`).join("")}</div>`;
      html = buyTabs("outside") + catRow + `<div class="nc-cards">${v.decorShop.filter((o) => !o.farm && !o.building && inCat(o)).map((o) => `<div class="nc-card${o.open ? "" : " locked"}"><img alt="" src="${art(propPic(o.id))}"><b>${esc(o.name)}</b><small>${o.ware ? `× ${o.ware} stored` : o.open ? "" : `Level ${o.level}`}</small>
          <button class="nc-btn sm" data-put="${o.id}" ${!o.open || (!o.ware && v.coins < o.price) ? "disabled" : ""}>${o.ware ? "Place" : o.open ? coins(o.price) : "Locked"}</button></div>`).join("")}</div>`;
    }
    // (2026-10-24, Cam: "move objects should be on, its the cheat for sims") -- free placement: anywhere, overlapping, unsnapped
    html = `<button class="nc-free${freePlace ? " on" : ""}" data-free title="Free placement: put things anywhere outside, overlapping and off the grid (like the Sims' move-objects cheat)">${freePlace ? "Free placement: on" : "Free placement: off"}</button>` + html;
    html = mysteryCards(html);
    if (!keepScroll(d, html)) return;          // PT52: unchanged -- leave it (and where it's scrolled to) alone
    d.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => openTab(b.dataset.tab)));
    d.querySelectorAll("[data-free]").forEach((b) => b.addEventListener("click", () => { setFree(!freePlace); toast(freePlace ? "Free placement on: anywhere outside, overlapping, off the grid." : "Free placement off."); draw(); }));
    d.querySelectorAll("[data-ocat]").forEach((b) => b.addEventListener("click", () => { outCat = b.dataset.ocat; draw(); }));
    d.querySelectorAll("[data-plow]").forEach((b) => b.addEventListener("click", () => { build = { on: true, street: true, farm: true, placePlot: true }; hoverP = null; draw(); }));
    d.querySelectorAll("[data-put]").forEach((b) => b.addEventListener("click", () => { build = { ...streetHome(), placeDecor: b.dataset.put, dir: 0 }; hoverP = null; draw(); }));
    d.querySelectorAll("[data-s]").forEach((b) => b.addEventListener("click", () => {
      const k = b.dataset.s;
      if (k === "cancel") { build = streetHome(); hoverP = null; return draw(); }
      if (k === "turnnew") return turnHeld(1);
      if (k === "move") { build = { ...streetHome(), moveDecor: pick.uid }; return draw(); }
      if (k === "pmove") { build = { ...streetHome(), movePlot: build.pickPlot }; hoverP = null; return draw(); }
      if (k === "premove") { const pl = v.field.plots.find((p) => p.uid === build.pickPlot); return confirmBox(`Fill in this plot${pl.crop ? ` (and the ${pl.name.toLowerCase()} growing on it)` : ""}${pl.paid ? `? You get ${Math.floor(pl.paid / 2)} coins back.` : "?"}`, () => { const r = act("plotRemove", { uid: pl.uid }); if (r && r.ok) { toast(r.msg); build = streetHome(); draw(); } }); }
      if (k === "turn") return turnHeld(1);
      if (k === "store") { const r = act("decorStore", { uid: pick.uid }); if (r && r.ok) { build = streetHome(); draw(); } return; }
      if (k === "sell") confirmBox(`Sell this ${D[pick.id].name.toLowerCase()} for ${Math.floor(D[pick.id].price / 2)} coins?`, () => { const r = act("decorSell", { uid: pick.uid }); if (r && r.ok) { build = streetHome(); draw(); } });
    }));
  }

  // ---- pop-ups: the cookbook, level-ups, yes/no -----------------------------------------------------------
  function modal(html, cls, key) {
    const m = $("nc-modal");
    // (Cam: clicking in the Halloween catalogue "i dont want it to go back up to the top"): the same page drawn again
    // after a click keeps where its scrolled panes were
    const keep = key && !m.hidden && m.dataset.key === key ? [...m.querySelectorAll(".nc-page, .nc-card-pop")].map((el) => el.scrollTop) : null;
    // (Cam, 25 Oct: "if i stay on the same tab and click a recipe i dont want the cookbook to refresh everytime ... this
    // needs to be consistent throughout the app"): the same pop-up drawn again while it's open doesn't pop in again
    const still = !m.hidden && m.dataset.cls === (cls || "");
    // (the sound effects): a book opening turns a page, the Furniture store rings its shop bell -- once, as it opens,
    // not each time it's drawn again
    const book = (k) => (k || "").split(":")[0];
    if (/\bbook\b/.test(cls || "") && (m.hidden || book(m.dataset.key) !== book(key))) cue(book(key) === "store" ? "bell" : "page");
    m.innerHTML = `<div class="nc-card-pop ${cls || ""}${still ? " still" : ""}">${html}</div>`;
    m.dataset.key = key || ""; m.dataset.cls = cls || "";
    if (keep) [...m.querySelectorAll(".nc-page, .nc-card-pop")].forEach((el, j) => { if (keep[j]) el.scrollTop = keep[j]; });
    m.hidden = false;
    m.onclick = (e) => { if (e.target === m) close(); };
    m.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", close));
    return m;
  }
  function close() { const m = $("nc-modal"); m.hidden = true; m.innerHTML = ""; m.dataset.key = ""; m.dataset.cls = ""; cookFor = null; cbFor = null; }
  /** Cook the dish this stove cooked last (N49 i9). */
  function sameAgain(uid) {
    const it = C.view(state, now()).items.find((i) => i.uid === uid);
    if (!it || !it.last || it.stove.status !== "free") return false;
    const r = act("cook", { uid, dish: it.last });
    if (r && r.ok) toast(r.msg);
    return true;
  }
  function confirmBox(text, yes) {
    const m = modal(`<p class="nc-q">${esc(text)}</p><div class="nc-row"><button class="nc-btn" data-yes>Yes</button><button class="nc-btn ghost" data-close>No</button></div>`, "small");
    m.querySelector("[data-yes]").addEventListener("click", () => { close(); yes(); });
  }
  // ---- the cookbook (2026-10-21): Cafeland's recipe cards -- a title strip, the cost, the time, the takings and a
  // big picture -- on our parchment, in the NeuroPets frame; sorted down the side, a tab for each kind of dish
  const CLOCHE = `<svg class="nc-ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 12h12M3 11.5a5 5 0 0 1 10 0" fill="#e9e1cf" stroke="#5c4a3a" stroke-width="1.3"/><circle cx="8" cy="5.4" r="1" fill="#5c4a3a"/></svg>`;
  const STAR = `<svg class="nc-ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5l1.9 4 4.4.5-3.3 3 .9 4.4L8 11.2 4.1 13.4l.9-4.4-3.3-3 4.4-.5z" fill="#b58be0" stroke="#5a2f86" stroke-width="1"/></svg>`;
  const CLOCK = `<svg class="nc-ic" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.3" fill="#fff6e4" stroke="#a8322a" stroke-width="1.6"/><path d="M8 4.5V8l2.4 1.6" fill="none" stroke="#a8322a" stroke-width="1.5" stroke-linecap="round"/></svg>`;
  // recipe mastery (2026-10-22, Cam): five stars on every card, gold once earned; hovering them shows the cooks each takes
  function masteryHTML(d) {
    const left = d.stars < 5 ? d.need[d.stars] - d.cooks : 0;
    const rows = C.MASTERY.perks.map((pk, i) => `<li class="${i < d.stars ? "got" : ""}"><b>${"★".repeat(i + 1)}</b><span>${esc(pk)}</span><small>${i < d.stars ? "✓" : `${num(d.need[i])} cooks`}</small></li>`).join("");
    return `<span class="nc-rc-stars" aria-label="Mastery ${d.stars} of 5">${[0, 1, 2, 3, 4].map((i) => `<i class="${i < d.stars ? "on" : ""}">★</i>`).join("")}
      <span class="nc-rc-mastery"><b>Mastery</b><em>${d.stars < 5 ? `Cooked ${num(d.cooks)} -- ${num(left)} more for ${"★".repeat(d.stars + 1)}` : `Mastered -- cooked ${num(d.cooks)}`}</em><ul>${rows}</ul></span></span>`;
  }
  const SORTS = [["all", "All", "By level"], ["quick", "⏱", "Quickest first"], ["can", "✓", "Ones you can cook now"], ["az", "A–Z", "By name"]];
  // 2026-10-24 (Cam: "the halloween runs off the side of the screen ... more of a cookbook display like neuropets with
  // recipe icons on the left then when clicking it have all the information on the right ... tabs off the left side of
  // the book, on each tab is the respective icon for each food category"): the catalogue book's spread -- a tab for each
  // menu down the book's left edge, the menu's dishes as pictures on the left page, the one picked on the right with
  // everything about it and Cook. A double-click on a picture cooks it straight away.
  let cbPick = null, cbFor = null;
  function cookbook(uid) {
    cookFor = uid;
    const v = C.view(state, now());
    const tutPancakes = v.tut && v.tut.id === "cook";
    // the menus (V22 q6): a tab each; a locked one says when it opens
    const menus = C.MENUS.map((mn) => ({ ...mn, first: Math.min(...v.cookbook.filter((d) => d.menu === mn.id).map((d) => d.level)) }));
    // V24 q9: opened from a patio appliance, its own book; from a stove, not an appliance's book
    const cooker = uid == null ? null : (v.items.find((i) => i.uid === uid) || {}).kind;
    const own = cooker && C.THINGS[cooker] && C.THINGS[cooker].menu;
    if (own && cookFor !== cbFor) cbMenu = own;
    else if (cooker === "stove" && cookFor !== cbFor && menus.some((mn) => mn.id === cbMenu && mn.cooker)) cbMenu = "breakfast";
    cbFor = cookFor;
    if (!menus.some((mn) => mn.id === cbMenu)) cbMenu = "breakfast";
    if (tutPancakes) cbMenu = "breakfast";
    let list = v.cookbook.filter((d) => d.menu === cbMenu);
    if (cbSort === "quick") list.sort((a, b) => a.secs - b.secs);
    if (cbSort === "az") list.sort((a, b) => a.name.localeCompare(b.name));
    if (cbSort === "can") list = list.filter((d) => d.open && (d.afford || d.field));
    const canCook = (d) => uid != null && d.open && d.on === cooker && (v.coins >= d.cost || d.field);
    if (tutPancakes) cbPick = "pancakes";
    if (!list.some((d) => d.id === cbPick)) cbPick = (list.find(canCook) || list.find((d) => d.open) || list[0] || {}).id || null;
    const d = list.find((x) => x.id === cbPick);
    const mn = menus.find((x) => x.id === cbMenu);
    const tabTip = (x) => x.bar ? `${x.name}'s book: made at the ${x.name.toLowerCase()} and served ${C.THINGS[x.cooker] && C.THINGS[x.cooker].prep ? `out to your counters, the ${esc(C.THINGS[Object.keys(C.THINGS).find((k) => C.THINGS[k].shelf === C.THINGS[x.cooker].menu)].name.toLowerCase())}s first` : "on its own top"}${v.level < x.first ? ` (from level ${x.first})` : ""}` : x.cooker ? `${x.name}'s book: cooked on the ${x.name.toLowerCase()}, out on the patio${v.level < x.first ? ` (from level ${x.first})` : ""}` : x.id === "aunty" ? "Aunty's secret recipes: she sends them in her daily box" : x.id === "halloween" ? "Halloween's recipes: unlocked with candy at the haunted house" : v.level < x.first ? `${x.name}: opens at level ${x.first}` : x.name;
    const tabPic = (x) => x.id === "aunty" ? "cafe/art/ui/aunty-book.webp" : x.cooker ? art(x.cooker + "-l") : art("dish-" + x.pic);
    const tabs = `<div class="nc-cb-tabs2">${menus.map((x) => `<button class="nc-cb-tab2${x.id === cbMenu ? " on" : ""}${v.level < x.first ? " shut" : ""}" data-menu-tab="${x.id}" title="${esc(tabTip(x))}" aria-label="${esc(x.name)}"><img alt="" src="${tabPic(x)}"></button>`).join("")}</div>`;
    // the left page: the menu's dishes as pictures
    const tile = (x) => {
      const hidden = !x.open;                                     // (a question mark till it's yours, 25 Oct)
      return `<button class="nc-cb-dish${x.id === cbPick ? " on" : ""}${x.open ? "" : " locked"}${canCook(x) ? " can" : ""}${tutPancakes && x.id === "pancakes" ? " nc-point" : ""}" data-pick="${x.id}" title="${esc(hidden ? (x.secret && x.menu !== "halloween" ? "A family secret" : "A recipe still to come") : x.name)}">
        ${x.open ? (x.stars ? `<i class="nc-cb-mini">${"★".repeat(x.stars)}</i>` : "") : `<i class="nc-cb-lv">${x.menu === "halloween" && x.secret ? "🎃" : x.secret ? "♥" : x.level}</i>`}
        ${hidden ? QM : `<img alt="" src="${art("dish-" + x.id)}">`}${x.open ? "" : `<small>${x.menu === "halloween" && x.secret ? "🍬 Candy" : x.secret ? "Secret" : `Level ${x.level}`}</small>`}</button>`;
    };
    const left = `<h3 class="nc-bk-h">${esc(mn ? mn.name : "")}<small>${list.filter((x) => x.open).length} of ${list.length}</small></h3>
      <div class="nc-cb-sorts">${SORTS.map(([k, t, tip]) => `<button class="nc-cb-sort${cbSort === k ? " on" : ""}" data-sort="${k}" title="${tip}">${t}</button>`).join("")}</div>
      <div class="nc-cb-dishes">${list.length ? list.map(tile).join("") : `<p class="nc-cb-none">Nothing you can cook right now -- you need more coins or a higher level.</p>`}</div>`;
    // the right page: the dish picked
    let right = `<p class="nc-cb-none">Pick a dish.</p>`;
    if (d && d.secret && !d.open) {
      right = d.menu === "halloween"
        ? `<div class="nc-cb-detail">${QM_BIG}<h2>A Halloween recipe</h2><p>Unlock it with Halloween candy at the haunted house -- then it's yours for good.</p></div>`
        : `<div class="nc-cb-detail">${QM_BIG}<h2>A family secret</h2><p>Aunty keeps this one close. As your café grows, she shares more of them${d.level > v.level ? ` -- not before level ${d.level}` : ""}.</p></div>`;
    } else if (d && !d.open) {
      right = `<div class="nc-cb-detail">${QM_BIG}<h2>A recipe still to come</h2><p>What it is stays a surprise till you get there.</p>
        <div class="nc-cb-foot"><span class="nc-cb-hint">🔒 Opens at level ${d.level}</span></div></div>`;
    } else if (d) {
      const price = d.field ? d.farmPrice : d.price;
      const needs = d.needs.length ? `<h4>Ingredients <small>${d.field ? "all grown: it cooks free and sells for more" : "grow them all in your field to cook it free"}</small></h4>
        <span class="nc-rc-needs">${d.needs.map((n) => `<span class="${n.have < n.n ? "lack" : "ok"}"><img alt="" src="${art("item-" + n.crop)}">${esc(n.name)} ${n.have}/${n.n}</span>`).join("")}</span>` : "";
      const can = canCook(d);
      const foot = !d.open ? `<span class="nc-cb-hint">🔒 Opens at level ${d.level}</span>`
        : uid == null ? (v.items.some((i) => i.kind === d.on) && !tutPancakes ? `<button class="nc-btn nc-cb-cook" data-hold="${d.id}">Cook it on your ${d.on === "stove" ? "stoves" : esc(C.THINGS[d.on].name.toLowerCase())}</button>`
          : `<span class="nc-cb-hint">Click a free ${d.on === "stove" ? "stove" : esc(C.THINGS[d.on].name.toLowerCase())} to cook it</span>`)
        : d.on !== cooker ? `<span class="nc-cb-hint">${d.on === "stove" ? "Cooked on a stove, inside" : C.THINGS[d.on].bar ? `Made at the ${esc(C.THINGS[d.on].name.toLowerCase())}${v.items.some((i) => i.kind === d.on) ? "" : " -- buy one in Buy > Kitchen"}` : `Cooked on the ${esc(C.THINGS[d.on].name.toLowerCase())}, out on the patio${v.items.some((i) => i.kind === d.on) ? "" : " -- buy one in Buy > Kitchen"}`}</span>`
        : can ? `<button class="nc-btn nc-cb-cook${tutPancakes && d.id === "pancakes" ? " nc-point" : ""}" data-dish="${d.id}">${d.field ? "🌱 Cook with your harvest" : `Cook ${COIN}${num(d.cost)}`}</button>`
        : `<span class="nc-cb-hint">Need ${num(d.cost - v.coins)} more coins</span>`;
      right = `<div class="nc-cb-detail">
        <img class="nc-cb-big" alt="" src="${art("dish-" + d.id)}">
        <h2>${esc(d.name)}</h2>
        <div class="nc-cb-chips">
          <span title="Cook time"${d.stars >= 3 ? ` class="up"` : ""}>${CLOCK}${secs(d.secs)}</span>
          ${d.field ? `<span class="up" title="Your own harvest: it costs nothing">🌱 Free</span>` : `<span${v.coins < d.cost ? ` class="lack"` : ""} title="Costs to cook">${COIN}${num(d.cost)} to cook</span>`}
          <span title="XP for serving it">${STAR}${d.xp} XP</span>
          <span title="Each serving sells for"${d.stars >= 2 || d.field ? ` class="up"` : ""}>${COIN}${price} each</span>
          <span title="Servings, and what they all sell for"${d.stars >= 1 || d.field ? ` class="up"` : ""}>${CLOCHE}${d.servings} → ${num(price * d.servings)}</span>
          ${d.noburn ? `<span class="up" title="Mastered: never burns">🔥✕ Never burns</span>` : ""}
        </div>
        ${needs}
        <h4>Mastery</h4>${masteryHTML(d)}
        <p class="nc-cb-hint">${d.stars < 5 ? `Cooked ${num(d.cooks)} -- ${num(d.need[d.stars] - d.cooks)} more for ${"★".repeat(d.stars + 1)}: ${esc(C.MASTERY.perks[d.stars].toLowerCase())}` : `Mastered -- cooked ${num(d.cooks)}`}</p>
        <div class="nc-cb-foot">${foot}</div></div>`;
    }
    const m = modal(`<div class="nc-book nc-cookbook">${tabs}<div class="nc-page l">${left}</div><div class="nc-page r">${right}</div>
      <button class="nc-bk-close" data-close aria-label="Close">${CLOSE_IC}</button></div>`, "book cookbook", "cook:" + cbMenu + ":" + cbSort);
    m.querySelectorAll("[data-dish]").forEach((b) => b.addEventListener("click", () => {
      const r = act("cook", { uid: cookFor, dish: b.dataset.dish });
      if (r && r.ok) { close(); holdStart(b.dataset.dish); }
    }));
    m.querySelectorAll("[data-hold]").forEach((b) => b.addEventListener("click", () => { close(); holdStart(b.dataset.hold); }));
    m.querySelectorAll("[data-pick]").forEach((b) => {
      b.addEventListener("click", () => { cbPick = b.dataset.pick; cookbook(uid); });
      b.addEventListener("dblclick", () => { const x = list.find((y) => y.id === b.dataset.pick); if (x && canCook(x)) { const r = act("cook", { uid: cookFor, dish: x.id }); if (r && r.ok) { close(); holdStart(x.id); } } });
    });
    m.querySelectorAll("[data-sort]").forEach((b) => b.addEventListener("click", () => { cbSort = b.dataset.sort; cookbook(uid); }));
    m.querySelectorAll("[data-menu-tab]").forEach((b) => b.addEventListener("click", () => { cbMenu = b.dataset.menuTab; cbPick = null; cookbook(uid); }));
  }

  // ---- the sandbox (2026-10-21, PT41-PT43): your café or the sandbox; dev tools only in the sandbox ------------
  async function openSlot(name, make) {
    if (simClock && state && state.made) save();                       // (the sandbox's clock, as far as it's got)
    await queue;                                                       // what's open is saved first
    simClock = null;                                                   // (and a new sandbox starts on real time)
    let next = C.normal(await Store.call("cafe_load", [name]));
    if (name === "sandbox" && (!next.made || !next.sandbox || make)) {
      const mine = make === "fresh" ? null : C.normal(await Store.call("cafe_load", ["main"]));
      next = C.sandbox(mine, now(), make === "fresh" || !mine || !mine.made);
    }
    if (next.error) return toast(next.error, true);
    if (next.made && state && state.prefs) next.prefs = state.prefs;        // the music settings go with you
    slot = name; setClock(next); state = next.made ? C.advance(next, now()) : next;
    build = null; hover = null; devOpen = name === "sandbox"; view = { z: 1, x: 0, y: 0 }; groundKey = "";
    if (state.made) save();
    close();
    draw();
    toast(name === "sandbox" ? "The sandbox: try anything, your café isn't touched." : "Back in your café.");
  }
  function drawDev(v) {
    const d = $("nc-dev");
    if (!d) return;
    const was = d.hidden;
    if (!v.sandbox || !devOpen) { d.hidden = true; if (!was) fit(); return; }
    d.hidden = false;
    if (was) requestAnimationFrame(fit);
    const on = (k) => v.dev && v.dev[k] ? " on" : "";
    d.innerHTML = `<div class="nc-dev-head"><b>Dev tools</b><small>Sandbox only</small><button class="nc-x" data-dv="close" aria-label="Close">×</button></div>
      <div class="nc-dev-sec"><h4>Level <span>${v.level}</span></h4><div class="nc-dev-row levels">${[1, 2, 5, 10, 20, 30, 50, 75, 100].map((l) => `<button class="nc-btn sm${v.level === l ? " on" : ""}" data-dv="level" data-n="${l}">${l}</button>`).join("")}
        <input class="nc-input sm" id="nc-dev-level" type="number" min="1" max="${C.MAX_LEVEL}" value="${v.level}" aria-label="Level"><button class="nc-btn sm" data-dv="level" data-from="nc-dev-level">Set</button></div>
        <button class="nc-btn sm wide" data-dv="everything">Everything unlocked</button>
        <button class="nc-btn sm wide${on("allPaints")}" data-dv="paints" title="Every paint and the paint mixer, for trying (off: as you've earned them)">All paints</button></div>
      <div class="nc-dev-sec"><h4>Coins <span>${num(v.coins)}</span></h4><div class="nc-dev-row"><input class="nc-input sm" id="nc-dev-coins" type="number" min="0" value="${v.coins}"><button class="nc-btn sm" data-dv="coins">Set</button></div>
        <div class="nc-dev-row">${[1000, 10000, 100000].map((n) => `<button class="nc-btn sm" data-dv="addCoins" data-n="${n}">+${num(n)}</button>`).join("")}</div></div>
      <div class="nc-dev-sec"><h4>Events: Halloween <span>🍬 ${num(v.candy || 0)} candy</span></h4>
        <div class="nc-dev-row"><button class="nc-btn sm${v.dev && v.dev.event ? " on" : ""}" data-dv="event" title="Halloween by the calendar, forced on, or forced off">Halloween: ${v.dev && v.dev.event ? v.dev.event : "calendar"}</button></div>
        <div class="nc-dev-row"><input class="nc-input sm" id="nc-dev-candy" type="number" min="0" value="${v.candy || 0}" aria-label="Candy"><button class="nc-btn sm" data-dv="candySet" data-from="nc-dev-candy">Set</button></div>
        <div class="nc-dev-row">${[100, 1000, 10000].map((n) => `<button class="nc-btn sm" data-dv="candy" data-n="${n}">+${num(n)}</button>`).join("")}</div></div>
      <div class="nc-dev-sec"><h4>Cooking</h4><div class="nc-dev-row">
        <button class="nc-btn sm${on("instant")}" data-dv="instant" title="Every dish is ready the moment you cook it">Instant cooking</button>
        <button class="nc-btn sm${on("noburn")}" data-dv="noburn" title="Ready dishes wait for ever">No burning</button></div>
        <div class="nc-dev-row"><button class="nc-btn sm" data-dv="mastery" title="Every dish you can cook goes up a mastery star">Mastery +1 star</button><button class="nc-btn sm" data-dv="aunty" title="A new box from Aunty now (today's is replaced)">Aunty's box</button><button class="nc-btn sm" data-dv="cart" title="A new request cart now, from the next tutor (today's goes)">Request cart</button><button class="nc-btn sm" data-dv="grow" title="Everything sown in the field is ripe now">Ripen the field</button><button class="nc-btn sm" data-dv="seeds" title="Five packets of every seed you can grow">+5 seed packets</button><button class="nc-btn sm" data-dv="eggs" title="Every coop's nest full of eggs">Fill the nests</button></div>
        <div class="nc-dev-row"><button class="nc-btn sm" data-dv="potions">+5 of each potion</button><button class="nc-btn sm" data-dv="over" title="Every crop in the field has gone over (for trying the Fresh potion)">Let the field go over</button></div>
        <div class="nc-dev-row"><select id="nc-dev-hap" title="Which happening (or any)"><option value="">Any happening</option>${C.HAPPENINGS.map((h) => `<option value="${h.id}">${h.icon} ${esc(h.id)}</option>`).join("")}</select><button class="nc-btn sm" data-dv="happen" title="Something happens now, into the diary">Happen now</button></div>
        <div class="nc-dev-row"><button class="nc-btn sm" data-dv="finish">Finish now</button><button class="nc-btn sm" data-dv="clean">Clean stoves</button><button class="nc-btn sm" data-dv="fill">Fill counters</button></div></div>
      <div class="nc-dev-sec"><h4>Sell now</h4><div class="nc-dev-row">${(() => {
          const on = {};
          v.items.forEach((it) => (it.plates || (it.dish ? [{ dish: it.dish, n: it.n }] : [])).forEach((p) => { if (p.dish) on[p.dish.id] = (on[p.dish.id] || 0) + p.n; }));
          const ids = Object.keys(on);
          return ids.length ? `<select class="nc-input sm" id="nc-dev-dish">${ids.map((id) => `<option value="${id}">${esc(C.DISH[id].name)} (${on[id]})</option>`).join("")}</select><button class="nc-btn sm" data-dv="sell">Sell</button><button class="nc-btn sm" data-dv="sellAll">Sell all</button>`
            : `<small class="nc-dev-none">Nothing on the counters.</small>`;
        })()}</div></div>
      <div class="nc-dev-sec"><h4>Sky</h4><div class="nc-dev-row">${[["", "Clock"], ["day", "Day"], ["dusk", "Dusk"], ["night", "Night"]].map(([k, t]) => `<button class="nc-btn sm${(v.dev && v.dev.sky || "") === k ? " on" : ""}" data-dv="sky" data-v="${k}">${t}</button>`).join("")}</div></div>
      <div class="nc-dev-sec"><h4>Customers</h4><div class="nc-dev-row">${[1, 2, 3].map((n) => `<button class="nc-btn sm" data-dv="customers" data-n="${n}">Send ${n}</button>`).join("")}
        <button class="nc-btn sm${on("busy")}" data-dv="busy" title="Five times as many customers">Busy</button>
        <button class="nc-btn sm${on("rush")}" data-dv="rush" title="A rush on whatever the clock says: twice the customers">Rush</button></div></div>
      <div class="nc-dev-sec"><h4>Time</h4><div class="nc-dev-row">${[[60, "+1 min"], [600, "+10 min"], [3600, "+1 h"], [8 * 3600, "+8 h"]].map(([n, t]) => `<button class="nc-btn sm" data-dv="skip" data-n="${n}">${t}</button>`).join("")}</div></div>
      <div class="nc-dev-sec"><h4>Café <span>${v.size}x${v.size}</span></h4><div class="nc-dev-row"><button class="nc-btn sm${v.size === 4 ? " on" : ""}" data-dv="size" data-n="4">4x4</button><button class="nc-btn sm${v.size === 5 ? " on" : ""}" data-dv="size" data-n="5">5x5</button></div></div>
      <div class="nc-dev-sec"><h4>The sandbox</h4><div class="nc-dev-row"><button class="nc-btn sm" data-dv="copy">Copy my café again</button><button class="nc-btn sm" data-dv="fresh">Start fresh</button></div></div>`;
    d.querySelectorAll("[data-dv]").forEach((b) => b.addEventListener("click", () => {
      const k = b.dataset.dv;
      if (k === "close") { devOpen = false; return draw(); }
      if (k === "copy") return confirmBox("Replace the sandbox with a fresh copy of your café?", () => openSlot("sandbox", "copy"));
      if (k === "fresh") return confirmBox("Replace the sandbox with a brand-new café?", () => openSlot("sandbox", "fresh"));
      const n = k === "coins" ? +$("nc-dev-coins").value : b.dataset.from ? +$(b.dataset.from).value : +(b.dataset.n || 0);
      const cur = state.cart ? C.TUTORS.findIndex((x) => x.id === state.cart.tutor) : -1, nextTutor = C.TUTORS[(cur + 1) % C.TUTORS.length].id;   // (each press, the next tutor)
      const r = act("dev", { op: k, n, v: k === "cart" ? nextTutor : k === "happen" ? $("nc-dev-hap").value : b.dataset.v, dish: k === "sell" && $("nc-dev-dish") ? $("nc-dev-dish").value : undefined });
      if (r && r.ok && r.msg) toast(r.msg);
    }));
  }
  // PT56 (Cam: "the level up pop ups ... more modern way, at the moment i can't see all unlocks"): a badge and the
  // rewards up top, the unlocks by kind in a grid that scrolls, the button always in sight. Levels that come together
  // (a big serve, the sandbox) gather into the one pop-up instead of each replacing the last.
  let levelsShown = [];
  const LV_GROUPS = [["dish", "New dishes"], ["thing", "Furniture & machines"], ["decor", "Decorations"], ["painting", "For the walls"],
    ["floor", "Floors & walls"], ["paint", "Paints"], ["farm", "The farm"], ["more", "More room"]];
  const lvGroup = (u) => u.kind === "ceil" ? "painting" : u.kind === "wall" || u.kind === "floor" || u.kind === "counters" || u.kind === "halfwall" ? "floor" : u.kind === "crop" || u.kind === "field" ? "farm"
    : u.kind === "expand" ? "more" : LV_GROUPS.some((g) => g[0] === u.kind) ? u.kind : "more";
  function levelUp(e) {
    const m = $("nc-modal");
    if (m.hidden || !m.querySelector(".nc-card-pop.level")) levelsShown = [];
    levelsShown = levelsShown.filter((x) => x.level !== e.level).concat([e]).sort((a, b) => a.level - b.level);
    const pic = (u) => u.kind === "dish" ? art("dish-" + u.id) : u.kind === "crop" ? art("item-" + u.id) : u.kind === "field" ? art("crop-wheat-4") : u.kind === "thing" ? art(shopPic(u.id)) : u.kind === "decor" ? art(propPic(u.id)) : u.kind === "floor" ? art("floor-" + u.id)
      : u.kind === "wall" ? art(has(`wall-${u.id}-l`) ? `wall-${u.id}-l` : "wall-l") : u.kind === "counters" ? art(has(`counter-${u.id}-l`) ? `counter-${u.id}-l` : "counter-l")
      : u.kind === "painting" ? art(C.PAINTING[u.id].pic) : u.kind === "ceil" ? art(u.id) : u.kind === "halfwall" ? art(hwPic(C.HALF_WALL_OF[u.id] || { id: u.id })) : u.kind === "paint" ? paintTin(u.id) : art("floor-grey");
    const L = levelsShown, lo = L[0].level, hi = L[L.length - 1].level, many = L.length > 1;
    const all = [].concat(...L.map((x) => x.unlocks.map((u) => Object.assign({ lv: x.level }, u))));
    const coinsWon = L.reduce((n, x) => n + (x.reward ? x.reward.coins : 0), 0), pots = {}, chest = L.some((x) => x.reward && x.reward.chest);
    L.forEach((x) => x.reward && Object.keys(x.reward.potions).forEach((k) => { pots[k] = (pots[k] || 0) + x.reward.potions[k]; }));
    const groups = LV_GROUPS.map(([id, name]) => ({ name, items: all.filter((u) => lvGroup(u) === id) })).filter((g) => g.items.length);
    const reward = coinsWon || Object.keys(pots).length ? `<div class="nc-lv-reward"><b>${chest ? "A chest!" : "Rewards"}</b>${coinsWon ? `<span>${coins(coinsWon)}</span>` : ""}${Object.keys(pots).map((k) => `<span><img alt="" src="cafe/art/ui/potion-${k}.webp">${pots[k] > 1 ? `×${pots[k]} ` : ""}${esc(C.POTIONS[k].name)}</span>`).join("")}</div>` : "";
    modal(`<header class="nc-lv-head"><div class="nc-lv-badge"><small>LEVEL</small><b>${hi}</b></div>
        <div><h2>${many ? `Levels ${lo}–${hi}!` : "Level up!"}</h2><p>${all.length ? `${all.length} new thing${all.length > 1 ? "s" : ""} to try` : "Keep cooking -- more comes with the next level."}</p></div></header>
      ${reward}
      ${groups.length ? `<div class="nc-lv-body">${groups.map((g) => `<section><h3>${esc(g.name)} <em>${g.items.length}</em></h3><div class="nc-lv-grid">${g.items.map((u) => `<div class="nc-lv-card"><img alt="" src="${pic(u)}"><span>${esc(u.name)}</span>${many ? `<i>Lv ${u.lv}</i>` : ""}</div>`).join("")}</div></section>`).join("")}</div>` : ""}
      <footer class="nc-lv-foot"><button class="nc-btn" data-close>Lovely</button></footer>`, "level");
  }

  // ---- the tutorial: the chef, a speech bubble, a pointer on the thing to click ---------------------------
  function drawTut(v) {
    const t = $("nc-tut");
    document.querySelectorAll(".nc-point").forEach((e) => { if (!e.closest(".nc-modal")) e.classList.remove("nc-point"); });
    const hw = !v.tut && build && build.hwalls && v.halfWalls && v.halfWalls.open && v.halfWalls.lesson;
    t.classList.toggle("hw", !!hw);                                    // (over the build drawer)
    if (hw) return hwLesson(v, t);
    if (!v.tut || build) { t.hidden = true; return; }
    t.hidden = false;
    const chef = v.tut.id === "wait" ? "chef-stir" : v.tut.id === "serve" ? "chef-plate" : "chef-l";
    t.innerHTML = `<img class="nc-chef" alt="" src="${art(chef)}"><div class="nc-say"><small>Chef Rosa · ${v.tut.step + 1} / ${v.tut.of}</small><p>${esc(v.tut.say)}</p><button class="nc-link" data-skip>Skip the tutorial</button></div>`;
    t.querySelector("[data-skip]").addEventListener("click", () => act("skipTutorial", {}));
    const target = { cook: '[data-kind="stove"]', serve: '[data-kind="stove"]', clean: '[data-kind="stove"]', collect: '[data-kind="till"]' }[v.tut.id];
    if (target) { const el = document.querySelector(target); if (el) el.classList.add("nc-point"); }
  }

  // (2026-11-08, Cam: "explain this in tutorial as well") Rosa, the first time Build > Half walls is opened
  const HW_SAY = [
    "Half walls! Low walls and railings that stand on the lines between tiles, not on a tile. The tiles either side stay free, so a wall can run between two counters.",
    "Pick a style, then click a line, or press on one and drag along it for a straight run. Whichever line is nearest the pointer decides it: across, or down. They go inside the café and outside on the grass too, like a garden fence.",
    "Pick a colour from the swatches before you build, from the paints you own. To repaint, pick the colour and drag over walls already built: changing their look is free.",
    "Each piece is {seg} coins, and you get them back when you take it down (right-click a piece, or Take down). Customers can't step across, so leave a way in to your counters and the till.",
    "The styles are the old dividers and the patio railings. The white half-wall and the plain wood railing are free; the others are bought once at the furniture store. Any you already had are yours."];
  let hwStep = 0;
  function hwLesson(v, t) {
    t.hidden = false;
    const n = Math.min(hwStep, HW_SAY.length - 1), last = n === HW_SAY.length - 1;
    t.innerHTML = `<img class="nc-chef" alt="" src="${art("chef-l")}"><div class="nc-say"><small>Chef Rosa · Half walls ${n + 1} / ${HW_SAY.length}</small><p>${esc(HW_SAY[n].replace("{seg}", v.halfWalls.seg))}</p><button class="nc-btn sm" data-hwnext>${last ? "Got it" : "Next"}</button></div>`;
    t.querySelector("[data-hwnext]").addEventListener("click", () => { if (last) { hwStep = 0; act("lesson", { id: "halfwalls" }, true); } else { hwStep++; drawTut(v); } });
  }

  // ---- the first screen: name your café ---------------------------------------------------------------------
  function drawStart() {
    document.body.classList.add("nc-starting");
    $("nc-world").innerHTML = "";
    const m = modal(`<img class="nc-chef big" alt="" src="${art("chef-r")}">
      <h2>Your aunt's café</h2><p>She's left it to you -- four tiles, one stove and a lot of love.</p>
      <input class="nc-input" id="nc-cafename" maxlength="32" placeholder="The Corner Café" aria-label="Your café's name">
      <button class="nc-btn" data-open>Open the café</button>`, "start");
    m.onclick = null;
    const go = () => { const r = C.act(state, "start", { name: $("nc-cafename").value }, now()); if (r.ok) { state = r.state; save(); close(); document.body.classList.remove("nc-starting"); draw(); } else toast(r.error, true); };
    m.querySelector("[data-open]").addEventListener("click", go);
    $("nc-cafename").addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
    setTimeout(() => $("nc-cafename") && $("nc-cafename").focus(), 50);
  }

  // ---- drawing, and the clock ----------------------------------------------------------------------------
  // what needs the whole café drawn again (things moved, bought, cooked, a dish on or off a counter) ...
  function signature(v) {
    haunted = !!(v.event && v.event.on);
    return JSON.stringify([haunted, v.homes && Object.keys(v.homes).map((k) => [k, v.homes[k].order && v.homes[k].order.n, v.homes[k].order && v.homes[k].order.have >= v.homes[k].order.n]), v.style, v.open, v.floors, v.outFloors, skyNow(v).name, v.decor, v.dware, v.sandbox, v.dev, v.level, v.size, v.floor, v.hangOff, v.ceil, v.hwalls, v.items.map((i) => [i.uid, i.x, i.y, i.dir, i.off, i.tint && [i.tint.h, i.tint.s, i.tint.b], i.stove && i.stove.status, i.dish && i.dish.id, i.plates && i.plates.map((p) => p.dish && p.dish.id)]), v.tut && v.tut.id, v.ware, !!build, v.cart && [v.cart.tutor.id, v.cart.order.map((l) => l.got)], v.field && v.field.plots.map((p) => [p.uid, p.x, p.y, p.crop, p.stage, p.ready, p.spoiled, p.ready && p.spoilsIn < p.keep * 0.35])]);
  }
  // ... and what's only numbers (N40): the top bar and the few things showing them are updated in place
  function numbers(v) {
    return JSON.stringify([v.coins, v.till, v.xp, v.items.map((i) => [i.vend || 0, i.n, i.tip, i.plates && i.plates.map((p) => p.n)])]);
  }
  function draw() {
    if (!state) return;
    applyFx();
    if (!state.made) return drawStart();
    if (!build) { undo.length = 0; peek = null; }
    if (build || potionMode) holdDrop();
    const v = C.view(state, now());
    sig = signature(v); nums = numbers(v);
    drawHud(v);
    drawDrawer(v);
    drawWorld(v);
    drawTut(v);
    drawDev(v);
    beat(true);
  }
  /** N40: the café as of now, worked out at most once a second (or when something's done) -- the clock ticks 8 times a
      second for the people walking, who are placed by the time from the view's timetable; working the whole café out
      every tick made ~0.6 MB of throwaway objects a second. */
  let viewCache = null, viewAt = 0, viewOf = null, tickV = null;
  function liveView() {
    // (by the real clock: up to a second old, a quarter of one while the sandbox is fast-forwarding)
    const t = now(), r = realNow(), keep = simClock && simClock.speed > 1 ? 250 : 1000;
    if (viewOf !== state || r - viewAt >= keep || r < viewAt) { viewCache = C.view(state, t); viewAt = r; viewOf = state; }
    return viewCache;
  }
  /** The clock (2026-10-21, Cam): the real time, top centre, see-through -- the café's day (the sky) and its rushes run
      on it. Under it, the rush that's on (twice the customers) or the next one. */
  let clockHTML = "", rushSeen;
  const hhmm = (t) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  function drawClock(v) {
    const el = $("nc-clock");
    if (!el) return;
    if (!el.dataset.wired) {
      el.dataset.wired = "1";
      el.addEventListener("click", (e) => {
        if (!e.target.closest("[data-speed]") || !simClock) return;
        const n = SPEEDS[(SPEEDS.indexOf(simClock.speed) + 1) % SPEEDS.length];
        setSpeed(n);
        toast(n === 1 ? "Real time." : `Fast forward: ×${n}.`);
        drawClock(liveView());
      });
    }
    const r = v.rush, n = v.nextRush;
    const sp = simClock ? simClock.speed : 1, ff = v.sandbox ? `<button class="nc-speed${sp > 1 ? " on" : ""}" data-speed title="Sandbox speed: ×${sp} -- click for ${SPEEDS[(SPEEDS.indexOf(sp) + 1) % SPEEDS.length] === 1 ? "real time" : "faster"}" aria-label="Speed ×${sp}">${"▶".repeat(SPEEDS.indexOf(sp) + 1)}<small>×${sp}</small></button>` : "";
    const html = `<b>${hhmm(now())}${ff}</b>${r ? `<span class="nc-rush on">${esc(r.name)} · ×${r.x} customers till ${hhmm(r.ends)}</span>`
      : n ? `<span class="nc-rush">${esc(n.rush.name)} at ${hhmm(n.at)}</span>` : ""}`
      // V25 q1: a candy-store spell that's on, and how long it has left (to the minute)
      + [["golden", "Golden tips"], ["crowd", "Crowd potion"]].filter(([k]) => (v.boost || {})[k] > now()).map(([k, nm]) => `<span class="nc-rush on">✨ ${nm} · ${Math.ceil(((v.boost[k]) - now()) / 60000)} min left</span>`).join("");
    if (html !== clockHTML) { el.innerHTML = html; clockHTML = html; }
    el.classList.toggle("rush", !!r);
    const id = r ? r.id : "";
    if (rushSeen !== undefined && id && id !== rushSeen && v.open) toast(`${r.name}! Twice the customers till ${hhmm(r.ends)}.`);
    rushSeen = id;
  }
  function tick() {
    if (!state || !state.made || document.hidden || away) return;        // N40: nothing to draw while the window's hidden
    // (graphics: not the window in use, on Balanced or Light -- the people and numbers once a second, not eight times)
    if (!focused && C.prefs(state).fx !== "full") { const t0 = Date.now(); if (t0 - slowAt < 950) return; slowAt = t0; }
    // N40: the bobbing, smoke and walking sway step with this clock (cafe.css) -- no endless CSS animations
    // (2026-10-26 performance: the classes go on the moving things only. On <body> each flip made the browser redraw the
    // whole painted ground -- its soft-edged SVG -- three CPU cores' worth on a 30x30 café. The water no longer ripples.)
    if (!resting()) beat();
    // (the jukebox's rainbow: its hue steps on with the clock once a second, a full turn in 14 s, and CSS slides it
    // smoothly between steps -- the degrees only ever climb, so it never spins back round)
    // (2026-10-25: on the glows themselves, a small step every beat -- setting it on body restyled the whole page)
    const hue = Math.round((Date.now() / 14000) * 360) % 360 + "deg";
    if (!resting()) document.querySelectorAll(".nc-mglow.jukebox").forEach((g) => { if (g.style.getPropertyValue("--nc-hue") !== hue) g.style.setProperty("--nc-hue", hue); });
    const v = liveView();
    if (v !== tickV) {                      // the signatures only when the view is new (N40: once a second at most)
      tickV = v;
      drawClock(v);
      const s = signature(v);
      if (s !== sig) { dirty = true; sig = s; nums = numbers(v); drawHud(v); drawDrawer(v); drawWorld(v); drawTut(v); beat(true); return; }
      const n = numbers(v);
      if (n !== nums) { dirty = true; nums = n; drawHud(v); drawDrawer(v); drawDev(v); if (!patchThings(v)) drawWorld(v); beat(true); }
    }
    people(v);
    const t = now();
    // (2026-10-25: only what's changed is written -- the same text written again still repaints it, 8 times a second)
    document.querySelectorAll(".nc-bub[data-ready]").forEach((e) => { const c = clock(+e.dataset.ready - t); if (e.textContent !== c) e.textContent = c; });
    document.querySelectorAll(".nc-ring[data-ready]").forEach((e) => {          // by the clock, between new views
      const p = String(Math.round(Math.max(0, Math.min(1, 1 - (+e.dataset.ready - t) / (+e.dataset.secs * 1000))) * 100));
      if (e.style.getPropertyValue("--p") !== p) e.style.setProperty("--p", p);
    });
    document.querySelectorAll("[data-burn]").forEach((e) => { const left = (+e.dataset.burn - t) / (+e.dataset.secs * 1000); const w = Math.round(Math.max(0, Math.min(100, left * 100)) * 2) / 2 + "%"; if (e.firstChild.style.width !== w) e.firstChild.style.width = w; e.classList.toggle("hot", left < 0.35); });
  }
  setInterval(tick, 120);
  // what moves on the beat: nc-up twice a second (bobbing bubbles, smoke, the pointer's pulse, lamp flicker, the fog
  // machine's puffs), nc-sway four times (walking, the fog's flicker) -- see cafe.css
  const UP_SEL = ".nc-thing.burnt, .nc-bub, .nc-point, .nc-lampglow, .nc-hord, .nc-fog, .nc-crate-st", SWAY_SEL = ".nc-person.walk, .nc-fog.f1, .nc-fog.f3";
  let beatAt = { up: null, sway: null };
  function beat(force) {
    if (resting()) return;
    const b = Math.floor(Date.now() / 250), sway = b % 2 === 1, up = Math.floor(b / 2) % 2 === 1;
    // (a redraw makes new elements: they take the beat's state at once, so nothing waits a beat to join in)
    if (force || up !== beatAt.up) document.querySelectorAll(UP_SEL).forEach((e) => { if (e.classList.contains("nc-up") !== up) e.classList.toggle("nc-up", up); });
    if (force || sway !== beatAt.sway) document.querySelectorAll(SWAY_SEL).forEach((e) => { if (e.classList.contains("nc-sway") !== sway) e.classList.toggle("nc-sway", sway); });
    beatAt = { up, sway };
  }
  // (2026-10-25 performance pass) tucked away in its scratchpad the page isn't "hidden", so neurocafe.py says so: no
  // drawing at all till it's back (the café's clock runs on regardless -- it's worked out from the time)
  let away = false;
  window.NCAway = (a) => { away = !!a; if (!away && state && state.made) { sig = ""; tick(); } };
  // what the clock did (customers paid, dishes burnt) is kept every so often
  // (and while the sandbox fast-forwards: how far ahead its clock has got)
  setInterval(() => { if (state && state.made && (dirty || (simClock && simClock.speed > 1))) { state = C.advance(state, now()); save(); } }, 15000);
  // ---- turning what you hold with the keys (2026-10-21, the play test team's most asked-for) ------------------------
  // The arrow keys (or R) turn the thing you're placing or moving -- the ghost turns where it stands, so you see how
  // it will sit before you click -- and a picked thing turns where it is. Right/Down one way, Left/Up the other.
  const KEYS_HINT = "← → or right-click turn · Shift+arrows move · Enter drops";
  /** The way the thing in your hand faces now: the turn you've given it, else its own. */
  function heldDir(v) {
    // N49 i7: a chair beside a table turns to face it -- until you turn it yourself
    const kind = build.place || (build.move && (state.items.find((i) => i.uid === build.move) || {}).kind);
    if (kind && !build.turned && hover) { const a = C.autoFace(state, kind, hover.x, hover.y, build.move || -1); if (a != null) return a; }
    if (build.dir != null) return build.dir;
    if (build.move) return (v.items.find((i) => i.uid === build.move) || {}).dir || 0;
    if (build.moveDecor) return (v.decor.find((o) => o.uid === build.moveDecor) || {}).dir || 0;
    return 0;
  }
  /** Turn what you're holding (or have picked) one step; false when there's nothing to turn. */
  function turnHeld(step) {
    if (!build || !state) return false;
    const v = C.view(state, now());
    const kind = build.place || (build.move && (v.items.find((i) => i.uid === build.move) || {}).kind);
    if (kind || build.placeDecor || build.moveDecor) {
      const turns = kind ? (C.THINGS[kind] && C.THINGS[kind].turns) || 4 : 4;
      build.dir = ((heldDir(v) + step) % turns + turns) % turns; build.turned = true;
      draw();
      return true;
    }
    if (build.street && build.pickDecor) { act("decorTurn", { uid: build.pickDecor, by: step, free: freePlace }); return true; }
    if (build.pick) { act("rotate", { uid: build.pick, by: step }); return true; }
    return false;
  }
  /** The size buttons of a plant that grows (C.GROW): smaller (-) and bigger (=), greyed at the ends. */
  function growBtns(sc, max, attr) {
    const a = attr || "data-s";
    return `<button class="nc-btn sm" ${a}="smaller" title="Smaller (-)"${sc > 0 ? "" : " disabled"}>Smaller −</button><button class="nc-btn sm" ${a}="bigger" title="Bigger (=)"${sc < max ? "" : " disabled"}>Bigger +</button>`;
  }
  /** (2026-10-25, Cam: "scale the ferns, hedges, round bush up 2 sizes by pressing the = key and back down using the -
      key") the plant you're holding, moving or have picked out on the street: a size bigger or smaller. */
  function growHeld(by) {
    if (!build || !state) return false;
    if (!build.street) {                                            // inside: the thing you're placing, moving or have picked
      if (build.place) {
        const mx = C.thingGrowMax(build.place);
        if (!mx) return false;
        build.scale = Math.max(0, Math.min(mx, (build.scale | 0) + by)); draw(); return true;
      }
      const uid = build.move || build.pick, it = uid && state.items.find((i) => i.uid === uid);
      if (!it || !C.thingGrowMax(it.kind)) return false;
      act("scale", { uid, by });
      return true;
    }
    if (build.placeDecor) {
      const mx = C.growMax(build.placeDecor);
      if (!mx) return false;
      build.scale = Math.max(0, Math.min(mx, (build.scale | 0) + by)); draw(); return true;
    }
    const uid = build.moveDecor || build.pickDecor, o = uid && state.decor.find((d) => d.uid === uid);
    if (!o || !C.growMax(o.id)) return false;
    act("decorScale", { uid, by, free: freePlace });
    return true;
  }
  /** Back out one step (Esc, or a right-click with nothing held): a potion, a pop-up, what you hold, then Build itself. */
  function back() {
    if (potionMode) { potionMode = null; document.body.classList.remove("nc-potion"); toast("Put the potion away."); return; }
    if (!$("nc-modal").hidden && state && state.made) return close();
    if (hold && hold.seed) { seedAt = { sec: null, pick: hold.seed, plot: null }; holdDrop(); return seedShop(null); }
    if (hold) { const D = C.DISH[hold.dish]; holdDrop(); cbPick = D.id; cbMenu = D.menu || "breakfast"; return cookbook(null); }
    if (!build) return;
    if (build.select && sel) { sel = null; selDrag = null; peek = null; return draw(); }   // (Build > Select: Esc lets go of the box first)
    if (build.hwalls && (build.style || build.erase)) { build = { on: true, hwalls: true }; hwDrag = null; hoverE = null; return draw(); }
    if (build.street) {
      if (build.placeDecor || build.moveDecor || build.pickDecor || build.placePlot || build.movePlot || build.pickPlot) { build = streetHome(); hoverP = null; }
      else build = null;
      return draw();
    }
    if (build.place || build.move || build.pick || build.hang || build.moveHang || build.pickHang || build.ceil || build.moveCeil || build.pickCeil) { build = { on: true }; hover = null; hoverW = null; draw(); }
    else { build = null; draw(); }
  }
  /** N49 i2: Shift+arrows move what you hold (or a picked thing) a tile at a time. Right/Left along one wall, Down/Up
      along the other. */
  function nudge(dx, dy) {
    const v = C.view(state, now());
    if (build.place || build.move) {
      const mv = build.move && state.items.find((i) => i.uid === build.move);
      const b = hover || (mv ? { x: mv.x, y: mv.y } : C.entry(state));
      hover = { x: Math.max(0, Math.min(v.size - 1, b.x + dx)), y: Math.max(0, Math.min(v.size - 1, b.y + dy)) };
      drawWorld(C.view(state, now()));
      return true;
    }
    if (build.placeDecor || build.moveDecor) {
      const dc = build.moveDecor && state.decor.find((o) => o.uid === build.moveDecor);
      const b = hoverP || (dc ? { x: dc.x, y: dc.y } : { x: -1, y: -1 });
      hoverP = { x: b.x + dx * 0.5, y: b.y + dy * 0.5 };
      drawWorld(C.view(state, now()));
      return true;
    }
    if (build.pick) { const it = state.items.find((i) => i.uid === build.pick); if (it) act("move", { uid: it.uid, x: it.x + dx, y: it.y + dy }); return true; }
    if (build.pickDecor) { const dc = state.decor.find((o) => o.uid === build.pickDecor); if (dc) act("decorMove", { uid: dc.uid, x: dc.x + dx * (freePlace ? 0.1 : 0.5), y: dc.y + dy * (freePlace ? 0.1 : 0.5), free: freePlace }); return true; }
    return false;
  }
  /** Enter puts down what you hold where its ghost is. */
  function dropHeld() {
    if ((build.place || build.move) && hover) { dropItemAt(hover); return true; }
    if ((build.placeDecor || build.moveDecor) && hoverP) { dropDecorAt(hoverP); return true; }
    return false;
  }
  /** N49 i11: Ctrl+Z in Build -- the café as it was before the last thing you did there, with the time since replayed. */
  function undoLast() {
    if (!undo.length) { toast("Nothing to undo."); return; }
    state = C.advance(undo.pop(), now());
    dirty = true; save();
    build = build && build.street ? streetHome() : { on: true }; hover = null; hoverP = null;
    draw();
    toast("Undone.");
  }
  // N49 i8: one key for each round button; with a thing picked in Build: M move, T store, Delete sell
  // (2026-10-24, Cam: WASD pans the camera everywhere -- so Aunty's box has no key now, and store moved from S to T)
  const MENU_KEYS = { b: "build", u: "buy", c: "book", g: "bag", p: "upgrades", f: "field", l: "diary" };
  // WASD (Cam: "pan the camera ... when I am using the mouse already"): held keys glide the view, together for diagonals
  const PAN_KEYS = { w: [0, 1], s: [0, -1], a: [1, 0], d: [-1, 0] }, panHeld = new Set();
  let panLast = 0;
  function panStep(t) {
    if (!panHeld.size) { panLast = 0; return; }
    const dt = panLast ? Math.min(0.05, (t - panLast) / 1000) : 1 / 60, main = $("nc-main");
    panLast = t;
    let dx = 0, dy = 0;
    panHeld.forEach((k) => { dx += PAN_KEYS[k][0]; dy += PAN_KEYS[k][1]; });
    const sp = 720 * dt, lim = 1.4 * Math.max(main.clientWidth, main.clientHeight) * view.z;
    view.x = Math.max(-lim, Math.min(lim, view.x + dx * sp));
    view.y = Math.max(-lim, Math.min(lim, view.y + dy * sp));
    fit();
    requestAnimationFrame(panStep);
  }
  document.addEventListener("keyup", (e) => panHeld.delete(e.key.toLowerCase()));
  window.addEventListener("blur", () => panHeld.clear());
  document.addEventListener("keydown", (e) => {
    if (!state || !state.made) return;
    if (e.key === "Escape") return back();
    if (e.target && e.target.closest && e.target.closest("input, textarea, select")) return;
    // WASD pans everywhere (Cam): with a menu, the drawer or a pop-up open too -- only typing in a box keeps the letters
    const pk = e.key.toLowerCase();
    if (PAN_KEYS[pk] && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) { e.preventDefault(); if (!panHeld.has(pk)) { panHeld.add(pk); if (panHeld.size === 1) requestAnimationFrame(panStep); } return; }
    const modal = !$("nc-modal").hidden;
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "z") { if (build && !modal) { e.preventDefault(); undoLast(); } return; }
    if (e.ctrlKey || e.altKey || e.metaKey || modal) return;
    const arrow = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] }[e.key];
    if (arrow && e.shiftKey) { if (build && nudge(arrow[0], arrow[1])) e.preventDefault(); return; }
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1, r: 1, R: -1 }[e.key];
    if (step) { if (build && turnHeld(step)) e.preventDefault(); return; }
    if (e.key === "Enter") { if (build && dropHeld()) e.preventDefault(); return; }
    if (e.key === "=" || e.key === "+" || e.key === "-" || e.key === "_") { if (build && growHeld(e.key === "=" || e.key === "+" ? 1 : -1)) e.preventDefault(); return; }
    if (e.key === " ") { if (!build && hoverUid != null && sameAgain(hoverUid)) e.preventDefault(); return; }   // N49 i9
    const k = e.key.toLowerCase();
    if (MENU_KEYS[k]) { const b = document.querySelector(`[data-menu="${MENU_KEYS[k]}"]`); if (b) { e.preventDefault(); b.click(); } return; }
    if (build && (build.pick || build.pickDecor)) {
      const what = { m: "move", t: "store", delete: "sell", backspace: "sell" }[k], b = what && document.querySelector(`#nc-drawer [${build.pickDecor ? "data-s" : "data-b"}="${what}"]`);
      if (b) { e.preventDefault(); b.click(); }
    }
  });
  // N49 i12: point at a floor, wallpaper, counter style or painting card and the café tries it on until you move off
  function setPeek(p) {
    if (JSON.stringify(p) === JSON.stringify(peek)) return;
    peek = p; lastThing.clear();
    if (state && state.made) drawWorld(C.view(state, now()));
  }
  $("nc-drawer").addEventListener("mouseover", (e) => {
    const card = e.target.closest && e.target.closest(".nc-card");
    const b = card && !card.classList.contains("locked") && card.querySelector("[data-floor], [data-paper], [data-hangbuy]");   // (counter styles: the furniture store's now)
    setPeek(!b ? null : b.dataset.floor ? { floor: b.dataset.floor } : b.dataset.paper ? { wall: b.dataset.paper } : { hang: b.dataset.hangbuy });
  });
  $("nc-drawer").addEventListener("mouseleave", () => setPeek(null));

  // chairs whose backs are painted (N39; Halloween's, N67) turn four ways
  Object.keys(C.THINGS).forEach((k) => { const T = C.THINGS[k]; if (T.seat && T.turns === 2 && has(k + "-bl") && has(k + "-br")) T.turns = 4; });

  // ---- start ----------------------------------------------------------------------------------------------
  (async function boot() {
    // if Python never answers, say so (NeuroFarm 1.0.68: a blank page when its bridge couldn't start)
    const saved = await Promise.race([Store.call("cafe_load", [slot]), new Promise((ok) => setTimeout(() => ok({error: "timeout"}), 10000))]);
    if (saved && saved.error === "timeout") {
      modal(`<h2>NeuroCafe couldn't reach its save</h2><p>The window started, but it can't talk to the part that keeps your café. Close it and open it again (Super+Alt+J).</p>`, "small").onclick = null;
      return;
    }
    state = C.normal(saved && !saved.error ? saved : C.empty());
    music.apply(C.prefs(state));
    loadMusic();
    if (state.made) state = C.advance(state, now());
    try { await Store.call("hello", []); } catch (e) { /* no bus: fine */ }
    try { const ph = await Store.call("cafe_photos", []); if (ph && typeof ph === "object" && !ph.ok && !ph.error) PHOTOS = ph; } catch (e) { /* none */ }
    // (the cards take a moment to read: in the background, and the frames drawn again when they come)
    Promise.resolve(Store.call("cafe_cards", [])).then((cd) => { if (cd && typeof cd === "object" && !cd.error && Object.keys(cd).length) { CARDS = cd; sig = ""; } }).catch(() => {});
    draw();
    drawLook();
  })();
  window.NeuroCafe = { get state() { return state; }, act, draw };
})();
