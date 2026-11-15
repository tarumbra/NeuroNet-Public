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

