/* NeuroArcana's page (v2, 2026-11-01). It draws what ArcanaCore decides and turns clicks into actions; it never decides
   a rule itself. The art director's pieces (card back, foil packs, the guides' portraits) come from art.js.
   Memory: one delegated listener per kind of event on the document (none per card, none per render); every timer and
   animation frame goes through later()/frame() and is cleared when the screen changes. Overlays that outlive a screen
   (the pack opening, toasts) clean themselves up.
   Security: every text from the save or the art manifest is escaped (esc) before it reaches innerHTML. */
(() => {
  "use strict";
  const C = window.ArcanaCore, ART = window.ArcanaArt;
  const Store = window.AAStore || { call: async () => ({ error: "No shell." }) };
  const $ = (id) => document.getElementById(id);
  const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (ch) => ESC[ch]);
  const num = (n) => Math.round(n).toLocaleString();
  const now = () => Date.now();
  const BACK = `<img class="aa-backart" src="/arcana/img/decks/gilded-observatory/back.webp" alt="" draggable="false">`;      // the painted back (was ART.back)

  let state = null, screen = "home", ui = {}, busy = false;
  const timers = new Set(), frames = new Set();
  const later = (ms, f) => { const t = setTimeout(() => { timers.delete(t); f(); }, ms); timers.add(t); return t; };
  const wait = (ms) => new Promise((r) => later(ms, r));
  // the game's own painted art (tools/cut_art.py cuts Cam's sheets into ui/arcana/img/, 1 Nov)
  const IMG = (rel) => `/arcana/img/${rel}.webp`;      // (from the root: a url() inside a CSS variable is read against the stylesheet)
  /** Art Prompts 14: a painted sigil per deck (signature cards, scouting) and the hunts / fears / kind-of-card marks.
      A deck without one (a deck Cam adds later) keeps the gold ✧; the oracle kind has no mark. */
  const SIGIL_DECKS = new Set(["murder-of-crows", "splendor-solis", "old-school-tarot", "tarot-of-divine", "secrets-of-the-witches-garden", "wonderland-in-tarot",
    "gilded-observatory", "carnival-of-souls", "the-viking-oracle", "the-rooted-woman-oracle", "deadly-apothecary-oracle"]);
  const deckSigil = (slug, cls) => SIGIL_DECKS.has(slug) ? `<img class="aa-decksig ${cls || ""}" src="${IMG("sigils/" + slug)}" alt="" draggable="false">` : "";
  const MARKS = { hunt: "hunt", fear: "fear", major: "kind-major", court: "kind-court", pip: "kind-pip" };
  const mark = (k) => MARKS[k] ? `<img class="aa-affmark" src="${IMG("sigils/" + MARKS[k])}" alt="" draggable="false">` : "";
  const icon = (name, cls) => `<img class="aa-ico${cls ? " " + cls : ""}" src="${IMG("icons/" + name)}" alt="" draggable="false">`;
  const face = (who, cls) => `<img class="aa-face-img${cls ? " " + cls : ""}" src="${IMG("portraits/" + who)}" alt="" draggable="false">`;
  const sealMark = (id, cls) => `<span class="aa-wax painted${cls ? " " + cls : ""}${id ? " s-" + id : " unknown"}" title="${id ? esc(C.SEAL[id].name + " -- when " + C.SEAL[id].when + ": " + C.SEAL[id].text) : "A Seal, face down"}"><img src="${IMG("seals/" + (id || "back"))}" alt="" draggable="false"></span>`;
  const FIELD_GLYPH = { fire: "△", water: "▽", air: "🜁", earth: "🜃" };
  const fieldWords = (f) => { const F = C.FIELD[f], down = { wands: "swords", cups: "wands", swords: "pentacles", pentacles: "cups" }[F.suit]; return `${F.name}: ${C.SUIT[F.suit].name} +2 Power, ${C.SUIT[down].name} −1`; };
  const keeperFace = (camp, st, cls) => face((camp === "oracle" ? "oracle-" : "fool-") + st, cls);
  // which painted scene a battle is fought in: each road, each realm of the Pilgrimage, each mode
  const REALMS = { "carnival-of-souls": "carnival", "the-viking-oracle": "northern", "the-rooted-woman-oracle": "rooted", "deadly-apothecary-oracle": "apothecary" };
  function sceneOf(B) {
    if (B.mode === "journey") { const st = B.opts.station; if (B.opts.camp !== "oracle") return "clash-fool"; const P = C.PILGRIMAGE[st - 1]; return P && REALMS[P.realm] ? "realm-" + REALMS[P.realm] : "clash-oracle"; }
    if (B.field && B.mode !== "tutorial") return "field-" + B.field;                     // (Art Prompts 10: the four fields)
    return { skirmish: "clash-skirmish", gauntlet: "clash-gauntlet", trial: "clash-trial", tutorial: "clash-tutorial", keeps: "clash-skirmish" }[B.mode] || "clash-skirmish";
  }
  // each page's painted backdrop, dim behind it
  const PAGE_ART = { home: "page-home", play: "page-home", store: "page-store", readings: "page-reading", divine: "page-reading", combos: "page-library", journal: "page-library", diary: "page-library", nearby: "page-home", profile: "page-library", collection: "page-library", tent: "page-scouting", library: "page-library" };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));          // (for overlays that outlive the screen)
  const frame = (f) => { const id = requestAnimationFrame((ts) => { frames.delete(id); f(ts); }); frames.add(id); return id; };
  function clearAll() { timers.forEach(clearTimeout); timers.clear(); frames.forEach(cancelAnimationFrame); frames.clear(); busy = false; }

  // ---- keeping: one save at a time, in order ----
  let saving = Promise.resolve();
  function persist() { const snap = state; saving = saving.then(() => Store.call("save", [snap])).then((r) => { if (r && r.error) toast(r.error, true); }).catch(() => {}); }
  function act(name, opts) {
    const r = C.act(state, name, opts || {}, now());
    if (!r.ok) { if (r.error) { toast(r.error, true); sfx("no"); } return r; }
    state = r.state; persist();
    const won = r.events.find((e) => e.kind === "achieved");
    if (won) { Store.call("ach_add", [won.diff, { ids: won.ids, by: state.name || activeProfile().name }]).then((x) => { if (x && x.easy) diaryRec = x; }).catch(() => {});
      won.ids.forEach((id, k) => later(600 + k * 1600, () => { toast("✦ Achievement (" + TIER[won.diff] + "): " + C.ACH_BY[id].name); sfx("rare"); })); }
    r.events.filter((e) => e.kind === "missionDone").forEach(() => toast("✦ A mission is done -- claim it on Home."));
    if (r.events.some((e) => e.kind === "result")) noteResult(r);
    if (name !== "libSync") later(0, libCheck);                  // (a page may have been earned)
    return r;
  }
  const V = () => C.view(state, now());

  function toast(text, bad) {
    const t = document.createElement("div");
    t.className = "aa-toast" + (bad ? " bad" : ""); t.textContent = text;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3300);
  }
  const ICON = {
    library: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 4h3v16H4zM8.5 4h3v16h-3zM13.5 5.2l2.9-.8 4 15.4-2.9.8z"/></svg>',
    spyglass: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 15.5 15.5 3l3 3L6 18.5z"/><path d="M12.5 6l3 3M8.5 10l3 3M6 18.5 8 21M10 16.5l2 4.5"/></svg>',
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>',
    battle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 20l7-7M14.5 3.5l6 6-9 9-6-6zM3 14l7 7"/></svg>',
    cards: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="5" width="11" height="16" rx="2"/><path d="M8 3h11a2 2 0 0 1 2 2v14"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5M9 7h6M9 10h6"/><path d="M12 13l1 2 2 .3-1.5 1.4.4 2-1.9-1-1.9 1 .4-2L9 15.3 11 15z" fill="currentColor"/></svg>',
    store: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 8h16l-1 12H5zM8 8V6a4 4 0 0 1 8 0v2"/></svg>',
    divine: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="8"/><path d="M12 4a6 8 0 0 0 0 16M4 12h16"/></svg>',
    diary: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M7 4h10v4a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M9 17h6"/></svg>',
    journal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 3h12a2 2 0 0 1 2 2v16H7a2 2 0 0 1-2-2zM5 17h14M9 7h6M9 10h4"/></svg>',
    spread: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="7" width="6" height="10" rx="1"/><rect x="9" y="4" width="6" height="10" rx="1"/><rect x="16" y="7" width="6" height="10" rx="1"/><path d="M12 17v4"/></svg>',
    gear: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/></svg>',
    close: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 6l12 12M18 6L6 18"/></svg>'
  };
  const LOGO = '<svg viewBox="0 0 32 32"><defs><linearGradient id="lg" x1="0" x2="1"><stop offset="0" stop-color="#f6e0a2"/><stop offset="1" stop-color="#c9a05a"/></linearGradient></defs><circle cx="16" cy="16" r="13" fill="none" stroke="url(#lg)" stroke-width="1.4"/><circle cx="16" cy="16" r="10" fill="none" stroke="url(#lg)" stroke-width=".6" stroke-dasharray="1.5 2"/><path d="M16 4l2.4 9.2L28 16l-9.6 2.8L16 28l-2.4-9.2L4 16l9.6-2.8z" fill="url(#lg)"/></svg>';

  // ---- sound: small synthesised effects; music from the music folder ----
  let audio = null;
  function sfx(kind) {
    if (!state || !state.prefs || !state.prefs.sfx) return;
    try {
      audio = audio || new AudioContext();
      const t = audio.currentTime, g = audio.createGain(), vol = 0.16 * (state.prefs.vol + 0.3);
      g.connect(audio.destination);
      const tone = (f, at, len, type) => { const o = audio.createOscillator(); o.type = type || "sine"; o.frequency.setValueAtTime(f, t + at); o.connect(g); o.start(t + at); o.stop(t + at + len); };
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 1);
      if (kind === "flip") { tone(880, 0, 0.06, "triangle"); tone(1320, 0.04, 0.06, "triangle"); }
      if (kind === "clash") { tone(110, 0, 0.25, "sawtooth"); tone(70, 0.02, 0.3, "square"); }
      if (kind === "win") [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.09, 0.2, "triangle"));
      if (kind === "lose") [392, 330, 262].forEach((f, i) => tone(f, i * 0.12, 0.25, "sine"));
      if (kind === "coin") { tone(1568, 0, 0.08, "square"); tone(2093, 0.07, 0.12, "square"); }
      if (kind === "rare") [659, 784, 988, 1318, 1568].forEach((f, i) => tone(f, i * 0.07, 0.3, "triangle"));
      if (kind === "tear") { tone(300, 0, 0.12, "sawtooth"); tone(200, 0.08, 0.15, "sawtooth"); }
      if (kind === "fury") { tone(160, 0, 0.3, "sawtooth"); tone(240, 0.05, 0.25, "square"); }
      if (kind === "no") tone(180, 0, 0.15, "sawtooth");
      if (kind === "tick") tone(1200, 0, 0.03, "sine");
    } catch (e) { /* no sound */ }
  }
  const music = { el: null, list: [], i: 0 };
  async function startMusic() {
    if (music.el || !state || !state.prefs.music) return;
    const r = await Store.call("music", []).catch(() => null);
    if (!r || !Array.isArray(r.songs) || !r.songs.length) return;
    music.list = r.songs.slice().sort(() => Math.random() - 0.5);
    music.el = new Audio();
    music.el.addEventListener("ended", () => { music.i = (music.i + 1) % music.list.length; playSong(); });
    playSong();
  }
  function playSong() { if (!music.el || !music.list.length) return; music.el.src = music.list[music.i].url; music.el.volume = state.prefs.vol * 0.6; music.el.play().catch(() => {}); }
  function musicPrefs() { if (!music.el) { if (state.prefs.music) startMusic(); return; } music.el.volume = state.prefs.vol * 0.6; if (state.prefs.music) music.el.play().catch(() => {}); else music.el.pause(); }
  window.AAAway = (away) => { if (music.el) { if (away) music.el.pause(); else if (state && state.prefs.music) music.el.play().catch(() => {}); } };

  // ---- a card, in the art director's frame ----
  // (Cam's card art: "art/" under Electron; NeuroNet's copy carries it in "arcana-art/" -- bridge.js says so)
  const ART_BASE = window.AA_ART_BASE || "art/";
  const imgPath = (img, big) => (!img ? "" : /^@own\//.test(img) ? `/arcana/img/decks/${img.slice(5)}${big ? "" : ".t"}.webp` : `${ART_BASE}${img}${big ? "" : ".t"}.webp`);
  const artURL = (c, big) => (c && c.img ? imgPath(c.img, big) : "");
  // a profile picture: a card's art in a circle (Cam, 1 Nov: "draw a random card for a profile picture which appears in
  // battle like the Keepers does")
  const TIER = { easy: "Easy", normal: "Normal", hard: "Hard" };
  /** An achievement's badge: its keeper's portrait or its icon, in a bronze / silver / gold ring by difficulty. */
  const EMBLEMS = new Set(["asc-1", "asc-5", "asc-10", "cards-50", "cards-150", "cards-300", "deck-done", "max-card", "gild", "gild-deck", "combos-10", "combos-29", "streak-5",
    "streak-10", "gauntlet-5", "gauntlet-10", "trial-7", "keeps-5", "seals-10", "flawless", "nostars", "fury-ko", "omen-30", "readings-25"]);
  const badge = (id, diff, cls) => { const a = C.ACH_BY[id]; if (!a) return ""; const inner = a.face ? `<img src="${IMG("portraits/" + a.face)}" alt="" draggable="false">`
      : EMBLEMS.has(id) ? `<img src="${IMG("badges/" + id)}" alt="" draggable="false">` : `<img class="ico" src="${IMG("icons/" + (a.icon || "laurel"))}" alt="" draggable="false">`;
    return `<span class="aa-badge painted t-${diff}${cls ? " " + cls : ""}" title="${esc(a.name)} -- ${TIER[diff]}">${inner}<img class="ring" src="${IMG("badges/ring-" + diff)}" alt="" draggable="false"></span>`; };
  const cardFace = (key, cls) => { const m = /^ach:([a-z0-9-]+):(easy|normal|hard)$/.exec(key || ""); if (m) return badge(m[1], m[2], "face " + (cls || ""));
    const c = key && C.card(key); return c ? `<img class="aa-face-img card${cls ? " " + cls : ""}" src="${esc(artURL(c, false))}" alt="" draggable="false">` : `<span class="aa-face-img card blank${cls ? " " + cls : ""}">?</span>`; };
  /** A picture with the player's level in a gold circle at its top right, over the rim (Cam, 1 Nov). */
  const withLv = (html, lv, cls) => (lv ? `<span class="aa-lvf ${cls || ""}">${html}<b class="aa-plv" title="Level ${lv}">${lv}</b></span>` : html);
  let profiles = { active: "", list: [] };
  const activeProfile = () => profiles.list.find((p) => p.id === profiles.active) || { name: "", kind: "normal", diff: "normal", face: null };
  const DIFF_NAME = { free: "Free", easy: "Easy", normal: "Normal", hard: "Hard" };
  const glyphOf = (c) => (C.SUIT[c.suit] ? C.SUIT[c.suit].glyph : "✦");
  function plainFace(c) { return `<div class="aa-plain"><b>${c.suit === "major" ? esc(c.numeral) : glyphOf(c)}</b></div>`; }
  /** c: a card view (C.cardView, or a battle card made like one); o: {size, back, missing, rev, big, cls, count, isNew, attrs} */
  function cardHTML(c, o) {
    o = o || {};
    const fr = true;                                     // (the painted frames by rarity, always: Cam, 2 Nov)
    const cls = ["aa-card" + (fr ? " framed" : ""), "r-" + c.rarity, "s-" + c.suit, o.size || "", o.back ? "back" : "", o.missing ? "missing" : "", c.maxed && !o.missing ? "maxed" : "", c.gilded && !o.missing ? "gilded" : "", o.rev ? "rev" : "", o.inSpread ? "inspread" : "", o.cls || ""].join(" ");
    const art = artURL(c, o.big);
    const ab = c.ab ? (c.ab.name || (C.ABILITIES[c.ab] && C.ABILITIES[c.ab].name)) : "";
    const pips = c.max > 1 ? `<span class="aa-pips">${Array.from({ length: c.max }, (_, i) => `<i class="${i < c.lv ? "on" : ""}"></i>`).join("")}</span>` : "";
    return `<div class="${cls}" data-key="${esc(c.key)}" ${o.attrs || ""}><div class="aa-card-in"><div class="aa-face"><div class="aa-in">
        <div class="aa-win">${art ? `<img class="aa-art" alt="" src="${esc(art)}" loading="lazy" draggable="false">` : plainFace(c)}</div>
        ${fr ? `<img class="aa-frame" src="${IMG("frames/" + (c.gilded && !o.missing ? "gilded" : c.rarity))}" alt="" draggable="false">` : ""}
        <div class="aa-nameb${c.name.length > 19 ? " xl" : c.name.length > 13 ? " l" : ""}"><span>${esc(c.name)}</span></div>${c.sig ? `<span class="aa-sigmark${SIGIL_DECKS.has(c.deck) ? " painted" : ""}" title="Signature card of ${esc(c.deckName || "its deck")}: ${esc(c.sig)}">${deckSigil(c.deck) || "✧"}</span>` : ""}<span class="aa-sigil">${c.suit === "major" ? esc(c.numeral) : glyphOf(c)}</span><i class="aa-gem" title="${esc(C.RARITY[c.rarity].name)}"></i>
        <span class="aa-med pow" title="Power">${c.pow}</span><span class="aa-med harm" title="Harm">${c.harm}</span>${o.missing || !c.lv ? "" : `<span class="aa-lvl" title="Level ${c.lv} of ${c.max}">Lv${c.lv}</span>`}

        <div class="aa-foot">${ab ? `<span class="aa-abname">${esc(ab)}</span>` : ""}${o.missing ? "" : pips}</div>
        ${o.count > 1 ? `<span class="aa-count">×${o.count}</span>` : ""}</div>${c.maxed && !o.missing ? '<i class="aa-foil"></i>' : ""}</div>
      <div class="aa-back">${BACK}</div></div>${o.isNew ? '<span class="aa-new">NEW</span>' : ""}${o.inSpread ? '<span class="aa-inspread" title="In your spread">✦ In spread</span>' : ""}
      ${o.stars ? `<span class="aa-cstars" title="${o.stars} celestials">${o.stars > 6 ? "★×" + o.stars : "★".repeat(o.stars)}</span>` : ""}${o.mark ? `<span class="aa-mark ${o.mark}">${o.mark === "won" ? "✓" : o.mark === "lost" ? "✗" : "="}</span>` : ""}</div>`;
  }
  const cv = (k) => C.cardView(state, k);
  const battleView = (c) => { const b = C.card(c.key); return { key: c.key, name: b.name, sig: b.sig, deck: b.deck, deckName: b.deckName, rarity: b.rarity, suit: b.suit, numeral: b.numeral, img: b.img, ab: b.ab, pow: c.pow, harm: c.harm, lv: c.lv, max: C.maxLv(c.key), maxed: c.lv >= C.maxLv(c.key) }; };
  document.addEventListener("error", (e) => {
    const im = e.target;
    if (!im || !im.classList || !im.classList.contains("aa-art")) return;
    const el = im.closest(".aa-card"), c = el && C.card(el.dataset.key);
    if (c) im.outerHTML = plainFace(c); else im.remove();
  }, true);

  // ---- the frame ----
  const NAV = [["home", "Home", ICON.home], ["play", "Battle", ICON.battle], ["collection", "Cards", ICON.cards], ["tent", "Scouting", ICON.spyglass], ["combos", "Combos", ICON.book], ["store", "Store", ICON.store], ["divine", "Divine", ICON.divine], ["readings", "Readings", ICON.spread], ["journal", "Journal", ICON.journal], ["library", "Library", ICON.library]];
  function frameHTML() {
    return `<div class="aa-sky"><i></i><i></i><i></i>${ART.wheel()}</div>
      <div class="aa-app"><header class="aa-top"><div class="aa-logo">${LOGO}<b>NeuroArcana</b></div><span class="sp"></span>
        <span class="aa-sandbadge" id="aa-sandbadge" title="A Free (sandbox) save: everything open, the testing tools on, and nothing here counts for achievements">Sandbox · Free</span>
        <button class="aa-who-btn" id="aa-whobtn" data-a="saves" title="Saves"><span class="aa-lvf top"><span id="aa-whoface"></span><b class="aa-plv" id="aa-wholv" hidden></b></span><b id="aa-whoname"></b></button>
        <span class="aa-moon" id="aa-moon" title="Moonstones -- won in battle, spent in the Store and at the Altar">${icon("moonstone")}<span></span></span>
        <button class="aa-iconbtn" data-a="settings" title="Settings" aria-label="Settings">${ICON.gear}</button></header>
      <nav class="aa-nav" id="aa-nav">${NAV.map(([k, n, ic]) => `<button data-a="go" data-to="${k}"><span class="med">${ic}</span><span>${n}</span></button>`).join("")}
        <button class="aa-navme" data-a="go" data-to="profile" title="Your profile: stats and achievements"><span class="aa-lvf nav"><span class="med" id="aa-navface"></span><b class="aa-plv" id="aa-navlv" hidden></b></span><span>Profile</span></button></nav>
      <main class="aa-main" id="aa-main"></main></div><div id="aa-over"></div><div id="aa-guide"></div>`;
  }
  function chrome(v) {
    const m = $("aa-moon");
    if (m) m.lastChild.textContent = v.made ? num(v.moon) : "--";
    document.querySelectorAll("#aa-nav [data-to]").forEach((b) => {
      b.classList.toggle("on", b.dataset.to === screen || ((screen === "battle" || screen === "nearby") && b.dataset.to === "play") || (screen === "diary" && b.dataset.to === "profile"));
      const dot = v.made && v.hasCards && ((b.dataset.to === "home" && v.missions.some((x) => x.prog >= x.goal && !x.claimed)) || (b.dataset.to === "divine" && !v.daily));
      const had = b.querySelector(".dot");
      if (dot && !had) b.insertAdjacentHTML("beforeend", '<i class="dot"></i>'); else if (!dot && had) had.remove();
    });
    // (Cam, 2 Nov: "remove the pop up for new library pages ... a read indicator on the icon in the side bar ... it clashes with the game play")
    const lb = document.querySelector('#aa-nav [data-to="library"]'); if (lb) { lb.hidden = !(v.made && libOpen()); const sealedN = libOpen() ? Object.keys(libHave()).filter((id) => !libRead(id) && LIB.PAGE[id]).length : 0;
      let c = lb.querySelector(".aa-navcount"); if (sealedN && !c) { lb.insertAdjacentHTML("beforeend", '<i class="aa-navcount"></i>'); c = lb.querySelector(".aa-navcount"); }
      if (c) { if (sealedN) { c.textContent = sealedN > 99 ? "99+" : String(sealedN); lb.title = sealedN + " sealed page" + (sealedN === 1 ? "" : "s") + " waiting in the Library"; } else { c.remove(); lb.title = ""; } } }
    document.body.classList.toggle("calm", !!(state && state.prefs && state.prefs.motion === false));
    const sandbox = v.made ? v.kind === "sandbox" : activeProfile().kind === "sandbox";
    document.body.classList.toggle("sandbox", sandbox);
    const nf = $("aa-navface"), myFace = (v.made && v.face) || activeProfile().face;
    if (nf && nf.dataset.f !== String(myFace)) { nf.dataset.f = String(myFace); nf.innerHTML = cardFace(myFace, "nav"); }
    const wf = $("aa-whoface"), wn = $("aa-whoname");
    if (wf) { const f = (v.made && v.face) || activeProfile().face; if (wf.dataset.f !== String(f)) { wf.dataset.f = String(f); wf.innerHTML = cardFace(f, "top"); } }
    ["aa-navlv", "aa-wholv"].forEach((id) => { const b = $(id); if (b) { b.hidden = !v.made; b.textContent = v.made ? v.plv : ""; b.title = v.made ? `Level ${v.plv}` + (v.pneed ? ` · ${v.pxp} / ${v.pneed} XP` : "") : ""; } });
    if (wn) wn.textContent = ((v.made && v.name) || activeProfile().name || "Seeker") + " · " + DIFF_NAME[(v.made && v.diff) || activeProfile().diff || "normal"] + (v.made && v.ngp ? " · NG+ " + ROMAN_N[v.ngp] : "");
  }
  function go(to, keep) { clearAll(); closePanel(); screen = to; if (!keep) ui = {}; render(); }
  function render() {
    const v = V();
    chrome(v);
    if (!v.made) { paint(startScreen(v), "start"); return guideRender(v); }
    if (v.battle && screen !== "battle") screen = "battle";
    const f = { nearby, home, play, battle: battleScreen, collection, tent, library, combos: combosScreen, store, divine, readings, journal, diary: profile, profile }[screen] || home;
    paint(f(v), screen);
    if (screen === "battle") afterBattleRender(v);

    guideRender(v);
  }
  function paint(html, name) {
    const main = $("aa-main"), keep = main.firstElementChild && main.firstElementChild.dataset.screen === name ? main.firstElementChild.scrollTop : 0;
    main.innerHTML = `<section class="aa-screen" data-screen="${name}">${html}</section>`;
    main.style.setProperty("--page", PAGE_ART[name] ? `url("${IMG("scenes/" + PAGE_ART[name])}")` : "none");
    if (keep) main.firstElementChild.scrollTop = keep;
    if (keep || ui.still) main.firstElementChild.style.animation = "none";
    ui.still = false;
  }
  const repaint = () => { ui.still = true; render(); };
  const plate = (html, extra) => `<div class="aa-plate" ${extra || ""}>${html}</div>`;

  // ---- the first time ----
  function startScreen(v) {
    return `<div class="aa-start"><div style="width:110px">${LOGO}</div><h1>NeuroArcana</h1>
      <p>Collect the cards of ${v.decks} decks -- ${num(v.cards)} cards in all -- and duel with them under the stars. Spend your celestials wisely, wake combos between suits and courts, and complete a deck to read with it.</p>
      ${v.art ? "" : '<p class="aa-muted">(No card art imported yet -- the cards wear plain faces. Run <code>tools/import_decks.py</code>.)</p>'}
      <div class="aa-muted" style="font-family:var(--head);font-size:12px;letter-spacing:.14em">CHOOSE A DIFFICULTY</div>${diffPicker(ui.startDiff || activeProfile().diff || "normal", "pickDiff")}
      <div class="aa-row" style="justify-content:center"><button class="aa-btn big" data-a="begin">Enter the Observatory</button></div>
      <button class="aa-chip" data-a="beginSkip">Skip the tutorial</button></div>`;
  }

  // ---- home ----
  function combosLine(v) {
    if (!v.combos.length) return '<span class="aa-combo off">No combos awake -- three cards of one suit will wake one</span>';
    return v.combos.map((x) => x.known ? `<span class="aa-combo" title="${esc(x.text)}">✦ ${esc(x.name)}</span>` : '<span class="aa-combo unknown" title="Take it into battle to find out">✧ An unknown combo stirs…</span>').join("");
  }
  function home(v) {
    if (!v.hasCards) return `<div class="aa-hello"><div><h1>Welcome, seeker</h1><div class="aa-muted">Your collection begins in the Store.</div></div></div>
      ${plate(`<div class="aa-row"><div style="width:110px">${ART.pack("starter", "Starter Spread", null, "hs")}</div><div><h2 style="color:var(--gold3)">Orrin's Starter Spread</h2><p class="aa-muted">Eight cards to begin with.</p><button class="aa-btn" data-a="go" data-to="store">To the Store</button></div></div>`)}`;
    const daily = v.daily
      ? `<div class="aa-daily">${cardHTML(v.daily.card, { size: "sm", rev: v.daily.rev, attrs: 'data-a="card"' })}<div><div class="aa-muted">Today's card${v.daily.rev ? " (reversed)" : ""}</div><h3 style="color:var(--gold3)">${esc(v.daily.card.name)}</h3><div class="aa-omen">✦ ${esc(v.daily.omen.text)}</div></div></div>`
      : `<div class="aa-daily"><div class="aa-card sm back" style="cursor:default"><div class="aa-card-in"><div class="aa-face"></div><div class="aa-back">${BACK}</div></div></div>
          <div><h3 style="color:var(--gold3)">Today's card waits</h3><p class="aa-muted">Today's card is waiting.</p><button class="aa-btn" data-a="go" data-to="divine">Draw today's card</button></div></div>`;
    return `<div class="aa-hello"><div><div class="aa-muted">${new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</div><h1>Welcome back, seeker</h1></div>
        <div class="aa-muted">${v.owned} of ${v.total} cards · ${v.stats.wins} wins · Fool's Journey ${v.journey.cleared}/21${v.unlocks.oracle ? ` · Pilgrimage ${v.camps[1].cleared}/${v.camps[1].n}` : ""} · ${v.book.filter((b) => b.known).length}/${v.book.length} combos found</div></div>
      <div class="aa-grid2"><div class="aa-stack">${plate(daily)}<div><div class="aa-rule">Play</div>${modesHTML(v)}</div></div>
      <div class="aa-stack">${plate(`<div class="aa-h"><h2>Your spread</h2><small>8 cards · 4 drawn each battle</small></div>
          <div class="aa-deckline">${v.spread.map((c) => cardHTML(c, { size: "xs", attrs: 'data-a="card"' })).join("")}</div>
          <div class="aa-combos">${combosLine(v)}</div>
          <div class="aa-row" style="margin-top:12px"><button class="aa-btn ghost sm" data-a="go" data-to="collection">Edit spread</button>${v.decksSaved.length ? `<select class="aa-sel" data-a="deckPick"><option value="">Switch spread…</option>${v.decksSaved.map((d) => `<option value="${esc(d.id)}"${d.current ? " selected" : ""}>${esc(d.name)}</option>`).join("")}</select>` : ""}</div>`)}
        ${plate(`<div class="aa-h"><h2>Missions</h2><small>new each day · ${C.ECON.mission} Moonstones each</small></div><div class="aa-missions">
          ${v.missions.map((m) => `<div class="aa-mission"><div>${esc(m.text)} <span class="aa-muted">${Math.min(m.prog, m.goal)}/${m.goal}</span></div>
            ${m.claimed ? '<span class="aa-muted">Claimed ✓</span>' : `<button class="aa-btn sm" data-a="claim" data-id="${esc(m.id)}" ${m.prog >= m.goal ? "" : "disabled"}>Claim</button>`}
            <div class="aa-bar"><i style="width:${Math.min(100, 100 * m.prog / m.goal)}%"></i></div></div>`).join("")}</div>`)}</div></div>`;
  }
  function modesHTML(v) {
    const g = v.gauntlet, t = v.trial;
    return `<div class="aa-modes">
      <button class="aa-mode journey" data-a="go" data-to="play"><b>The Fool's Journey</b><small>21 keepers along the road, the Magician to the World</small><span class="glyph img">${icon("laurel")}</span><span class="tag">${v.journey.cleared}/21 cleared</span></button>
      <button class="aa-mode" data-a="skirmish"><b>Skirmish</b><small>A quick duel at the difficulty you choose</small><span class="tag">Easy · Normal · Hard</span><span class="glyph">⚔</span></button>
      <button class="aa-mode gauntlet" data-a="gauntlet"><b>Gauntlet</b><small>Win after win; the pot grows. Cash out -- or lose, and pay half the pot</small><span class="tag">${g ? `${g.wins} wins · pot ${num(g.pot)}` : "Start a run"}</span><span class="glyph img">${icon("gauntlet")}</span></button>
      <button class="aa-mode trial${t.done ? " done" : ""}" data-a="trial"><b>Daily Trial</b><small>${esc(t.twist.name)}: ${esc(t.twist.text)}</small><span class="tag">${t.done ? "Done today ✓" : `${C.ECON.trial.win} to win`}</span><span class="glyph img">${icon("trial")}</span></button>
      ${v.ngpOpen ? `<button class="aa-mode ngp" data-a="ngpSheet"><b>New Game+</b><small>Begin again in a new save: stronger keepers, better pay, and two Legacy boons from this one</small><span class="tag">${v.ngp ? "Cycle " + ROMAN_N[v.ngp] + " → " + ROMAN_N[Math.min(5, v.ngp + 1)] : "Unlocked"}</span><span class="glyph img">${icon("laurel")}</span></button>` : ""}
      <button class="aa-mode nearby" data-a="go" data-to="nearby"><b>Play Nearby</b><small>Trade cards and duel with someone on your home network</small><span class="tag">${lan.peer ? "With " + esc(lan.peer.name) : lan.hosting ? "Hosting" : "Home network"}</span><span class="glyph">⇄</span></button>
      <button class="aa-mode duel" data-a="duel"><b>Duel a Friend</b><small>Two players, one computer: a curtain between turns, both reveal together</small><span class="tag">Hot-seat · friendly</span><span class="glyph">⚔</span></button>
      <button class="aa-mode keeps" data-a="keeps"><b>Play for Keeps</b><small>No Moonstones: the cards are the stakes. Win one of theirs -- or lose one of yours</small><span class="tag">${v.owned >= C.ECON.keeps.minCards ? "Cards at stake" : `Needs ${C.ECON.keeps.minCards} cards`}</span><span class="glyph">♠</span></button></div>`;
  }

  // ---- play ----
  function play(v) {
    if (!v.hasCards) return home(v);
    const asc = (cp) => cp.id === "fool" && cp.ascBest ? `<div class="aa-asc"><span class="aa-muted">Ascension</span>${Array.from({ length: cp.ascBest + 1 }, (_, n) => `<button class="aa-chip${cp.asc === n ? " on" : ""}" data-a="ascend" data-n="${n}" title="${n ? esc(C.ascText(n)) : "The plain road"}">${n ? ROMAN_N[n] || n : "—"}</button>`).join("")}${cp.asc ? `<span class="aa-muted">every keeper: ${esc(C.ascText(cp.asc))}</span>` : ""}</div>` : "";
    const road = (cp) => `<div class="aa-rule">${esc(cp.name)}${cp.id === "fool" && cp.asc ? " · Ascension " + cp.asc : ""}</div>${asc(cp)}${cp.open ? `<div class="aa-road">${cp.stations.map((s) => `<button class="aa-stn ${s.cleared ? "cleared" : s.open ? "next" : "locked"}${s.main ? " main" : ""}" data-a="station" data-camp="${cp.id}" data-n="${s.n}" ${s.open ? "" : "disabled"}>
        ${s.main ? '<span class="crown" title="A main keeper: lose here and you go back to the start of the road"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18h18l-1.5-10-4.5 4-3-7-3 7-4.5-4z"/></svg></span>' : ""}${s.known ? keeperFace(cp.id, s.n, "stn") : ""}${s.known && s.field ? `<span class="aa-stnfield f-${s.field}" title="${esc(fieldWords(s.field))}">${FIELD_GLYPH[s.field]}</span>` : ""}<span class="num">${esc(s.numeral)}</span><b>${s.known ? esc(s.name) : "? ? ?"}</b><small>${s.known ? esc(s.keeper) : s.open ? "An unknown keeper" : "&nbsp;"}</small><small>${s.cleared ? "Passed ✓" : s.open ? `+${s.reward} · −${s.loss}` : "Locked"}</small></button>`).join("")}</div>`
      : `<div class="aa-plate aa-sealed"><b>✧ Sealed</b> -- ${cp.id === "oracle" ? "beat the World at the end of the Fool's Journey, and the oracle decks -- and this road through their four realms -- will open." : "not yet."}</div>`}`;
    const owned = Object.keys(v.seals || {});
    const sealRow = !v.features.seals ? "" : owned.length ? `<div class="aa-sealrow"><span class="aa-muted">Your Seal for battles</span><button class="aa-chip${!v.sealSet ? " on" : ""}" data-a="setSeal" data-id="">None</button>${owned.map((id) => `<button class="aa-chip${v.sealSet === id ? " on" : ""}" data-a="setSeal" data-id="${id}" title="When ${esc(C.SEAL[id].when)}: ${esc(C.SEAL[id].text)}">${sealMark(id, "xs")} ${esc(C.SEAL[id].name)} ×${v.seals[id]}</button>`).join("")}</div>`
      : `<div class="aa-sealrow"><span class="aa-muted">No Seals yet.</span></div>`;
    return `<div class="aa-hello"><div><h1>Battle</h1></div>${v.streak ? `<div class="aa-streakbadge" title="Each win in a row adds 5% to your Moonstones, up to 25%. A loss resets it.">${icon("fury", "sm")} ${v.streak} win${v.streak === 1 ? "" : "s"} in a row · next win +${Math.min(v.streak, C.ECON.streak.max) * 5}%</div>` : ""}</div>${modesHTML(v)}${sealRow}
      ${v.camps.map(road).join("")}${circuitHTML(v)}`;
  }
  /** The Apprentice's Circuit (Q10): this week's seven Pages, for spreads whose levels add up to 12 or less. */
  function circuitHTML(v) {
    const CI = v.circuit, over = CI.levels > CI.cap, days = Math.max(1, Math.ceil((CI.resets - Date.now()) / 864e5));
    return `<div class="aa-rule">The Apprentice's Circuit</div>
      <div class="aa-circhead"><span class="aa-muted">Seven Pages, new each Monday (${days === 1 ? "tomorrow" : "in " + days + " days"}). Bring humble cards: your spread's levels may add up to <b>${CI.cap}</b>, and yours come to <b class="${over ? "aa-bad" : "aa-good"}">${CI.levels}</b>. A loss costs nothing.</span>
        ${over ? '<button class="aa-btn sm" data-a="humble">Make a humble spread</button>' : ""}</div>
      <div class="aa-road circuit">${CI.stations.map((st) => { const cleared = st.n <= CI.cleared, open = st.n === CI.cleared + 1;
        return `<button class="aa-stn ${cleared ? "cleared" : open ? "next" : "locked"}" data-a="circuitStn" data-n="${st.n}" ${cleared || open ? "" : "disabled"}>${cardFace(st.key, "stn")}${st.field ? `<span class="aa-stnfield f-${st.field}" title="${esc(fieldWords(st.field))}">${FIELD_GLYPH[st.field]}</span>` : ""}<span class="num">${st.n}</span><b>${esc(st.name)}</b><small>${esc(st.deck)}</small><small>${cleared ? "Passed ✓ · again +" + C.ECON.circuit.replay : open ? "+" + st.pay : "Locked"}</small></button>`; }).join("")}</div>
      ${CI.cleared >= CI.stations.length ? `<p class="aa-muted" style="text-align:center">✦ This week's Circuit is done${CI.humble ? ", with eight Lv1 cards every time" : ""}. New Pages on Monday.</p>` : ""}`;
  }
  function sheet(html, small) {
    closePanel();
    $("aa-over").innerHTML = `<div class="aa-modal" data-a="closeBg"><div class="aa-sheet${small === "wide" ? " wide" : small === "book" ? " book" : small ? " small" : ""}"><button class="aa-iconbtn aa-x" data-a="close" aria-label="Close">${ICON.close}</button>${html}</div></div>`;
  }
  const closeSheet = () => { $("aa-over").innerHTML = ""; };
  /** The X, Esc or the dark around a sheet: a trade on the table is called off (and the other side told); their album,
   *  opened from a trade, goes back to it. */
  function userClose() {
    if (lan.trade && !lan.trade.done) { if ($("aa-trade-sheet")) return A.tradeCancel(); if ($("aa-album")) return tradeSheet(); }
    closeSheet();
  }
  function confirmSheet(text, yesLabel, onYes) {
    ui.onYes = onYes;
    sheet(`<h3 style="color:var(--gold3)">${esc(text)}</h3><div class="aa-row" style="justify-content:center;margin-top:14px"><button class="aa-btn" data-a="yes">${esc(yesLabel)}</button><button class="aa-btn ghost" data-a="close">Cancel</button></div>`, true);
  }
  function fight(mode, opts) {
    const r = act("battle", Object.assign({ mode }, opts || {}));
    if (!r.ok) return;
    if (mode === "journey" && state.battle) { const K = kx(state.battle.opts.camp + ":" + state.battle.opts.station); K.met++; K.at = Date.now(); codexSave(); }     // (the tent's dossier begins)
    closeSheet(); ui = { intro: true, found: (r.events.find((e) => e.kind === "discover") || {}).ids || [], duelTurn: 0 }; sfx("clash"); go("battle", true);
  }

  // ---- the battle ----
  /** Whose hand is at the bottom: you -- or, in a hot-seat duel, the player whose turn it is. */
  const duelMe = (B) => (B && B.mode === "lan" ? (lan.role === "guest" ? 1 : 0) : B && B.mode === "duel" && ui.duelTurn === 1 ? 1 : 0);
  const twoPlayer = (B) => B && (B.mode === "duel" || B.mode === "lan");
  function sideHTML(B, i, mine) {
    const S = B.sides[i], you = mine == null ? i === 0 : mine, pct = Math.max(0, 100 * S.spirit / S.max);
    // a played card goes back to its place, greyed, with how its round went and the stars bid on it (Cam: "the cards go
    // back into the spread greyed out ... this will allow me to plan the battle better"); right-click any card for its details
    const played = {};
    B.log.forEach((l) => { const ch = i === 0 ? l.you : l.foe; played[ch.card] = { mark: l.winner < 0 ? "draw" : l.winner === i ? "won" : "lost", stars: ch.cel + (ch.fury ? B.fury : 0) }; });
    // the Lantern Seal (yours, round 3): their chosen card is shown
    const glass = !twoPlayer(B) && B.sides[0].full === C.LOOKING_GLASS && !(C.FEATURES[B.tier] || {}).deep;    // (on Hard it's Mushroom Growth instead)          // the Full Spread of Wonderland (Cam's idea)
    const seen = i === 1 && !B.over && !twoPlayer(B) && (glass || (B.round === 2 && B.seal && B.seal[0] === "lantern" && !B.sprung[0])) ? C.aiChoose(B, 1, B.ai).card : -1;
    const cards = S.cards.map((c, ci) => { const P = played[ci], picking = you && ui.pick === ci && !c.used;
      return cardHTML(battleView(c), { cls: (c.used ? "used " : "") + (picking ? "pick " : "") + (c.field > 0 ? "fup " : c.field < 0 ? "fdown " : "") + (ci === seen ? "foreseen" : ""), mark: P && P.mark, stars: P ? P.stars : picking ? ui.cel : 0,
        attrs: (you && !c.used ? `data-a="pick" data-i="${ci}"` : `data-a="peek"`) + ` data-i="${ci}" data-side="${i}"` }); }).join("");
    const known = (id) => i !== 0 || state.combos[id];
    const names = S.combos.map((id) => { const x = C.combos().find((y) => y.id === id); return x && known(id) ? x.name : "✧ unknown"; });
    // your picture and name (a battle begun before saves had them takes the save's own)
    const ownFace = S.face || (i === 0 && !twoPlayer(B) ? state.face : null), shown = i === 0 && !twoPlayer(B) && state.name ? state.name : S.name;
    const kf = i === 1 && B.mode === "journey" ? keeperFace(B.opts.camp, B.opts.station, "who") : ownFace ? withLv(cardFace(ownFace, "who"), S.plv || (i === 0 && !twoPlayer(B) ? state.plv : 0), "who") : "";
    return `<div class="aa-side ${you ? "you" : "foe"}"><div class="aa-who">${kf}<b>${esc(shown)}</b>
        <div class="aa-spirit" id="aa-sp${i}"><i style="width:${pct}%"></i><span>${Math.max(0, S.spirit)} / ${S.max} Spirit</span></div>
        <div class="aa-cel" id="aa-cel${i}">${"★".repeat(Math.min(S.cel, 20))}<em>${S.cel} celestials</em></div>
        ${names.length ? `<div class="aa-combolist">${names.map((n) => `<span>✦ ${esc(n)}</span>`).join("")}</div>` : ""}</div>
      <div class="aa-hand">${cards}</div></div>`;
  }
  function battleScreen(v) {
    const B = v.battle, me = duelMe(B);
    // a hot-seat duel: a curtain between turns, so neither player sees the other choose
    if (B.mode === "duel" && ui.curtain && !B.over) return `<div class="aa-battle"><div class="aa-curtain"><div class="aa-muted">Round ${B.round + 1} of ${C.ROUNDS}</div><h1>Player ${me + 1}</h1>
      <p>${me ? "Player 1 has chosen. " : ""}Player ${2 - me}, look away while Player ${me + 1} chooses.</p><div class="aa-curtaincount" id="aa-curtaincount">3</div><small class="aa-muted">or click anywhere</small></div></div>`;
    if (ui.pick == null || (B.sides[me].cards[ui.pick] && B.sides[me].cards[ui.pick].used)) ui.pick = B.sides[me].cards.findIndex((c) => !c.used);
    const you = B.sides[me], pc = you.cards[ui.pick];
    if (you.cel < B.fury) ui.fury = false;
    const fcost = ui.fury ? B.fury : 0;
    ui.cel = Math.max(0, Math.min(ui.cel || 0, you.cel - fcost));
    const stars = Array.from({ length: you.cel }, (_, n) => { const k = n + 1, isFury = ui.fury && k > you.cel - fcost; return `<button class="${isFury ? "fury" : k <= ui.cel ? "on" : ""}" data-a="cel" data-n="${k}" ${isFury ? "disabled" : ""} aria-label="${k} celestials">★</button>`; }).join("");
    const might = pc ? Math.max(0, pc.pow - (ui.rev ? C.REVERSED : 0)) + C.MIGHT_PER_CEL * ui.cel : 0;
    const ctrl = B.over ? "" : `<div class="aa-controls">
        <div><div class="aa-muted" style="font-family:var(--head);font-size:10px;letter-spacing:.1em">CELESTIALS ON THIS CARD</div><div class="aa-stars">${stars || '<span class="aa-muted">none left</span>'}</div></div>
        <button class="aa-btn ghost sm" data-a="cel" data-n="0">0</button>
        <button class="aa-toggle${ui.rev ? " on" : ""}" data-a="rev" title="Reversed: it ignores their card's ability, but its own is silenced too, and it has −${C.REVERSED} Power">${icon("reversed", "sm")} ${ui.rev ? "Reversed" : "Upright"}</button>
        <button class="aa-toggle fury${ui.fury ? " on" : ""}" data-a="fury" ${you.cel < B.fury ? "disabled" : ""} title="Fury: ${B.fury} more celestials, +${C.FURY.harm} Harm if it wins">${icon("fury", "sm")} Fury −${B.fury}★ +${C.FURY.harm}</button>
        <div class="aa-preview">Might <b>${might}</b><br>Harm ${pc ? pc.harm + (ui.fury ? C.FURY.harm : 0) : 0}${ui.fury ? " (Fury)" : ""}</div>
        ${!twoPlayer(B) && B.round === 0 && (B.mulls || 0) > 0 && !B.log.length && you.cel >= C.ECON.mulligan ? `<button class="aa-toggle" data-a="mulliganSheet" title="Before the first round: swap the chosen card for one of two offered from the rest of your spread (${C.ECON.mulligan}★)">⇄ Mulligan ×${B.mulls} −${C.ECON.mulligan}★</button>` : ""}
        <button class="aa-btn big" data-a="reveal" ${pc && !ui.lanWaiting ? "" : "disabled"}>${ui.lanWaiting ? "Waiting for " + esc((lan.peer && lan.peer.name) || "them") + "…" : B.mode === "duel" && me === 0 ? "Done -- pass to Player 2" : "Reveal"}</button>${timerHTML(B)}</div>`;
    const tw = B.twist ? `<div class="aa-twist">☾ ${esc(B.twist.name)}: ${esc(B.twist.text)}</div>` : "";
    // (Cam, 1 Nov: "scale the battle area up so the cards are bigger ... look at the scale of the Urban Rivals battle screen"
    // and "Urban Rivals has a separate screen that opens when cards fight each other"): the board is two big rows of
    // cards; each clash opens its own scene over the board (the clash screen), then the cards go back, greyed
    const scene = sceneOf(B);
    return `<div class="aa-battle" data-scene="${esc(scene)}" style="--scene:url('${IMG("scenes/" + scene)}')"><div class="aa-board" id="aa-board">${sideHTML(B, 1 - me, false)}
      <div class="aa-arena" id="aa-arena">${!B.over && !twoPlayer(B) && B.sides[0].full === C.STAR_CHART ? (() => { const f = C.aiChoose(B, 1, B.ai); return `<div class="aa-starchart" title="Star Chart (the Gilded Observatory's Full Spread)">✦ Star Chart: they've bid ${f.cel} star${f.cel === 1 ? "" : "s"}${f.fury ? " and lit Fury" : ""}</div>`; })() : ""}${B.field ? `<div class="aa-fieldchip f-${B.field}" title="${esc(fieldWords(B.field))}">${FIELD_GLYPH[B.field]} ${esc(C.FIELD[B.field].name)}</div>` : ""}<div class="aa-round">Round ${Math.min(B.round + 1, C.ROUNDS)} of ${C.ROUNDS}</div>${tw}${sealsHTML(B)}${logHTML(B)}</div>
      ${sideHTML(B, me, true)}
      ${B.over ? `<div class="aa-claim"><button class="aa-btn big" data-a="claim2">${(B.mode === "lan" && duelMe(B) === 1 ? B.result === "loss" : B.result === "win") ? "Claim victory" : "See the result"}</button></div>` : ""}
      <div class="aa-clash" id="aa-clash" data-scene="${esc(scene)}" aria-live="polite"><div class="aa-clashround">Round ${Math.min(B.round + 1, C.ROUNDS)}</div>
        <div class="aa-slot foe" id="aa-slot1"></div><div class="aa-vs">vs</div><div class="aa-slot you" id="aa-slot0"></div></div></div>
      <div class="aa-dock">${ctrl}${B.over ? "" : '<button class="aa-btn ghost sm aa-walk" data-a="forfeit">Walk away</button>'}</div></div>`;
  }
  /** The Seals on the table: yours face down (you know it), theirs unknown until it springs. */
  function sealsHTML(B) {
    if (!B.seal || (!B.seal[0] && !B.seal[1])) return "";
    const one = (i) => { const id = B.seal[i]; if (!id) return ""; const sp = B.sprung[i];
      return `<span class="aa-sealslot${sp ? " sprung" : ""}">${sealMark(i === 0 || sp ? id : null, "sm")}<small>${i === 0 ? "Your seal" : "Their seal"}${sp ? " · sprung" : ""}</small></span>`; };
    return `<div class="aa-seals">${one(0)}${one(1)}</div>`;
  }
  /** The rounds so far, on the table's edge: Might against Might, and who took it. */
  function logHTML(B) {
    if (!B.log.length) return "";
    return `<div class="aa-log">${B.log.map((l) => `<div class="${l.winner === 0 ? "won" : l.winner === 1 ? "lost" : ""}"><b>R${l.round}</b> ${l.might ? `${l.might[0]} : ${l.might[1]}` : ""} ${l.winner === 0 ? "✓" : l.winner === 1 ? "✗" : "="}${l.harm ? ` <i>−${l.harm}</i>` : ""}</div>`).join("")}</div>`;
  }
  // ---- the turn timer (Cam: "a time for each turn ... increasing the perceived stress level of the battle"): when it runs
  // out, the card picked (with its stars) is revealed as it stands. Off in the tutorial; Settings sets its length.
  function timerHTML(B) {
    const secs = turnSecs(B);
    if (!secs) return "";
    if (ui.turnRound !== B.round + ":" + B.rng + ":" + duelMe(B)) { ui.turnRound = B.round + ":" + B.rng + ":" + duelMe(B); ui.turnEnds = Date.now() + secs * 1000; }
    const left = Math.max(0, Math.ceil((ui.turnEnds - Date.now()) / 1000));
    return `<div class="aa-timer${left <= 5 ? " hurry" : ""}" id="aa-timer" style="--p:${Math.max(0, (ui.turnEnds - Date.now()) / (secs * 1000))}"><span>${left}</span></div>`;
  }
  const turnSecs = (B) => (B.mode === "tutorial" || B.over ? 0 : (state.prefs.timer == null ? 30 : state.prefs.timer));
  function tickTimer() {
    const B = state && state.battle, el = $("aa-timer");
    if (screen !== "battle" || !B || B.over || !el) return;
    if (busy) { if (ui.frozen == null) ui.frozen = ui.turnEnds - Date.now(); ui.turnEnds = Date.now() + ui.frozen; later(200, tickTimer); return; }
    ui.frozen = null;
    const secs = turnSecs(B), msLeft = ui.turnEnds - Date.now();
    if (msLeft <= 0) {
      if (!busy && B.seal && B.seal[0] === "hourglass" && !B.sprung[0] && act("hourglass").ok) { ui.turnEnds = Date.now() + 10000; toast("✦ Your Hourglass Seal springs -- 10 more seconds."); sfx("rare"); later(200, tickTimer); return; }
      if (!busy) { toast("Time! The stars decide for you.", true); reveal(); } return; }
    el.style.setProperty("--p", Math.max(0, msLeft / (secs * 1000)));
    el.firstChild.textContent = String(Math.ceil(msLeft / 1000));
    el.classList.toggle("hurry", msLeft <= 5000);
    if (msLeft <= 5000 && Math.ceil(msLeft / 1000) !== ui.tickSec) { ui.tickSec = Math.ceil(msLeft / 1000); sfx("tick"); }
    later(200, tickTimer);
  }
  function afterBattleRender(v) {
    const B = v.battle;
    // the duel's curtain lifts itself after a short count (a click lifts it sooner)
    if (B && B.mode === "duel" && ui.curtain && !B.over) { const el = $("aa-curtaincount"); let n = 3; const tick = () => { if (!ui.curtain) return; n--; if (n <= 0) return A.duelReady(); if (el) el.textContent = String(n); later(800, tick); }; later(800, tick); const c = document.querySelector(".aa-curtain"); if (c) c.dataset.a = "duelReady"; return; }
    if (ui.intro) {
      ui.intro = false;
      const list = [B.mode === "journey" || B.mode === "tutorial" ? B.sides[1].name : "Battle!"];
      if (B.field) list.push(FIELD_GLYPH[B.field] + " " + C.FIELD[B.field].name);
      if (B.mode === "journey") later(400, () => toast("“" + keeperLine(B.opts.camp, B.opts.station) + "”"));
      if (B.twist) list.push("☾ " + B.twist.name);
      (ui.found || []).forEach((id) => { const x = C.combos().find((y) => y.id === id); if (x) list.push("✦ Found: " + x.name); });
      list.forEach((txt, i) => later(i * 950, () => banner(txt)));
      if ((ui.found || []).length) later(400, () => toast("New in the Combo Book: " + ui.found.map((id) => (C.combos().find((y) => y.id === id) || {}).name).join(", ")));
    }
    if (B.over && ui.koBanner) banner(ui.koBanner, "ko");
    if (!B.over && turnSecs(B)) later(200, tickTimer);
  }
  function banner(text, cls) {
    const c = $("aa-clash"), a = c && c.classList.contains("on") && !c.classList.contains("off") ? c : $("aa-board");
    if (!a) return;
    const b = document.createElement("div");
    b.className = "aa-banner" + (cls ? " " + cls : ""); b.textContent = text;
    a.appendChild(b);
    if (cls !== "ko") later(2000, () => b.remove());
  }
  function floatAt(el, text, cls) {
    if (!el) return;
    const r = el.getBoundingClientRect(), d = document.createElement("div");
    d.className = "aa-dmg " + (cls || ""); d.textContent = text;
    d.style.left = (r.left + r.width / 2 - 20) + "px"; d.style.top = (r.top - 10) + "px";
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 1300);
  }
  function countUp(el, to, ms) {
    const t0 = performance.now();
    const step = (ts) => { const k = Math.min(1, (ts - t0) / ms); el.firstChild.textContent = String(Math.round(to * k)); if (k < 1) frame(step); };
    frame(step);
  }
  async function reveal() {
    if (busy) return;
    const ci = ui.pick;
    if (!state.battle || state.battle.over || ci == null || ci < 0) return;
    const me = duelMe(state.battle);
    let fury = !!ui.fury, cel = ui.cel || 0;
    if (fury && state.battle.sides[me].cel < state.battle.fury + cel) fury = false;   // (a timed-out turn with too few stars for Fury)
    const choice = { card: ci, cel, rev: !!ui.rev, fury };
    let r;
    if (state.battle.mode === "lan") {                       // across the home network: choose here, the host's game plays the round
      ui.lanWaiting = true; sfx("flip");
      if (lan.role === "guest") { lanSend({ kind: "move", ch: choice }); repaint(); return; }
      ui.lanMine = choice; repaint(); lanTryRound(); return;
    }
    if (state.battle.mode === "duel") {
      if (me === 0) { ui.duelCh = choice; ui.duelTurn = 1; ui.curtain = true; ui.pick = null; ui.cel = 0; ui.rev = false; ui.fury = false; sfx("flip"); repaint(); return; }
      r = act("duelMove", { a: ui.duelCh, b: choice }); ui.duelTurn = 0; ui.duelCh = null;
    } else r = act("move", choice);
    if (!r.ok) return;
    await playStory(r.events.find((e) => e.kind === "round").story, state.battle, ci);
  }
  /** A round on the clash screen, seen from your side (the guest of a home-network duel sees it the other way round). */
  async function playStory(story, B, ci) {
    busy = true; ui.hurry = false;
    const me = duelMe(B), slotOf = (i) => (me === 1 ? 1 - i : i), yours = (who) => String(who) === String(me);
    // what you learn from the clash (the Archive's intel, the keeper's dossier) -- not from a hot-seat duel's own cards
    if (B.mode !== "duel") { const foe = 1 - me, fk = B.sides[foe].cards[story.ch[foe].card].key;
      intelClash(fk, story.winner === me ? true : story.winner === foe ? false : null); intelKeeperPlayed(B, foe, story.ch[foe]); }
    // a click anywhere on the clash screen hurries it along (Cam, 1 Nov)
    const wait = (ms) => new Promise((done) => { const t0 = Date.now(), tick = () => (ui.hurry || Date.now() - t0 >= ms ? done() : later(40, tick)); tick(); });
    const put = (i) => {
      const slot = $("aa-slot" + slotOf(i));
      if (!slot) return;
      slot.className = "aa-slot " + (slotOf(i) ? "foe" : "you"); slot.style.animation = "";
      slot.innerHTML = `<div class="aa-might"><span>0</span><small>${story.r[i].cel ? "★".repeat(Math.min(story.r[i].cel, 12)) : "no celestials"}${story.ch[i].fury ? ' · <span class="fury">fury</span>' : ""}${story.ch[i].rev ? " · reversed" : ""}${story.r[i].ud ? ` · <span class="ud" title="The Underdog: a lower-level card earns twice the XP if it wins">underdog · 2× XP</span>` : ""}${story.r[i].aff ? ` · <span class="${story.r[i].aff > 0 ? "hunt" : "fear"}" title="Its deck ${story.r[i].aff > 0 ? "hunts" : "fears"} this kind of card">${mark(story.r[i].aff > 0 ? "hunt" : "fear")}${story.r[i].aff > 0 ? "hunts +" + story.r[i].aff : "fears −" + -story.r[i].aff}</span>` : ""}</small></div>${cardHTML(battleView(B.sides[i].cards[story.ch[i].card]), { back: true, rev: story.ch[i].rev, big: true, stars: story.ch[i].cel, cls: "aa-fly", attrs: `style="--from:${i ? -120 : 120}px;--rot:${i ? 8 : -8}deg"` })}`;
    };
    const clash = $("aa-clash");
    if (clash) { const rn = clash.querySelector(".aa-clashround"); if (rn) rn.textContent = "Round " + story.round; clash.classList.add("on"); }
    put(0); put(1);
    const mine = document.querySelectorAll(".aa-side.you .aa-hand .aa-card")[ci];
    if (mine) mine.classList.add("used");
    $("aa-guide").innerHTML = "";
    sfx("flip");
    await wait(560);
    document.querySelectorAll(".aa-slot .aa-card").forEach((el) => el.classList.remove("back"));
    sfx(story.ch.some((c) => c.fury) ? "fury" : "flip");
    await wait(500);
    // the coins and dice of the clash, in the middle of the board, before the Might is counted (Cam, 2 Nov: "have it
    // central in the battle field, pause the timer and actually show the determination and effect")
    for (const x of story.chance || []) await showChance(x, yours(x.who));
    [0, 1].forEach((i) => { const m = document.querySelector(`#aa-slot${slotOf(i)} .aa-might`); if (m) countUp(m, story.r[i].might, ui.hurry ? 120 : 650); });
    await wait(800);
    sfx("clash");
    if (story.winner >= 0) {
      $("aa-slot" + slotOf(story.winner))?.classList.add("win"); $("aa-slot" + slotOf(1 - story.winner))?.classList.add("lose");
      if (story.harm > 0) floatAt(clash ? document.querySelector(`#aa-slot${slotOf(1 - story.winner)} .aa-card`) : $("aa-sp" + (1 - story.winner)), "-" + story.harm);
      sfx(yours(story.winner) ? "win" : "lose");
      banner(yours(story.winner) ? (story.harm > 0 ? "You take the round · " + story.harm + " Harm" : "You take the round") : (story.harm > 0 ? "They take the round · " + story.harm + " Harm" : "They take the round"), yours(story.winner) ? "good" : "badr");
    } else banner("A draw -- nobody is harmed");
    (story.seals || []).forEach((x, k) => { const [who, id] = x.split(":"); later(150 + k * 700, () => { banner("✦ " + (yours(who) ? "Your " : "Their ") + C.SEAL[id].name + " springs -- " + C.SEAL[id].text, yours(who) ? "good seal" : "badr seal"); sfx("rare"); }); });
    story.notes.filter((n) => /:full:/.test(n)).forEach((n, k) => { const [who, , slug] = n.split(":"); later(400 + k * 700, () => banner("✦ " + (yours(who) ? "Your " : "Their ") + C.FULL[slug].name, yours(who) ? "good seal" : "badr seal")); });
    story.notes.forEach((n, k) => {
      const [who, what] = n.split(":"), el = $("aa-sp" + who), m = what.match(/\d+/), amt = m ? m[0] : "";
      later(300 + k * 250, () => {
        if (/^heal/.test(what)) floatAt(el, "+" + amt, "heal");
        else if (/^cel/.test(what)) floatAt($("aa-cel" + who), "+" + amt + "★", "cel");
        else if (/^burn/.test(what)) floatAt($("aa-cel" + who), "-" + amt + "★", "cel");
        else if (/^recoil|^poisoned/.test(what)) floatAt(el, "-" + amt);
        else if (/^poison$/.test(what)) floatAt(el, "☠ poisoned");
      });
    });
    await wait(1700);
    if (clash) { clash.classList.add("off"); await wait(320); clash.classList.remove("on", "off"); }
    // back on the board: the Spirit bars fall (or rise) where you can see them
    [0, 1].forEach((i) => { const bar = document.querySelector(`#aa-sp${i} i`), S = B.sides[i]; if (bar) bar.style.width = Math.max(0, 100 * S.spirit / S.max) + "%"; });
    if (clash) await wait(750);
    busy = false; ui.rev = false; ui.cel = 0; ui.pick = null; ui.fury = false; ui.lanWaiting = false;
    // (Cam, PT62: "the pop up about if the player is ready is annoying") -- no curtain for player 1 after the clash
    // (Cam: "I don't want a victory to be automatically won" -- the knockout is shown, then you claim it)
    const won = me === 1 ? B.result === "loss" : B.result === "win", lost = me === 1 ? B.result === "win" : B.result === "loss";
    if (B.over) ui.koBanner = story.ko ? (won ? "Knocked out!" : lost ? "You fall…" : "Both fall") : (won ? "The stars favour you" : lost ? "The stars turn away" : "An even sky");
    repaint();
  }
  /** One coin or die on the clash screen: it spins or tumbles, lands, and says what it did. Never hurried past unseen. */
  // (Art Prompts 15: the painted coin -- spinning, sun, moon -- and the die -- tumbling, then its face)
  ["coin-spin", "coin-sun", "coin-moon", "die-tumble", "die-1", "die-2", "die-3", "die-4", "die-5", "die-6"].forEach((n) => { new Image().src = IMG("dice/" + n); });   // (so a landing never flashes blank)
  const dieHTML = (motion) => `<img class="aa-die" src="${IMG("dice/" + (motion ? "die-tumble" : "die-1"))}" alt="" draggable="false">`;
  function showChance(x, mine) {
    return new Promise((done) => {
      const host = $("aa-clash") || $("aa-board");
      if (!host) return done();
      const box = document.createElement("div"), motion = state.prefs.motion !== false;
      box.className = "aa-chance " + (mine ? "mine" : "theirs");
      const who = `<small>${mine ? "Yours" : "Theirs"}</small>`;
      if (x.kind === "coin") box.innerHTML = `${who}<img class="aa-coin${motion ? " spin" : ""}" src="${IMG("dice/coin-spin")}" alt="" draggable="false"><p></p>`;
      else box.innerHTML = `${who}<span class="aa-dice">${x.faces.map(() => dieHTML(motion)).join("")}</span><p></p>`;
      host.appendChild(box);
      sfx(x.kind === "coin" ? "coin" : "tick");
      const dies = box.querySelectorAll(".aa-die"), t0 = Date.now(), roll = motion ? 1000 : 0;
      const tumble = () => {
        if (Date.now() - t0 < roll) { sfx("tick"); later(90, tumble); return; }
        if (x.kind === "coin") { const c = box.querySelector(".aa-coin"); c.classList.remove("spin"); c.src = IMG("dice/coin-" + (x.face === "moon" ? "moon" : "sun")); }
        else { dies.forEach((d, k) => { d.src = IMG("dice/die-" + x.faces[k]); if (x.faces.length > 1 && x.faces[k] === (x.low ? Math.min : Math.max)(...x.faces)) d.classList.add("best"); }); }
        box.classList.add("landed"); box.querySelector("p").textContent = x.text; sfx(mine ? "rare" : "flip");
        // it stays until you click (Cam, PT66 c1: "Have it stay on screen until i click again"); the timer is frozen meanwhile
        const swallow = (e) => { e.stopPropagation(); e.preventDefault(); };
        const go = (e) => { if (box.classList.contains("gone")) return; if (e && e.type === "pointerdown") document.addEventListener("click", swallow, { capture: true, once: true }); box.classList.add("gone"); document.removeEventListener("pointerdown", go, true); document.removeEventListener("keydown", go, true); later(250, () => { box.remove(); done(); }); };
        later(250, () => { box.insertAdjacentHTML("beforeend", '<em class="aa-chancego">Click to go on</em>'); document.addEventListener("pointerdown", go, true); document.addEventListener("keydown", go, true); });
      };
      later(motion ? 120 : 0, tumble);
    });
  }
  function noteResult(r) {
    const res = r.events.find((e) => e.kind === "result");
    ui.lastGold = res ? res.gold : 0; ui.lastLost = res ? res.lost : 0; ui.mode = res && res.mode; ui.lastStreak = res ? { n: res.streak, bonus: res.bonus, result: res.result } : null; ui.lastKo = !!(res && res.ko); ui.lastKoGold = res ? res.koGold || 0 : 0;
    ui.unlocked = (r.events.find((e) => e.kind === "unlock") || {}).what || null;
    const xp = r.events.find((e) => e.kind === "cardXp");
    ui.lastXp = xp ? xp.list : [];
    ui.lastPxp = r.events.find((e) => e.kind === "playerXp") || null;
    ui.lastLevels = r.events.filter((e) => e.kind === "levelUp");
    if (ui.lastLevels.length) later(900, () => { sfx("rare"); toast("✦ Level " + ui.lastLevels[ui.lastLevels.length - 1].lv + "!"); });
    const st = r.events.find((e) => e.kind === "station"), gw = r.events.find((e) => e.kind === "gauntletWin"), ge = r.events.find((e) => e.kind === "gauntletEnd");
    const reset = r.events.find((e) => e.kind === "roadReset");
    ui.keepsLost = r.events.find((e) => e.kind === "keepsLost") || null; ui.keepsGot = null;
    const pg = r.events.find((e) => e.kind === "keeperPage"), asc = r.events.find((e) => e.kind === "ascension");
    const sd = r.events.find((e) => e.kind === "sealDrop") || (r.events.find((e) => e.kind === "circuitDone" && e.seal) ? { id: r.events.find((e) => e.kind === "circuitDone").seal } : null);
    const cst = r.events.find((e) => e.kind === "circuitStation"), cdn = r.events.find((e) => e.kind === "circuitDone");
    ui.lastBook = (sd ? `<p class="aa-bookline">${sealMark(sd.id, "xs")} The keeper dropped a ${esc(C.SEAL[sd.id].name)}.</p>` : "") + (pg ? `<p class="aa-bookline">✒ A new page in the Book of Keepers -- read it in your Journal.</p>` : "") + (asc ? `<p class="aa-bookline">✦ Ascension ${asc.n} is open: walk the road again, and every keeper is stronger.</p>` : "");
    const B0 = state.battle;
    if (B0 && B0.mode === "journey" && res) { const K = kx(B0.opts.camp + ":" + B0.opts.station); if (res.result === "win") K.won++; else if (res.result === "loss") K.lost++; K.at = Date.now(); codexSave(); }
    const after = B0 && B0.mode === "journey" && res && res.result !== "draw" ? keeperAfter(B0.opts.camp, B0.opts.station, res.result === "win") : "";
    ui.lastQuote = after ? `<p class="aa-quote">“${esc(after)}”</p>` : "";
    ui.lastExtra = cdn ? `<div class="aa-levelup">${cardFace(state.battle && state.battle.opts.page, "who")}<div><h3>The Circuit is done!</h3><p>${cdn.humble ? "With eight Lv1 cards every time. " : ""}${cdn.seal ? "A Seal, and " : ""}${cdn.deck ? "a card from " + esc(cdn.deck) : "a card"}${cdn.card.isNew ? " -- new to your collection" : ""}:</p></div>${cardHTML(cv(cdn.card.key), { size: "sm" })}</div>`
      : cst ? `<p>✦ Page ${cst.n} of ${C.ECON.circuit.n} passed -- the Circuit goes on.</p>` : reset ? `<p class="aa-bad">A main keeper sends you back to the beginning of ${esc(C.CAMPAIGNS[reset.camp].name)}, and the road forgets you: every name is hidden again. Walk it again -- and be ready.</p>`
      : st ? `<p>✦ Station ${st.n} passed -- the road goes on.</p>` : gw ? `<p>Gauntlet: ${gw.wins} wins, the pot is ${num(gw.pot)}. Cash out from the Gauntlet, or face the next.</p>` : ge ? (ge.cost ? `<p class="aa-bad">The Gauntlet ends at ${ge.wins} wins. The pot is lost, and half of it (${num(ge.cost)}) with it.</p>` : `<p>The Gauntlet ends at ${ge.wins} wins. You keep ${num(ge.kept)}.</p>`) : "";
  }
  function resultSheet(B) {
    const res = B.mode === "lan" && duelMe(B) === 1 ? ({ win: "loss", loss: "win" }[B.result] || B.result) : B.result, gold = ui.lastGold || 0;
    sfx(res === "win" ? "win" : "lose");
    const xp = (ui.lastXp || []).map((x) => `<div class="${x.to > x.from ? "up" : ""}">${cardHTML(cv(x.key), { size: "xs" })}<span>+${x.xp} XP${x.to > x.from ? ` · level ${x.to}${x.max ? " ✦" : ""}` : ""}</span></div>`).join("");
    sheet(`<div class="aa-result ${res}">${B.mode === "journey" ? keeperFace(B.opts.camp, B.opts.station, "result") : B.mode === "circuit" ? cardFace(B.opts.page, "result") : ""}<div class="aa-muted">${esc(B.sides[1].name)}</div><h1>${B.mode === "duel" ? (res === "win" ? "Player 1 wins" : res === "loss" ? "Player 2 wins" : "A draw") : B.mode === "lan" ? (res === "draw" ? "A draw" : res === "win" ? "You win" : esc((lan.peer && lan.peer.name) || "They") + " wins") : res === "win" ? "Victory" : res === "loss" ? "Defeat" : "A draw"}</h1>${ui.lastQuote || ""}
      <div class="aa-muted">Spirit ${Math.max(0, B.sides[duelMe(B) === 1 && B.mode === "lan" ? 1 : 0].spirit)} to ${Math.max(0, B.sides[duelMe(B) === 1 && B.mode === "lan" ? 0 : 1].spirit)}</div>
      <div class="aa-gain">${B.mode === "lan" ? `${res === "win" ? `+${num(gold)} Moonstones for the win` : '<span class="aa-muted">A friendly duel -- nothing lost, and your cards learn from it.</span>'}${ui.lastKo ? ' <small class="aa-streak">knockout +1 XP</small>' : ""}` : twoPlayer(B) ? '<span class="aa-muted">A friendly duel -- nothing changes hands.</span>' : gold ? `+${num(gold)} Moonstones${ui.lastStreak && ui.lastStreak.bonus ? ` <small class="aa-streak">streak +${Math.round(ui.lastStreak.bonus * 100)}%</small>` : ""}${ui.lastKoGold ? ` <small class="aa-streak">knockout +${num(ui.lastKoGold)}</small>` : ""}` : ui.lastLost ? `<span class="aa-bad">−${num(ui.lastLost)} Moonstones</span>` : res === "loss" ? '<span class="aa-muted">Nothing left to lose.</span>' : "&nbsp;"}</div>${ui.lastKo && !twoPlayer(B) ? '<p class="aa-bookline">✦ A knockout: +25% Moonstones, and +1 XP for every card that won its clash.</p>' : ""}${ui.lastPxp ? `<div class="aa-pxp"><span>+${ui.lastPxp.add} player XP</span>${ui.lastPxp.need ? `<span class="bar"><i style="width:${Math.round(100 * ui.lastPxp.xp / ui.lastPxp.need)}%"></i></span><small class="aa-muted">Level ${ui.lastPxp.lv} · ${ui.lastPxp.xp} / ${ui.lastPxp.need}</small>` : ""}</div>` : ""}
      ${(ui.lastLevels || []).map((L) => `<div class="aa-levelup">${withLv(cardFace(state.face, "who"), L.lv, "who")}<div><h3>Level ${L.lv}!</h3><p>+${num(L.gold)} Moonstones, and a card${L.card.isNew ? " -- new to your collection" : ""}:</p></div>${cardHTML(cv(L.card.key), { size: "sm" })}</div>`).join("")}
      ${xp ? `<div class="aa-xplist">${xp}</div>` : ""}${ui.lastExtra || ""}
      ${keepsHTML(B)}${ui.lastBook || ""}
      <div class="aa-row" style="justify-content:center"><button class="aa-btn" data-a="leave" ${B.keeps && B.keeps.won === null ? "disabled" : ""}>Continue</button>${B.mode === "skirmish" ? `<button class="aa-btn ghost" data-a="again">Again</button>` : ""}</div>${rematchHTML(B, res)}</div>`, true);
  }

  /** Rematch (Cam, 1 Nov: "a rematch button ... so we can jump straight into another battle -- easier to farm the keeper
   *  for EXP and Moonstones"): the same keeper or Page while the road still lets you face them; the Gauntlet's next foe. */
  function rematchHTML(B, res) {
    if (ui.unlocked || (B.keeps && B.keeps.won === null)) return "";
    let ok = false, label = "⚔ Rematch", sub = "";
    if (B.mode === "journey") { const J = state.camp[B.opts.camp]; ok = !!J && B.opts.station <= J.cleared + 1; sub = res === "win" ? "the same keeper, at replay pay" : "the same keeper, again"; }
    if (B.mode === "circuit") { const CI = V().circuit; ok = B.opts.station <= CI.cleared + 1; sub = "the same Page"; }
    if (B.mode === "gauntlet" && res === "win" && state.gauntlet) { ok = true; label = "⚔ Face the next foe"; sub = "the run goes on"; }
    return ok ? `<div class="aa-rematch"><button class="aa-btn big" data-a="rematch">${label}</button><small class="aa-muted">${sub}</small></div>` : "";
  }
  /** Play for Keeps on the result sheet: choose one of their four, or see which of yours they took. */
  function keepsHTML(B) {
    if (B.mode !== "keeps" || !B.keeps) return "";
    const K = B.keeps;
    if (K.won === null) return `<div class="aa-keeps"><h3>Choose one card to keep</h3><div class="aa-keepspick">${B.sides[1].cards.map((c) => cardHTML(cv(c.key), { attrs: `data-a="keepsPick" data-key="${esc(c.key)}"` })).join("")}</div></div>`;
    if (K.won) return `<div class="aa-keeps"><h3>You keep ${esc(C.card(K.won).name)}${ui.keepsGot && ui.keepsGot.isNew ? " -- new to your collection!" : ""}</h3><div class="aa-keepspick one">${cardHTML(cv(K.won), {})}</div></div>`;
    if (K.lost) return `<div class="aa-keeps lost"><h3 class="aa-bad">They take your ${esc(C.card(K.lost).name)}${ui.keepsLost && ui.keepsLost.last ? " -- your only copy" : ""}</h3><div class="aa-keepspick one">${cardHTML(cv(K.lost), {})}</div></div>`;
    return "";
  }

  /** A card's deck identity (Cam, 2 Nov): its signature, its deck's lean, and what its deck hunts and fears. */
  const KIND_NAME = { major: "Majors", court: "court cards", pip: "Aces and numbers", oracle: "oracle cards" };
  function identityHTML(b) {
    if (!C.features().deep) return "";                         // (Hard's layer, Q12)
    const L = C.leanOf(b.deck), F = C.affinityOf(b.deck), N = C.LORE.AFFINITY_N;
    return `<div class="aa-ident">${b.sig ? `<div class="aa-identrow sig"><span class="k">✧ Signature</span><span>${deckSigil(b.deck, "sm")}A card ${esc(b.deckName)} made its own: ${b.sigUp ? "a rarity higher, " : ""}+1 Power and its own ability.</span></div>` : ""}
      ${L ? `<div class="aa-identrow"><span class="k">Lean</span><span><b>${esc(L.name)}</b> -- ${esc(L.text)} <small class="aa-muted">(every ${esc(b.deckName)} card)</small></span></div>` : ""}
      <div class="aa-identrow"><span class="k">Affinity</span><span><b class="hunt">${mark("hunt")}Hunts ${mark(F.hunt)}${esc(KIND_NAME[F.hunt] || F.hunt)} +${N.hunt}</b> · <b class="fear">${mark("fear")}fears ${mark(F.fear)}${esc(KIND_NAME[F.fear] || F.fear)} −${N.fear}</b>${F.why ? `<br><small class="aa-muted">${esc(F.why)}</small>` : ""}</span></div></div>`;
  }
  // ==== the Archive, the card panel and the Scouting Tent (Cam, 2 Nov, N77/Q12) ===========================================
  // "We need to build an archive of the cards ... dependent on if you have gained the intel ... All unseen cards will have
  // a question mark ... a split view, think like neuronets main app ... think like a card album" -- the Cards page is the
  // Archive (Q12 q8); right-clicking a card anywhere opens it in the same panel (q9); keepers' dossiers live in the tent.
  // ---- the codex: what you know, kept across saves and New Game+ (q7); a Free save reads everything and writes nothing ----
  let codex = { v: 1, cards: {}, keepers: {}, taught: {}, library: {}, pulled: {} }, codexTimer = 0;
  async function loadCodex() { try { const x = await Store.call("codex_get", []); if (x && x.cards) codex = x; } catch (e) { /* a fresh codex */ } }
  function codexSave() { if (!state || state.diff === "free") return; clearTimeout(codexTimer); codexTimer = setTimeout(() => { Store.call("codex_set", [codex]).catch(() => {}); }, 700); }
  const cx = (k) => codex.cards[k] || (codex.cards[k] = [0, 0, 0, 0]);       // [seen, faced, beaten, lost to]
  function intelSee(keys) { let ch = false; (keys || []).forEach((k) => { if (k && C.card(k) && !cx(k)[0]) { cx(k)[0] = 1; ch = true; } }); if (ch) codexSave(); }
  function intelClash(k, won) { if (!k || !C.card(k)) return; const c = cx(k); c[0] = 1; c[1]++; if (won === true) c[2]++; else if (won === false) c[3]++; codexSave(); }
  /** The intel ladder (Q12 q6): 0 never met · 1 seen · 2 faced · 3 beaten three times · 4 owned · 5 maxed. */
  function intelOf(k) {
    if (state.diff === "free") return 5;
    const h = state.cards[k], c = codex.cards[k] || [0, 0, 0, 0];
    if (h && h.n > 0) return h.lv >= C.maxLv(k) ? 5 : 4;
    const lv = c[2] >= 3 ? 3 : c[1] >= 1 ? 2 : c[0] ? 1 : 0;
    return h ? Math.max(lv, 2) : lv;                       // (a card you once held: you know its numbers)
  }
  const INTEL_NAME = ["Never met", "Seen", "Faced", "Studied", "Yours", "Mastered"];
  // a keeper's dossier: met, won, lost and the cards seen from each of their spreads (t2: "gaining intel on them when you lost or won")
  const kx = (k) => codex.keepers[k] || (codex.keepers[k] = { met: 0, won: 0, lost: 0, at: 0, spreads: {} });
  function intelKeeperPlayed(B, foeSide, ch) {
    if (!B || B.mode !== "journey" || !B.opts) return;
    const K = kx(B.opts.camp + ":" + B.opts.station), i = String(B.keeper ? B.keeper.i : 0), key = B.sides[foeSide].cards[ch.card].key;
    const list = K.spreads[i] || (K.spreads[i] = []);
    if (!list.includes(key) && list.length < 8) list.push(key);
  }

  // ---- the panel: the card's picture and title, then short sections that open as you earn them ----
  const arch = { sel: null, q: "", own: "all", deck: null, suit: "all", rar: "all" };
  function beatenBy(c) {
    const out = [], F = C.features();
    const quench = Object.keys(C.BEATS).find((s) => C.BEATS[s] === c.suit);
    if (quench) out.push(`<b>${esc(C.SUIT[quench].name)}</b> quench ${esc(C.SUIT[c.suit].name)}: +2 Power against it.`);
    if (F.fields && quench) { const fl = C.FIELDS.find((f) => C.FIELD[f].suit === quench); if (fl) out.push(`It's weaker on the <b>${esc(C.FIELD[fl].name)}</b> (−1 Power).`); }
    if (c.ab) out.push("The <b>High Priestess</b> cancels its ability; so does playing either card reversed.");
    if (F.deep) { const kind = C.kindOf(c), hunters = C.catalogue().decks.filter((d) => C.affinityOf(d.slug).hunt === kind); if (hunters.length) out.push(`Hunted by ${hunters.map((d) => `${deckSigil(d.slug, "sm")}<b>${esc(d.name)}</b>`).join(", ")} (+${C.LORE.AFFINITY_N.hunt} against it).`); }
    return out;
  }
  function tipsFor(c) {
    const out = [], F = C.features(), deck = C.deckOf(c.deck);
    if (C.SUITS.includes(c.suit)) out.push(`Three or more <b>${esc(C.SUIT[c.suit].name)}</b> in your spread wake their element; all eight wake <i>Pure ${esc(C.SUIT[c.suit].element)}</i>.`);
    if (c.suit === "major") out.push("Three Majors in a row (VII, VIII, IX) walk <i>The Path</i> (+2 Power each).");
    if (F.harmony && deck) out.push(`${deck.harmony} or more ${esc(deck.name)} cards wake <i>${esc(deck.perk.name)}</i> (${esc(deck.perk.text)}).`);
    if (F.full && C.FULL[c.deck]) out.push(`All eight from ${esc(deck.name)}: <i>${esc(C.FULL[c.deck].name)}</i> -- ${esc(C.FULL[c.deck].text)}.`);
    if (F.deep) { const A = C.affinityOf(c.deck); out.push(`Bring it against keepers who play ${esc(KIND_NAME[A.hunt] || A.hunt)} (it hunts them); keep it away from ${esc(KIND_NAME[A.fear] || A.fear)}.`); }
    return out;
  }
  function panelHTML(key, docked) {
    if (!key || !C.card(key)) return `<div class="aa-pnl-empty"><h3>The Archive</h3><p class="aa-muted">Every card of every deck. Cards you own are in colour, cards you've seen are greyed, and a card you've never met is a <b>?</b>.</p><p class="aa-muted">Click a card to read what you know of it.</p></div>`;
    const c = cv(key), lv = intelOf(key), own = c.n > 0, F = C.features(), deck = C.deckOf(c.deck), rec = codex.cards[key] || [0, 0, 0, 0];
    const head = lv === 0
      ? `<div class="aa-pnl-card">${cardHTML(c, { size: "lg", back: true, cls: "aa-unknown" })}</div><div class="aa-pnl-meta">${deckSigil(c.deck, "sm")}${esc(c.deckName)}</div><h2>? ? ?</h2>
         <p class="aa-muted">You haven't met this card yet. Face it in battle, find it in a booster, or see it in a trade.</p>`
      : `<div class="aa-pnl-card">${cardHTML(c, { size: "lg", big: true, missing: !own })}</div>
         <div class="aa-pnl-meta">${deckSigil(c.deck, "sm")}${esc(c.deckName)} · ${esc(C.SUIT[c.suit].name)}</div><h2>${esc(c.name)}</h2>
         <div class="aa-kv"><span style="color:var(--${c.rarity})">${esc(C.RARITY[c.rarity].name)}</span>${lv >= 2 ? `<span>Power ${c.pow}</span><span>Harm ${c.harm}</span>` : ""}<span class="aa-intel l${lv}" title="What you know of it">${esc(INTEL_NAME[lv])}</span>${own ? `<span>× ${c.n}</span>` : ""}</div>`;
    if (lv === 0) return `<div class="aa-pnl">${docked ? "" : '<button class="aa-iconbtn aa-pnl-x" data-a="panelClose" aria-label="Close">' + ICON.close + "</button>"}${head}</div>`;
    const sec = (title, body, open) => `<details class="aa-pnl-sec"${open ? " open" : ""}><summary>${title}</summary><div>${body}</div></details>`;
    const locked = (title, how) => `<div class="aa-pnl-sec locked" title="${esc(how)}"><span>🔒 ${title}</span></div>`;
    let body = "";
    body += lv >= 2 ? sec("The card", (c.ab ? `<div class="aa-ability"><b>${esc(c.ab.name)}</b> -- ${esc(c.ab.text)}</div>` : '<div class="aa-ability"><b>No ability</b></div>'), !own)
      : locked("The card", "Face it once in battle to learn its Power, Harm and ability.");
    if (own) {
      const inDeck = state.spread.includes(key), feed = ui.feed || (ui.feed = {});
      // what may go to the Altar: spares, and trained cards outside your spread (Cam, 2 Nov) -- trained ones first, they're worth most
      const doubles = Object.keys(state.cards).filter((k) => C.card(k) && (k === key ? state.cards[k].n > 1 : C.sacrificeable(state, k) > 0))
        .sort((a, b) => C.sacrificeXp(b, state.cards[b].lv) - C.sacrificeXp(a, state.cards[a].lv));
      const xp = Object.keys(feed).reduce((a, k) => a + (feed[k] || 0) * C.sacrificeXp(k, state.cards[k].lv), 0);
      const boons = c.boons.length ? `<div class="aa-boons">${c.boons.map((b) => `<div class="aa-boon${b.on ? " on" : ""}"><span class="lv">Level ${b.lv}${b.on ? " ✓" : " 🔒"}</span><span>${esc(b.text)}</span></div>`).join("")}</div>` : "";
      const altar = c.gilded ? `<div class="aa-altar gilded"><b>✦ Gilded</b> -- level ${c.lv} of ${c.max}, with its gilded boon: ${esc(c.gildBoon)}.</div>`
        : c.lv >= c.max ? `<div class="aa-altar"><b>✦ Maxed</b> -- level ${c.lv} of ${c.max}.
          <div class="aa-gild"><b style="font-family:var(--head)">Gild it</b> <span class="aa-muted">-- a spare copy and ${num(c.gildFee)} Moonstones: a gold frame and its suit's boon once more (${esc(c.gildBoon)}).</span>
          <button class="aa-btn sm" data-a="gild" ${c.n >= 2 && state.moon >= c.gildFee ? "" : "disabled"}>${c.n >= 2 ? `Gild · ${num(c.gildFee)}` : "Needs a spare copy"}</button></div></div>`
        : `<div class="aa-altar"><b style="font-family:var(--head)">The Altar</b> <span class="aa-muted">Level ${c.lv} of ${c.max}</span>
          <div class="aa-xp"><i style="width:${Math.min(100, 100 * c.xp / c.need)}%"></i></div><small class="aa-muted">${c.xp} / ${c.need} XP to level ${c.lv + 1}<span id="aa-feedxp">${xp ? ` · +${xp} XP chosen` : ""}</span></small>
          ${doubles.length ? `<div class="aa-feed">${doubles.map((k) => { const d = cv(k), n = feed[k] || 0;
            const can = k === key ? d.n - 1 : C.sacrificeable(state, k), whole = can >= d.n, per = C.sacrificeXp(k, d.lv);
            return `<div class="aa-feeditem${whole && n >= d.n ? " whole" : ""}">${cardHTML(d, { size: "xs" })}<div>${esc(d.name)}<br><small class="aa-muted">Lv${d.lv}${d.lv >= d.max ? " ✦ maxed" : ""} · ${per} XP each · ${can === d.n ? (d.n === 1 ? "the card itself" : "all " + d.n + ", the card itself too") : can + " spare"}</small></div>
              <span class="aa-stepper"><button data-a="feed" data-k="${esc(k)}" data-d="-1">−</button><b data-feedn="${esc(k)}">${n}</b><button data-a="feed" data-k="${esc(k)}" data-d="1">+</button></span></div>`; }).join("")}</div>
            <button class="aa-btn" data-a="sacrifice" id="aa-sacbtn" ${xp ? "" : "disabled"}>Sacrifice (${C.ECON.levelFee * c.lv} Moonstones)</button>` : '<p class="aa-muted">Nothing to sacrifice yet.</p>'}</div>`;
      body += sec("Your card", `<div class="aa-row">${inDeck ? '<span class="aa-combo">✦ In your spread</span>' : '<button class="aa-btn sm" data-a="indeck">Put in spread</button>'}</div>${boons}${altar}`, true);
    }
    const deckBits = (F.harmony && deck ? `<p>Deck harmony (${deck.harmony}+ ${esc(deck.name)} cards in your spread): <b>${esc(deck.perk.name)}</b> -- ${esc(deck.perk.text)}</p>` : "")
      + (F.full && C.FULL[c.deck] ? `<p>Full Spread (all eight from ${esc(deck.name)}): <b>${esc(C.FULL[c.deck].name)}</b> -- ${esc(C.FULL[c.deck].text)}</p>` : "") + identityHTML(C.card(key));
    if (deckBits) body += lv >= 2 ? sec("Its deck", deckBits, false) : locked("Its deck", "Face it once to learn what its deck brings.");
    body += lv >= 3 ? sec("Intel", `<ul class="aa-pnl-list">${beatenBy(C.card(key)).map((x) => `<li>${x}</li>`).join("")}</ul><p class="aa-muted">Against it: <b>${rec[2]}</b> won · <b>${rec[3]}</b> lost</p>`, false)
      : locked("Intel", `Beat it three times to learn what beats it (${Math.min(rec[2], 3)} of 3)${own ? "" : ", or own it"}.`);
    body += lv >= 5 ? sec("Spread tips", `<ul class="aa-pnl-list">${tipsFor(C.card(key)).map((x) => `<li>${x}</li>`).join("")}</ul>`, false)
      : locked("Spread tips", "Raise it to its last level to unlock the Archivist's notes.");
    return `<div class="aa-pnl">${docked ? "" : '<button class="aa-iconbtn aa-pnl-x" data-a="panelClose" aria-label="Close">' + ICON.close + "</button>"}${head}${body}</div>`;
  }
  /** A card's details (q9: right-click any card): the Archive's panel -- docked on the Cards page, sliding in anywhere else. */
  function detail(key) {
    ui.detail = key;
    if (screen === "collection") { arch.sel = key; markSel(); }
    let p = $("aa-panel");
    if (!p) { p = document.createElement("aside"); p.id = "aa-panel"; p.className = "aa-panel"; document.body.appendChild(p); }
    const top = document.querySelector(".aa-top"); p.style.top = top ? Math.round(top.getBoundingClientRect().bottom) + "px" : "0";     // (under the top bar, never over it)
    p.innerHTML = panelHTML(key, false); p.classList.add("open");
  }
  function closePanel() { const p = $("aa-panel"); if (p) p.classList.remove("open"); if (arch.sel) { arch.sel = null; markSel(); } }
  const refreshPanel = () => { if (ui.detail && (($("aa-panel") || {}).classList || { contains: () => false }).contains("open")) detail(ui.detail); };
  const markSel = () => document.querySelectorAll(".aa-album .aa-card").forEach((el) => el.classList.toggle("sel", el.dataset.key === arch.sel));

  // ---- the Archive (the Cards page) ----
  function albumList(v) {
    const CAT = C.catalogue(), q = arch.q.trim().toLowerCase();
    return CAT.cards.filter((c) => {
      if (!q && arch.deck && arch.deck !== "all" && c.deck !== arch.deck) return false;
      if (arch.suit !== "all" && c.suit !== arch.suit) return false;
      if (arch.rar !== "all" && c.rarity !== arch.rar) return false;
      const lv = intelOf(c.key), h = state.cards[c.key];
      if (arch.own === "owned" && !(h && h.n > 0)) return false;
      if (arch.own === "doubles" && !(h && h.n > 1)) return false;
      if (arch.own === "seen" && !(lv >= 1 && !(h && h.n > 0))) return false;
      if (arch.own === "unknown" && lv !== 0) return false;
      if (q) { if (lv === 0) return false; const ab = lv >= 2 && c.ab ? (C.ABILITIES[c.ab] || {}) : {}; return (c.name + " " + c.deckName + " " + (ab.name || "") + " " + (ab.text || "")).toLowerCase().includes(q); }
      return true;
    });
  }
  function albumHTML(v) {
    const list = albumList(v), shown = list.slice(0, 160);
    return shown.map((c) => { const lv = intelOf(c.key), h = state.cards[c.key], o = h && h.n > 0;
      return lv === 0 ? cardHTML(cv(c.key), { back: true, cls: "aa-unknown" + (arch.sel === c.key ? " sel" : ""), attrs: 'data-a="card"' })
        : cardHTML(cv(c.key), { missing: !o, count: o ? h.n : 0, inSpread: o && state.spread.includes(c.key), cls: arch.sel === c.key ? "sel" : "", attrs: 'data-a="card"' }); }).join("")
      + (list.length > shown.length ? `<p class="aa-muted aa-more">${list.length - shown.length} more -- search or pick a deck to narrow it down.</p>` : "")
      || '<p class="aa-muted">Nothing matches.</p>';
  }
  function collection(v) {
    if (!v.hasCards) return home(v);
    const CAT = C.catalogue();
    if (!arch.deck || (arch.deck !== "all" && !CAT.byDeck[arch.deck])) arch.deck = (CAT.decks.find((d) => CAT.byDeck[d.slug].some((k) => state.cards[k] && state.cards[k].n > 0)) || CAT.decks[0] || {}).slug || null;
    const count = (sl) => { const ks = CAT.byDeck[sl] || []; let own = 0, seen = 0; ks.forEach((k) => { const l = intelOf(k); if (state.cards[k] && state.cards[k].n > 0) own++; else if (l >= 1) seen++; }); return { own, seen: own + seen, of: ks.length }; };
    const chip = (k, val, label) => `<button class="aa-chip${arch[k] === val ? " on" : ""}" data-a="archSet" data-k="${k}" data-v="${esc(val)}">${esc(label)}</button>`;
    const allN = { own: v.owned, of: v.total };
    const tabs = `<button class="aa-archtab${!arch.q && arch.deck === "all" ? " on" : ""}" data-a="archSet" data-k="deck" data-v="all"><span class="aa-tabglyph">✦</span><span>All</span><small>${allN.own} / ${allN.of}</small></button>` + CAT.decks.map((d) => { const n = count(d.slug); return `<button class="aa-archtab${!arch.q && arch.deck === d.slug ? " on" : ""}" data-a="archSet" data-k="deck" data-v="${esc(d.slug)}" title="${esc(d.name)}: ${n.own} owned, ${n.seen} seen, of ${n.of}">${deckSigil(d.slug, "sm") || `<span class="aa-tabglyph">${d.kind === "oracle" ? "☾" : "✦"}</span>`}<span>${esc(d.name)}</span><small>${n.own} / ${n.of}</small></button>`; }).join("");
    const cur = arch.deck && arch.deck !== "all" && !arch.q ? count(arch.deck) : null, curDeck = cur ? C.deckOf(arch.deck) : null;
    return `<div class="aa-arch">
      ${plate(`<div class="aa-h"><h2>Your spread</h2></div>
        <div class="aa-slots" id="aa-deckslots">${v.spread.map((c) => cardHTML(c, { attrs: 'data-a="card"' })).join("")}${Array.from({ length: C.DECK - v.spread.length }, () => '<div class="aa-emptyslot">+</div>').join("")}</div>
        <div class="aa-combos">${combosLine(v)}</div>
        <div class="aa-saved"><span class="aa-muted" style="font-family:var(--head);font-size:11px;letter-spacing:.1em">SAVED SPREADS</span>
          ${v.decksSaved.map((d) => `<span class="aa-savedeck${d.current ? " on" : ""}${d.ok ? "" : " broken"}"><button data-a="deckUse" data-id="${esc(d.id)}" title="${d.ok ? "Play this spread" : "A card in it is no longer yours"}">${esc(d.name)}</button><button data-a="deckDel" data-id="${esc(d.id)}" aria-label="Delete ${esc(d.name)}">×</button></span>`).join("") || '<span class="aa-muted">none yet</span>'}
          <input class="aa-sel" id="aa-deckname" maxlength="40" placeholder="Name this spread…" value="${esc((v.decksSaved.find((d) => d.current) || {}).name || "")}"><button class="aa-btn ghost sm" data-a="deckSave">Save spread</button></div>`)}
      <div class="aa-archbar"><input class="aa-sel aa-archq" id="aa-archq" type="search" placeholder="Search names, decks, abilities…" value="${esc(arch.q)}" aria-label="Search the Archive">
        ${chip("own", "all", "Everything")}${chip("own", "owned", "Owned")}${chip("own", "seen", "Seen")}${chip("own", "unknown", "Never met")}${chip("own", "doubles", "Doubles")}
        <select class="aa-sel" data-a="archPick" data-k="suit" aria-label="Suit"><option value="all">Any suit</option>${["major"].concat(C.SUITS, ["oracle"]).map((x) => `<option value="${x}"${arch.suit === x ? " selected" : ""}>${C.SUIT[x].glyph} ${x === "major" ? "Majors" : esc(C.SUIT[x].name)}</option>`).join("")}</select>
        <select class="aa-sel" data-a="archPick" data-k="rar" aria-label="Rarity"><option value="all">Any rarity</option>${C.RARITIES.map((r) => `<option value="${r}"${arch.rar === r ? " selected" : ""}>${esc(C.RARITY[r].name)}</option>`).join("")}</select></div>
      <div class="aa-archtabs">${tabs}</div>
      <div class="aa-albumhead" id="aa-albumhead">${arch.q ? `Every deck: “${esc(arch.q)}”` : curDeck ? `${deckSigil(curDeck.slug, "sm")}<b>${esc(curDeck.name)}</b> -- ${cur.own} of ${cur.of} owned, ${cur.seen} seen <span class="aa-albumbar"><i style="width:${100 * cur.own / Math.max(1, cur.of)}%"></i><i class="seen" style="width:${100 * (cur.seen - cur.own) / Math.max(1, cur.of)}%"></i></span>` : ""}<span class="aa-muted"> · you own ${v.owned} of ${v.total} cards</span></div>
      <div class="aa-cards aa-album" id="aa-album">${albumHTML(v)}</div></div>`;
  }

  // ---- the Scouting Tent (Cam, PT66 k1: "its own dedicated spot ... a spy glass ... information about them that can inform
  //      deck design for that keeper"; Q12 q11: every keeper you've met, the ones who beat you first) ----
  const tentList = () => Object.keys(codex.keepers).filter((k) => /^(fool|oracle):\d+$/.test(k)).map((k) => { const [camp, st] = k.split(":"); return Object.assign({ id: k, camp, st: +st }, codex.keepers[k]); })
    .sort((a, b) => (b.lost > b.won) - (a.lost > a.won) || (a.camp === b.camp ? a.st - b.st : a.camp === "fool" ? -1 : 1));
  function tent(v) {
    const list = tentList(), F = C.features();
    if (!list.length) return plate(`<h2>The Scouting Tent</h2><p class="aa-muted">Meet a keeper on the road, and what you learn of them is kept here.</p>`);
    if (!ui.tentSel || !codex.keepers[ui.tentSel]) ui.tentSel = list[0].id;
    const K = list.find((x) => x.id === ui.tentSel), camp = v.camps.find((c) => c.id === K.camp) || v.camps[0], stn = camp.stations[K.st - 1] || {};
    const row = (x) => { const cp = v.camps.find((c) => c.id === x.camp) || v.camps[0], s = cp.stations[x.st - 1] || {};
      return `<button class="aa-tentrow${x.id === ui.tentSel ? " on" : ""}${x.lost > x.won ? " beat" : ""}" data-a="tentSel" data-id="${esc(x.id)}">${keeperFace(x.camp, x.st, "stn")}<span><b>${esc(s.keeper || s.name || "A keeper")}</b><small>${esc(cp.name)} · ${esc(s.numeral || x.st)} · ${x.won} won · ${x.lost} lost${x.lost > x.won ? " · <em>beat you</em>" : ""}</small></span></button>`; };
    const sc = C.scout(state, "journey", { camp: K.camp, station: K.st }, Date.now());
    const seen = Object.keys(K.spreads).sort().map((i) => ({ i: +i, keys: K.spreads[i] })).filter((x) => x.keys.length);
    const known = sc && sc.cards ? sc.cards.map((x) => x.key) : null;
    const strip = (keys) => `<div class="aa-tentcards">${keys.map((k) => intelOf(k) === 0 ? cardHTML(cv(k), { size: "sm", back: true, cls: "aa-unknown", attrs: 'data-a="card"' }) : cardHTML(cv(k), { size: "sm", missing: !(state.cards[k] && state.cards[k].n > 0), attrs: 'data-a="card"' })).join("")}</div>`;
    const ONE = { major: "Major", court: "court card", pip: "Ace or number", oracle: "oracle card" };
    const kinds = sc ? Object.keys(sc.kinds).filter((k) => sc.kinds[k]).map((k) => `<span class="aa-kindn k-${k}">${F.deep ? mark(k) : ""}<b>${sc.kinds[k]}</b> ${esc(sc.kinds[k] === 1 ? ONE[k] : KIND_NAME[k])}</span>`).join("") : "";
    const decks = sc && F.deep ? sc.decks.map((d) => `<div class="aa-scoutdeck">${deckSigil(d.slug, "sm")}<b>${esc(d.name)}</b> <small class="aa-muted">× ${d.n}</small>
        <span class="hunt">${mark("hunt")}hunts ${mark(d.hunt)}${esc(KIND_NAME[d.hunt])}</span> <span class="fear">${mark("fear")}fears ${mark(d.fear)}${esc(KIND_NAME[d.fear])}</span>${d.lean ? `<small class="aa-muted"> · ${esc(d.lean.name)}: ${esc(d.lean.text)}</small>` : ""}</div>`).join("") : "";
    const edge = (m) => `<span class="aa-edge ${m.edge >= 0.3 ? "good" : m.edge <= -0.3 ? "bad" : ""}">▲ ${m.hunt} hunt · ▼ ${m.fear} fear · ${m.edge > 0 ? "+" : m.edge < 0 ? "−" : "±"}${Math.abs(m.edge)} Power a clash</span>`;
    const spreads = sc ? sc.spreads.map((x) => `<div class="aa-scoutspread${x.current ? " on" : ""}"><span>${esc(x.name)}</span>${F.deep ? edge(x.m) : "<span></span>"}${x.current ? '<small class="aa-muted">bringing</small>' : `<button class="aa-chip" data-a="tentUse" data-id="${esc(x.id)}">Bring this</button>`}</div>`).join("") : "";
    const open = stn.cleared || stn.open;
    return `<div class="aa-tent"><aside class="aa-tentlist"><h2>The Scouting Tent</h2>${list.map(row).join("")}</aside>
      <div class="aa-tentmain">${plate(`<div class="aa-tenthead">${keeperFace(K.camp, K.st, "who")}<div><div class="aa-muted">${esc(camp.name)} · station ${esc(stn.numeral || K.st)}</div><h2>${esc(stn.keeper || stn.name)}</h2>
          <div class="aa-muted">Met ${K.met} times · you won ${K.won} · they won ${K.lost}</div></div></div>
        ${sc && sc.field ? `<p class="aa-fieldline f-${sc.field}">${FIELD_GLYPH[sc.field]} ${esc(fieldWords(sc.field))}</p>` : ""}
        ${sc && sc.temper ? `<p class="aa-temper"><b>${esc(sc.temper.name)}</b> -- this keeper ${esc(sc.temper.text)}.</p>` : ""}
        ${sc && sc.keeper ? `<p class="aa-scoutk">${sc.keeper.n > 1 ? `They keep <b>${sc.keeper.n} spreads</b> and play them in turn -- next, their <b>${sc.keeper.i ? "second" : "first"}</b>.` : "They keep <b>one spread</b>."}${sc.keeper.note ? ` <i>${esc(sc.keeper.note)}</i>` : ""}</p>` : ""}
        <h3 class="aa-subh">What they bring</h3><div class="aa-kinds">${kinds}</div>${decks}
        <h3 class="aa-subh">${known ? "Their next spread" : "Cards you've seen them play"}</h3>${known ? strip(known) : seen.length ? seen.map((x) => `${seen.length > 1 ? `<small class="aa-muted">${x.i ? "Their second spread" : "Their first spread"}</small>` : ""}${strip(x.keys)}`).join("") : '<p class="aa-muted">Nothing yet -- every clash with them adds to this.</p>'}
        <h3 class="aa-subh">Plan a spread against them</h3>${F.deep ? `` : ""}
        <div class="aa-scoutspreads">${spreads || '<p class="aa-muted">Save a spread on the Cards page to compare it here.</p>'}</div>
        <div class="aa-row" style="justify-content:center;margin-top:14px">${open ? `<button class="aa-btn big" data-a="fight" data-mode="journey" data-camp="${esc(K.camp)}" data-n="${K.st}">Challenge them</button>` : ""}<button class="aa-btn ghost" data-a="go" data-to="collection">Build a spread</button></div>
        <button class="aa-tentback" data-a="panelClose" title="Close the card and show the keepers again">← Back to the keepers</button>`)}</div></div>`;
  }
  // ==== the Library (Cam, 2 Nov: "a Library tab ... the books unlocked are shown as covers on a shelf. Ones undiscovered
  //      will have a question mark ... when unlocking a page have a pop up ... go to the library to read the page (once read
  //      it shows you what the page is and then it is added to respective lore book)") -- the books and their rules are
  //      library.js, the words library-text.js; what you've found lives in the codex (every save), like the Archive's intel.
  const LIB = window.ArcanaLibrary || null;
  const libHave = () => (codex.library = codex.library || {});
  const libRead = (id) => !!(libHave()[id] && libHave()[id][1]);
  const libFound = (id) => !!libHave()[id];
  const bookPages = (b) => b.pages.filter((p) => libRead(p.id)).length;
  const bookDone = (b) => b.pages.every((p) => libRead(p.id));
  const libOpen = () => !!LIB && Object.keys(libHave()).length > 0;
  /** New pages this save has earned: into the codex, sealed; the Library's icon counts them. */
  function libCheck() {
    if (!LIB || !state || !state.made || state.diff === "free") return;
    const v = V(), ids = LIB.check(state, codex, diaryRec, { maxLv: C.maxLv, decksDone: (v.decks || []).filter((d) => d.done).length });
    if (!ids.length) return;
    ids.forEach((id) => { libHave()[id] = [Date.now(), 0]; });
    codexSave(); chrome(v);                                      // (the count on the Library's icon says so -- no pop-up)
  }
  function libSync() {
    if (!LIB || !state || !state.made) return;
    const pages = Object.keys(libHave()).filter(libRead).length, books = LIB.BOOKS.filter(bookDone).map((b) => b.id);
    if (pages !== (state.lib || {}).pages || books.join() !== ((state.lib || {}).books || []).join()) act("libSync", { pages, books });
  }
  function coverHTML(b) {
    const found = b.pages.some((p) => libRead(p.id)), n = bookPages(b), done = bookDone(b);
    if (!found) return `<div class="aa-book-slot"><div class="aa-cover unknown"><b>?</b></div><b class="aa-cover-title">&nbsp;</b><small>&nbsp;</small></div>`;
    // (Cam's painted covers, Art Prompts 18: the title under the book, as on a real shelf label)
    if (b.deck) return `<div class="aa-book-slot"><button class="aa-cover deckbook" data-a="libBook" data-id="${b.id}" title="${esc(b.title)} -- ${esc(b.by)}">${b.cover_img ? `<img src="${imgPath(b.cover_img, false)}" alt="" draggable="false">` : `<span class="aa-cover-glyph">${b.glyph}</span>`}</button>
      <b class="aa-cover-title">${esc(b.title)}</b><small class="${done ? "done" : ""}">${done ? "✓ Complete" : `${n} / ${b.pages.length}`}</small></div>`;
    return `<div class="aa-book-slot"><button class="aa-cover painted" data-a="libBook" data-id="${b.id}" title="${esc(b.title)} -- ${esc(b.by)}"><img src="${IMG("covers/" + b.id)}" alt="" draggable="false"></button>
      <b class="aa-cover-title">${esc(b.title)}</b><small class="${done ? "done" : ""}">${done ? "✓ Complete" : `${n} / ${b.pages.length}`}</small></div>`;
  }
  function library(v) {
    if (!libOpen()) return plate(`<h2>The Library</h2><p class="aa-muted">Its doors open when you finish the starting tutorial.</p>`);
    const sealed = Object.keys(libHave()).filter((id) => !libRead(id) && LIB.PAGE[id]);
    const lore = LIB.BOOKS.slice(0, LIB.loreCount ? LIB.loreCount() : LIB.BOOKS.length), decks = LIB.BOOKS.slice(lore.length);
    const shelves = [], deckShelves = []; for (let i = 0; i < lore.length; i += 6) shelves.push(lore.slice(i, i + 6)); for (let i = 0; i < decks.length; i += 6) deckShelves.push(decks.slice(i, i + 6));
    const total = Object.keys(LIB.PAGE).length, read = Object.keys(libHave()).filter(libRead).length;
    return `<div class="aa-hello"><div><h1>The Library</h1><div class="aa-muted">${read} of ${total} pages</div></div></div>
      ${sealed.length ? `<div class="aa-tray"><h3 class="aa-subh">Sealed pages · ${sealed.length}</h3><div class="aa-tray-row">${sealed.slice(0, 12).map((id) => `<button class="aa-envelope" data-a="libOpenPage" data-id="${id}" title="Break the seal"><i></i></button>`).join("")}
        ${sealed.length > 12 ? `<span class="aa-tray-more">+${sealed.length - 12}</span>` : ""}${sealed.length > 1 ? '<button class="aa-chip" data-a="libOpenAll">Break every seal</button>' : ""}</div></div>` : ""}
      <div class="aa-shelves">${shelves.map((row) => `<div class="aa-shelf-row">${row.map(coverHTML).join("")}</div>`).join("")}</div>
      ${deckShelves.length ? `<h3 class="aa-subh" style="margin-top:28px">The decks' own guidebooks</h3><div class="aa-shelves">${deckShelves.map((row) => `<div class="aa-shelf-row">${row.map(coverHTML).join("")}</div>`).join("")}</div>` : ""}`;
  }
  // ---- the Field Guide's charts, drawn from the rules as they are (so they're never out of date) ----
  function fieldHTML(id) {
    const F = C.features(), row = (cells) => `<tr>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`;
    if (id === "field-elements") {
      const pos = { cups: [100, 22], wands: [178, 100], swords: [100, 178], pentacles: [22, 100] }, col = { cups: "#49b4ff", wands: "#ff7a45", swords: "#9aa8e8", pentacles: "#82d26c" };
      const arrow = (a, b) => { const [x1, y1] = pos[a], [x2, y2] = pos[b], mx = (x1 + x2) / 2 + (y2 - y1) * 0.18, my = (y1 + y2) / 2 - (x2 - x1) * 0.18; return `<path d="M${x1 + (x2 - x1) * 0.2},${y1 + (y2 - y1) * 0.2} Q${mx},${my} ${x1 + (x2 - x1) * 0.8},${y1 + (y2 - y1) * 0.8}" stroke="#7a4a1a" stroke-width="2.4" fill="none" marker-end="url(#ah)"/>`; };
      return `<svg class="aa-fg-wheel" viewBox="0 0 200 200"><defs><marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#7a4a1a"/></marker></defs>
        ${Object.keys(C.BEATS).map((s) => arrow(s, C.BEATS[s])).join("")}${Object.keys(pos).map((s) => `<g><circle cx="${pos[s][0]}" cy="${pos[s][1]}" r="18" fill="${col[s]}" stroke="#3a1d0c" stroke-width="1.5"/><text x="${pos[s][0]}" y="${pos[s][1] + 5}" text-anchor="middle" font-size="15" fill="#1a0e04">${C.SUIT[s].glyph}</text></g>`).join("")}</svg>
        <table class="aa-fg">${Object.keys(C.BEATS).map((s) => row([`<b>${esc(C.SUIT[s].name)}</b>`, "beat", `<b>${esc(C.SUIT[C.BEATS[s]].name)}</b>`, "+2 Power"])).join("")}</table>`;
    }
    if (id === "field-kinds") {
      const cards = C.catalogue().cards, n = (k) => cards.filter((c) => C.kindOf(c) === k).length;
      return `<table class="aa-fg">${[["major", "Majors", "Every one has an ability; rare (the Wheel epic, the World mythic)"], ["court", "Court cards", "The strongest numbers; epic"], ["pip", "Aces and numbers", "The many; Aces carry a little ability"], ["oracle", "Oracle cards", "Their own numbers and gifts, from the realms"]].map((x) => row([`<b>${x[1]}</b>`, n(x[0]), x[2]])).join("")}</table>`;
    }
    if (id === "field-fields") {
      return `<table class="aa-fg">${C.FIELDS.map((f) => { const up = C.FIELD[f].suit, down = C.BEATS[up]; const keepers = Object.keys(C.MAJOR_FIELD).filter((st) => C.MAJOR_FIELD[st] === f).map((st) => C.MAJOR_NAMES[st]); return row([`<b>${esc(C.FIELD[f].name)}</b>`, `${esc(C.SUIT[up].name)} +2`, `${esc(C.SUIT[down].name)} −1`, `<small>${keepers.map(esc).join(", ")}</small>`]); }).join("")}</table>`;
    }
    if (id === "field-decks") {
      return `<table class="aa-fg">${C.catalogue().decks.map((d) => row([`${deckSigil(d.slug, "sm")}<b>${esc(d.name)}</b>`, `<small>${esc(d.perk.name)}: ${esc(d.perk.text)}</small>`, C.FULL[d.slug] ? `<small>${esc(F.deep && d.slug === C.LOOKING_GLASS ? "Mushroom Growth: a die each round, 4-6 +3 Power" : C.FULL[d.slug].name + ": " + C.FULL[d.slug].text)}</small>` : ""])).join("")}</table>`;
    }
    if (id === "field-seals") return `<table class="aa-fg">${C.SEALS.map((x) => row([`<b>${esc(x.name)}</b>`, `<small>when ${esc(x.when)}</small>`, `<small>${esc(x.text)}</small>`])).join("")}</table>`;
    if (id === "field-hunts") return `<table class="aa-fg">${C.catalogue().decks.map((d) => { const A = C.affinityOf(d.slug); return row([`${deckSigil(d.slug, "sm")}<b>${esc(d.name)}</b>`, `<span class="hunt">${mark("hunt")}${esc(KIND_NAME[A.hunt] || A.hunt)}</span>`, `<span class="fear">${mark("fear")}${esc(KIND_NAME[A.fear] || A.fear)}</span>`]); }).join("")}</table>`;
    if (id === "field-tempers") return `<table class="aa-fg">${Object.keys(C.TEMPERS).map((t) => row([`<b>${esc(C.TEMPERS[t].name)}</b>`, `<small>${esc(C.TEMPERS[t].text)}</small>`, `<small>${C.MAJOR_NAMES.filter((_, st) => st > 0 && C.temperOf("fool", st) === t).map(esc).join(", ")}</small>`])).join("")}</table>`;
    return "";
  }
  /** A book, opened like the café's cookbook in a purple cover: contents on the left, the page on the right. */
  function bookSheet(bookId, pageId, fresh) {
    const b = LIB.BOOKS.find((x) => x.id === bookId); if (!b) return;
    const readable = b.pages.filter((p) => libRead(p.id));
    const cur = (pageId && readable.find((p) => p.id === pageId)) || null, at = cur ? readable.indexOf(cur) : -1;
    const line = (p) => libRead(p.id) ? `<button class="aa-bk-line${cur && cur.id === p.id ? " on" : ""}" data-a="libPage" data-book="${b.id}" data-id="${p.id}"><span>${esc(p.title)}</span></button>`
      : libFound(p.id) ? `<div class="aa-bk-line sealed" title="Waiting, sealed, in the Library">✉ <span>a sealed page</span></div>`
      : `<div class="aa-bk-line unknown" title="${esc(p.unlock.k === "card" ? "A secret" : LIB.hintOf(p.unlock))}"><span>· · ·</span></div>`;
    const left = `<div class="aa-bk-title">${b.deck ? (b.cover_img ? `<img class="aa-bk-cover deck" src="${imgPath(b.cover_img, false)}" alt="" draggable="false">` : "") : `<img class="aa-bk-cover" src="${IMG("covers/" + b.id)}" alt="" draggable="false">`}<h2>${esc(b.title)}</h2><i>${esc(b.by)}</i><small class="${bookDone(b) ? "done" : ""}">${bookDone(b) ? "✓ Complete" : `${readable.length} of ${b.pages.length} pages`}</small></div>
      <div class="aa-bk-contents">${b.pages.map(line).join("")}</div>`;
    const words = cur ? (LIB.textOf(cur.id) || []) : [];
    const right = cur ? `${fresh ? `<div class="aa-bk-added">✦ Added to ${esc(b.title)}</div>` : ""}<h3 class="aa-bk-h">${esc(cur.title)}</h3>${cur.key && C.card(cur.key) ? `<div class="aa-bk-card">${cardHTML(cv(cur.key), { size: "sm" })}</div>` : ""}${words.map((p) => p.startsWith("> ") ? `<blockquote class="aa-bk-quote">${esc(p.slice(2))}</blockquote>` : `<p>${esc(p)}</p>`).join("")}${b.gen ? fieldHTML(cur.id) : ""}
        ${(() => { const rows = LIB.corrOf && LIB.corrOf(cur.id); return rows ? `<table class="aa-fg aa-corr">${rows.map((r) => `<tr><td>${esc(r[0])}</td><td><b>${esc(r[1])}</b></td></tr>`).join("")}</table>` : ""; })()}
        <div class="aa-bk-foot">${at > 0 ? `<button class="aa-bk-arrow l" data-a="libPage" data-book="${b.id}" data-id="${readable[at - 1].id}" aria-label="The page before">‹</button>` : "<span></span>"}<div class="aa-bk-pg">${cur.n} / ${b.pages.length}</div>${at >= 0 && at < readable.length - 1 ? `<button class="aa-bk-arrow r" data-a="libPage" data-book="${b.id}" data-id="${readable[at + 1].id}" aria-label="The next page">›</button>` : "<span></span>"}</div>`
      : `<div class="aa-bk-blank"><p>Choose a page from the contents.</p></div>`;
    const open = document.querySelector(`#aa-over .aa-book[data-book="${b.id}"]`);
    if (open) {                                                  // (already open: only the page and the contents' mark change)
      const r = open.querySelector(".aa-bk-page.r"), l = open.querySelector(".aa-bk-page.l"), ls = l.scrollTop;
      r.innerHTML = right; r.scrollTop = 0; l.innerHTML = left; l.scrollTop = ls;
      return;
    }
    sheet(`<div class="aa-book" data-book="${b.id}" style="--cv:${b.cover}"><div class="aa-bk-page l">${left}</div><div class="aa-bk-page r">${right}</div></div>`, "book");
  }
  function replaceSheet(key) {
    ui.replaceWith = key;
    // (Cam, 1 Nov: "present the cards larger so we can see what we are changing out")
    sheet(`<h2>Which card makes way?</h2>
      <div class="aa-swap"><div class="aa-swapin"><small>Coming in</small>${cardHTML(cv(key), { big: true })}<span class="aa-swaparrow">⇄</span></div>
        <div class="aa-swapout">${state.spread.map((k) => cardHTML(cv(k), { big: true, attrs: `data-a="replace" data-k="${esc(k)}" title="Swap out ${esc(C.card(k).name)}"` })).join("")}</div></div>`, "wide");
  }

  // ---- the combo book (the Archivist's) ----
  // ---- the Combo Book (Cam, 1 Nov: "hard to read and needs to be more stylized"): chapters of parchment pages, each with
  // its sigil; a combo in your spread wears a ribbon; an unwritten page is sealed with wax ----
  const SIGIL = {
    wands: '<path d="M12 4 21 19H3Z"/>', cups: '<path d="M12 20 3 5h18Z"/>',
    swords: '<path d="M12 4 21 19H3Z"/><path d="M5.5 14.5h13"/>', pentacles: '<path d="M12 20 3 5h18Z"/><path d="M5.5 9.5h13"/>',
    crown: '<path d="M3 18h18M4 18 3 7l5 4 4-6 4 6 5-4-1 11"/>', star: '<path d="M12 3l2.6 6.2 6.4.5-4.9 4.2 1.5 6.4L12 17l-5.6 3.3 1.5-6.4L3 9.7l6.4-.5Z"/>',
    path: '<path d="M4 20c4-2 4-6 8-8s4-6 8-8"/><circle cx="4" cy="20" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="20" cy="4" r="1.4"/>',
    deck: '<rect x="6" y="3" width="11" height="16" rx="1.5"/><path d="M9 6.5h8.5a1.5 1.5 0 0 1 1.5 1.5v12.5a1.5 1.5 0 0 1-1.5 1.5H9"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'
  };
  const SUIT_COLOUR = { wands: "var(--wands)", cups: "var(--cups)", swords: "var(--swords)", pentacles: "var(--pentacles)" };
  function comboSigil(b) {
    const [kind, arg] = b.id.split("-");
    const suit = (kind === "suit" || kind === "pure" || kind === "court") && SIGIL[arg] ? arg : null;
    const g = suit ? (kind === "court" ? SIGIL.crown : SIGIL[suit]) : kind === "crown" ? SIGIL.crown : kind === "path" ? SIGIL.path
      : kind === "trinity" || kind === "journey" ? SIGIL.star : b.group === "Oracle Circles" ? SIGIL.eye : SIGIL.deck;
    return `<span class="sigil" style="--sc:${suit ? SUIT_COLOUR[suit] : b.group === "Major Arcana" ? "var(--major)" : b.group === "Oracle Circles" ? "var(--oracle)" : "var(--gold)"}"><svg viewBox="0 0 24 24" aria-hidden="true">${g}</svg></span>`;
  }
  function combosScreen(v) {
    const groups = [];
    v.book.forEach((b) => { if (!groups.includes(b.group)) groups.push(b.group); });
    const found = v.book.filter((b) => b.known).length;
    const hint = { Elements: "something of the suits", Courts: "something of the courts", "Major Arcana": "something of the Majors", "Oracle Circles": "something of an oracle deck", "Humble Cards": "something of fresh, low-level cards" };
    const page = (b) => b.known
      ? `<article class="aa-page${b.awake ? " awake" : ""}">${b.awake ? '<span class="ribbon">In your spread</span>' : ""}
          <header>${comboSigil(b)}<h3>${esc(b.name)}</h3></header>
          <div class="need"><small>Needs</small>${esc(b.need)}</div>
          <div class="eff"><small>Gives</small>${esc(b.text)}</div>
          <p class="lore">${esc(b.lore)}</p></article>`
      : `<article class="aa-page sealed${b.awake ? " stirring" : ""}"><span class="seal" aria-hidden="true">?</span>
          <h3>Unwritten</h3><p>${b.awake ? "Something stirs in your spread. Take it into battle to write this page." : `${esc(hint[b.group] || "something of a deck")[0].toUpperCase()}${esc(hint[b.group] || "something of a deck").slice(1)}.`}</p></article>`;
    return `<div class="aa-hello"><div><h1>${icon("combobook", "h1")}The Combo Book</h1><div class="aa-muted">${found} of ${v.book.length} pages written.</div></div></div>
      <div class="aa-bookprog"><i style="width:${(100 * found / v.book.length).toFixed(1)}%"></i></div>
      ${groups.map((g, gi) => { const list = v.book.filter((b) => b.group === g), n = list.filter((b) => b.known).length;
        return `<section class="aa-chapter"><h2><span class="num">${ROMAN_N[gi + 1]}</span>${esc(g)}<small>${n} / ${list.length}</small></h2><div class="aa-book">${list.map(page).join("")}</div></section>`; }).join("")}`;
  }
  const ROMAN_N = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

  // ---- the store (Orrin's) ----
  function store(v) {
    const ware = (kind, title, sub, price, attrs, cover, id) => `<div class="aa-plate aa-ware"><div class="packart">${kind === "starter" ? icon("starter", "pack") : kind === "starlight" ? icon("starlight", "pack") : ART.pack(kind, title, cover, id)}</div><h3>${esc(title)}</h3><small>${esc(sub)}</small>
      <button class="aa-btn sm" ${attrs} ${v.moon < price ? "disabled" : ""}>${num(price)} Moonstones</button></div>`;
    const starter = v.hasCards ? "" : ware("starter", "Starter Spread", "Your first eight cards: three of a suit, an uncommon and a rare", C.ECON.starter, 'data-a="buyStarter" id="aa-buystarter"', null, "ws");
    const sealed = v.decks.filter((d) => !d.open);
    const decks = v.decks.filter((d) => d.open).map((d, i) => `<div class="aa-plate aa-ware"><div class="packart">${ART.pack("deck", d.name, d.cover ? imgPath(d.cover, false) : null, "wd" + i)}</div><h3>${esc(d.name)}</h3>
      <small>${d.kind === "oracle" ? "Oracle" : "Tarot"} · ${d.have}/${d.of} cards${d.done ? " · complete ✓" : ""} · harmony: ${esc(d.perk.name)}</small>
      <div class="aa-xp" style="width:100%"><i style="width:${100 * d.have / d.of}%"></i></div>
      <button class="aa-btn sm" data-a="buyPack" data-deck="${esc(d.slug)}" ${v.moon < C.ECON.deckPack.price || !v.hasCards ? "disabled" : ""}>Booster · ${num(C.ECON.deckPack.price)}</button>
      ${d.done ? "" : `<button class="aa-chip" data-a="buyDeck" data-deck="${esc(d.slug)}" ${v.moon < d.price ? "disabled" : ""}>Complete it · ${num(d.price)}</button>`}</div>`).join("");
    return `<div class="aa-hello"><div><h1>Orrin's Store</h1><div class="aa-muted">The World within ${C.ECON.pity - v.pity} more tarot boosters at the latest.</div></div></div>
      <div class="aa-shelf">${starter}${ware("starlight", "Starlight", "Five cards from any deck", C.ECON.pack.price, `data-a="buyPack" data-deck="" ${v.hasCards ? "" : "disabled"}`, null, "wl")}</div>
      <div class="aa-rule">Deck boosters</div><div class="aa-shelf">${decks}</div>
${v.features.seals ? `      <div class="aa-rule">Seals</div>
      <div class="aa-sealshelf">${C.SEALS.map((x) => `<div class="aa-plate aa-sealware">${sealMark(x.id, "lg")}<div><h3>${esc(x.name)}</h3><p><b>When</b> ${esc(x.when)}: ${esc(x.text)}.</p>
        <div class="aa-row"><button class="aa-btn sm" data-a="buySeal" data-id="${x.id}" ${v.moon < x.price ? "disabled" : ""}>${num(x.price)} Moonstones</button>${v.seals && v.seals[x.id] ? `<span class="aa-muted">you have ${v.seals[x.id]}</span>` : ""}</div></div></div>`).join("")}</div>
` : ""}      ${sealed.length ? `<div class="aa-rule">Sealed</div><div class="aa-plate aa-sealed">${icon("sealed", "inline")}<b>${sealed.length} oracle decks</b> -- ${sealed.map((d) => esc(d.name)).join(", ")}. Orrin keeps them locked away until you beat the World.</div>` : ""}`;
  }
  /** The booster: a foil packet floats; clicked, it shakes, its top tears away, the cards rise out and are dealt face down. */
  async function openingFX(cards, kind, title, cover) {
    intelSee((cards || []).map((c) => c.key));
    (cards || []).forEach((c) => { const id = String(c.key || "").split(":")[1]; if (id && /_/.test(id)) (codex.pulled = codex.pulled || {})[id] = 1; });
    busy = true;
    const host = document.createElement("div");
    host.className = "aa-opening"; host.id = "aa-opening-live";
    $("aa-guide").innerHTML = "";
    const stack = cards.slice(0, 5).map((c, i) => `<div class="aa-card back" style="transform:translate(${i * 2}px,${i * -2}px) rotate(${(i - 2) * 1.5}deg)"><div class="aa-card-in"><div class="aa-face"></div><div class="aa-back">${BACK}</div></div></div>`).join("");
    host.innerHTML = `<div class="aa-packwrap" id="aa-pk"><div class="stack">${stack}</div><div class="pk body">${ART.pack(kind, title, cover, "ob")}</div><div class="pk top">${ART.pack(kind, title, cover, "ot")}</div></div>
      <div class="aa-muted" style="font-family:var(--head);letter-spacing:.2em;font-size:12px">CLICK THE PACK TO OPEN IT</div>`;
    document.body.appendChild(host);
    const pk = host.querySelector("#aa-pk");
    await new Promise((res) => pk.addEventListener("click", res, { once: true }));
    host.lastElementChild.textContent = "";
    pk.classList.add("shake"); sfx("tick");
    await sleep(820);
    pk.classList.remove("shake"); pk.classList.add("torn"); sfx("tear");
    await sleep(560);
    pk.classList.add("rise"); sfx("rare");
    await sleep(700);
    pk.classList.add("drop");
    await sleep(420);
    host.innerHTML = `<div class="aa-reveal">${cards.map((c, i) => cardHTML(cv(c.key), { back: true, big: true, cls: "dealt", attrs: `data-i="${i}" style="animation-delay:${i * 110}ms"` })).join("")}</div>
      <div class="aa-row"><button class="aa-btn ghost" data-r="all">Reveal all</button><button class="aa-btn" data-r="done" hidden>Done</button></div><div class="aa-muted">Click each card to turn it over</div>`;
    const turned = new Set();
    const turn = (el) => {
      const i = +el.dataset.i;
      if (turned.has(i)) return;
      turned.add(i);
      el.classList.remove("back");
      const c = cards[i], rar = C.card(c.key).rarity;
      if (rar === "rare" || rar === "epic" || rar === "mythic") el.classList.add("glow-" + rar);
      if (c.isNew) el.insertAdjacentHTML("beforeend", '<span class="aa-new">NEW</span>');
      sfx(rar === "epic" || rar === "mythic" ? "rare" : "flip");
      if (turned.size === cards.length) { host.querySelector('[data-r="all"]').hidden = true; host.querySelector('[data-r="done"]').hidden = false; }
    };
    await new Promise((done) => {
      host.addEventListener("click", (e) => {
        const el = e.target.closest(".aa-card");
        if (el) return turn(el);
        const b = e.target.closest("[data-r]");
        if (!b) return;
        if (b.dataset.r === "all") host.querySelectorAll(".aa-card").forEach((x, k) => setTimeout(() => turn(x), k * 180));
        if (b.dataset.r === "done") done();
      });
    });
    host.remove();
    busy = false;
  }

  // ---- divination: today's card and readings ----
  function omenRunHTML(v) {
    const n = (v.omenRun && v.omenRun.n) || 0, every = C.ECON.omen.every, left = every - (n % every);
    return !n ? `<div class="aa-omenrun"><span>Draw a card on days running: every ${every}th day, ${C.ECON.omen.gift} free cards.</span></div>` : `<div class="aa-omenrun" title="Draw your card of the day on days running: every ${every}th day, ${C.ECON.omen.gift} free cards">${Array.from({ length: every }, (_, i) => `<i class="${i < n % every || (n % every === 0) ? "on" : ""}"></i>`).join("")}<span>${n} day${n === 1 ? "" : "s"} running · ${n % every === 0 ? "today's gift received" : `${C.ECON.omen.gift} free cards in ${left} day${left === 1 ? "" : "s"}`}</span></div>`;
  }
  function divine(v) {
    if (!v.hasCards) return home(v);
    const D = v.daily;
    const today = D ? `<div class="aa-daily">${cardHTML(D.card, { size: "lg", big: true, rev: D.rev })}<div><div class="aa-muted">Today's card${D.rev ? " -- reversed" : ""} · ${esc(D.card.deckName)}</div><h2 style="color:var(--gold3)">${esc(D.card.name)}</h2>
        <div class="aa-omen">✦ ${esc(D.omen.text)}</div><div class="aa-meaning">${D.rev && D.card.rev ? `<h4>Reversed</h4>${esc(D.card.rev)}` : D.card.up ? `<h4>${D.card.kind === "oracle" ? "Meaning" : "Upright"}</h4>${esc(D.card.up)}` : ""}</div>
        <p class="aa-muted">It's in your journal. A new card tomorrow.</p>${omenRunHTML(v)}</div></div>`
      : `<p class="aa-muted">Breathe, and choose one.</p>
        <div class="aa-fan" id="aa-fan">${Array.from({ length: 9 }, (_, i) => `<div class="aa-card back" data-a="drawDaily" style="--rot:${(i - 4) * 8}deg;--dy:${Math.abs(i - 4) * 6}px"><div class="aa-card-in"><div class="aa-face"></div><div class="aa-back">${BACK}</div></div></div>`).join("")}</div>`;
    return `<div class="aa-stack">${plate(`<div class="aa-h"><h2>${icon("daily", "h")}Card of the day</h2></div>${today}`)}
      ${plate(`<div class="aa-h"><h2>Readings</h2><small>spreads from your own cards</small></div><button class="aa-btn ghost" data-a="go" data-to="readings">Open the reading table</button>`)}</div>`;
  }
  // ---- readings (Cam, 1 Nov: "a reading section ... pull from the cards I have unlocked ... once fully unlocked I can
  // pick to read from that specific deck") ----
  function readings(v) {
    if (!v.hasCards) return home(v);
    const done = v.decks.filter((d) => d.done && d.open);
    const sources = [{ id: "collection", name: `Your collection (${v.owned} cards)` }].concat(done.map((d) => ({ id: d.slug, name: d.name + " (complete)" })));
    const src = sources.some((x) => x.id === ui.rdeck) ? ui.rdeck : "collection", sp = ui.rspread || "three", SP = C.SPREADS[sp];
    return `<div class="aa-hello"><div><h1>The Reading Table</h1><div class="aa-muted">Draw from every card you own -- or, once you've completed a deck, from that deck alone.</div></div></div>
      ${plate(`<div class="aa-row"><span class="aa-muted" style="font-family:var(--head);font-size:11px;letter-spacing:.1em">READ FROM</span><select class="aa-sel" data-a="rdeck">${sources.map((x) => `<option value="${esc(x.id)}"${x.id === src ? " selected" : ""}>${esc(x.name)}</option>`).join("")}</select>
</div>
        <div class="aa-row" style="margin-top:12px">${Object.keys(C.SPREADS).map((k) => `<button class="aa-chip${sp === k ? " on" : ""}" data-a="rspread" data-k="${k}">${esc(C.SPREADS[k].name)} · ${C.SPREADS[k].pos.length}</button>`).join("")}</div>
        <p class="aa-muted" style="margin:10px 0">${SP.pos.map((p2, i) => `${i + 1}. ${esc(p2)}`).join(" · ")}</p>
        <button class="aa-btn" data-a="read">Shuffle and draw</button>${ui.reading ? readingHTML(ui.reading) : ""}`)}`;
  }
  function readingHTML(id) {
    const e = state.journal.find((x) => x.id === id);
    if (!e) return "";
    return `<h3 style="margin-top:18px;color:var(--gold3)">${esc(e.title)}</h3><div class="aa-spreadout" id="aa-read">${e.cards.map((x) => `<div class="aa-pos"><small>${esc(x.pos)}</small>${C.card(x.key) ? cardHTML(cv(x.key), { rev: x.rev, big: true, cls: ui.dealing ? "back" : "", attrs: 'data-a="card"' }) : ""}<span>${C.card(x.key) ? esc(C.card(x.key).name) : ""}${x.rev ? " (reversed)" : ""}</span></div>`).join("")}</div>
      <div class="aa-reading-text">${e.cards.map((x) => { const c = C.card(x.key); if (!c) return ""; const t = x.rev && c.rev ? c.rev : c.up; return `<div><b style="font-family:var(--head)">${esc(x.pos)} -- ${esc(c.name)}${x.rev ? " (reversed)" : ""}</b><div class="aa-meaning">${esc(t || "")}</div></div>`; }).join("")}
        <div><b style="font-family:var(--head)">Your notes</b><textarea class="aa-notes" data-a="note" data-id="${esc(e.id)}" placeholder="What does it say to you?">${esc(e.notes)}</textarea></div></div>`;
  }

  // ---- the journal ----
  function journal(v) {
    const jf = ui.jf || "all", list = v.journal.filter((e) => jf === "all" || (jf === "book" ? e.kind === "keeper" : e.kind !== "keeper")).slice(0, 200);
    const fchip = (f, label) => `<button class="aa-chip${jf === f ? " on" : ""}" data-a="jfilter" data-f="${f}">${label}</button>`;
    return `<div class="aa-hello"><div><h1>${icon("journal", "h1")}Journal</h1><div class="aa-muted">Your daily cards and readings, and the Book of Keepers, newest first.</div></div></div>
      <div class="aa-filters" style="margin-bottom:12px">${fchip("all", "Everything")}${fchip("read", "Cards and readings")}${fchip("book", "The Book of Keepers")}</div>
      <div class="aa-entries">${list.map((e) => plate(`<div class="aa-entry"><div class="cards">${e.cards.filter((x) => C.card(x.key)).map((x) => cardHTML(cv(x.key), { size: "xs", rev: x.rev, attrs: 'data-a="card"' })).join("")}</div>
        <div><div class="aa-row" style="justify-content:space-between"><h3>${esc(e.title)}</h3><span class="aa-muted">${new Date(e.at).toLocaleString()}</span></div>
          ${e.kind === "keeper" ? `<div class="aa-bookpage">${(KEEPER_PAGES[e.camp] || [])[e.station] ? KEEPER_PAGES[e.camp][e.station].split("\n").map((t) => `<p>${esc(t)}</p>`).join("") : ""}</div>`
            : `<div class="aa-muted" style="font-size:15px">${e.cards.map((x) => `${esc(x.pos)}: ${C.card(x.key) ? esc(C.card(x.key).name) : "?"}${x.rev ? " (reversed)" : ""}`).join(" · ")}</div>`}
          <textarea class="aa-notes" data-a="note" data-id="${esc(e.id)}" placeholder="Notes">${esc(e.notes)}</textarea>
          <div class="aa-row" style="justify-content:flex-end;margin-top:6px"><button class="aa-btn ghost sm" data-a="unjournal" data-id="${esc(e.id)}">Delete</button></div></div></div>`)).join("") || '<p class="aa-muted">Nothing yet -- draw today\'s card in Divine.</p>'}</div>`;
  }

  // ---- settings ----
  // ---- accessibility and reading (Cam, 2 Nov: "change colour of pages, sepia, night mode, black background with white text,
  //      text size etc. This will help people who struggle to read the small text ... more accessibility settings") ----
  function applyA11y() {
    const p = (state && state.prefs) || {}, b = document.body;
    b.dataset.read = p.read || "parchment";
    b.style.setProperty("--bk-scale", p.bookText || 1);
    b.style.setProperty("--bk-line", { normal: 1.55, relaxed: 1.8, spacious: 2.05 }[p.lines] || 1.55);
    b.classList.toggle("bk-plain", p.bookFont === "plain");
    b.classList.toggle("hc", !!p.hc); b.classList.toggle("cbsafe", !!p.cb); b.classList.toggle("wide-text", !!p.wide); b.classList.toggle("focus-ring", !!p.focus);
  }
  function a11ySheet() {
    const p = state.prefs, chips = (k, list) => list.map(([v, label]) => `<button class="aa-chip${p[k] === v ? " on" : ""}" data-a="a11ySet" data-k="${k}" data-v="${v}">${label}</button>`).join("");
    const tog = (k, label, sub) => `<label class="aa-a11y-tog"><input type="checkbox" data-a="a11yTog" data-k="${k}" ${p[k] ? "checked" : ""}><span><b>${label}</b><small>${sub}</small></span></label>`;
    sheet(`<h2>Accessibility &amp; reading</h2>
      <div class="aa-a11y">
        <h3 class="aa-subh">Reading (the Library's books and the guides)</h3>
        <div class="aa-a11y-row"><span>Page colour</span><div class="aa-row">${chips("read", [["parchment", "Parchment"], ["sepia", "Sepia"], ["night", "Night"], ["contrast", "High contrast"]])}</div></div>
        <div class="aa-a11y-row"><span>Reading text size</span><div class="aa-row">${chips("bookText", [[0.9, "Smaller"], [1, "Normal"], [1.15, "Large"], [1.3, "Larger"], [1.5, "Largest"]])}</div></div>
        <div class="aa-a11y-row"><span>Line spacing</span><div class="aa-row">${chips("lines", [["normal", "Normal"], ["relaxed", "Relaxed"], ["spacious", "Spacious"]])}</div></div>
        <div class="aa-a11y-row"><span>Book font</span><div class="aa-row">${chips("bookFont", [["serif", "Book serif"], ["plain", "Plain, easy-read"]])}</div></div>
        <div class="aa-a11y-sample aa-bk-page">“A picture is a question your mind can't help answering.” <small>-- a sample of the book text</small></div>
        <h3 class="aa-subh">The whole game</h3>
        <div class="aa-a11y-row"><span>Text size</span><div class="aa-row">${chips("text", [[1, "Normal"], [1.12, "Large"], [1.25, "Larger"], [1.4, "Very large"], [1.6, "Huge"]])}</div></div>
        ${tog("hc", "High contrast", "brighter text and stronger edges everywhere")}
        ${tog("cb", "Colour-blind friendly", "hunts in blue and fears in orange, instead of green and red")}
        ${tog("wide", "Wider letter spacing", "letters and words a little further apart -- many readers with dyslexia find it easier")}
        ${tog("focus", "Clear keyboard focus", "a bright outline round whatever the keyboard is on")}
        <label class="aa-a11y-tog"><input type="checkbox" data-a="pref" data-k="motion" ${p.motion ? "checked" : ""}><span><b>Animations</b><small>turn off for less movement on screen</small></span></label>
        <p class="aa-muted" style="margin-top:8px">The turn timer (Settings) can be set to no limit, too.</p>
      </div>
      <div class="aa-row" style="justify-content:center;margin-top:12px"><button class="aa-btn ghost" data-a="settings">Back to Settings</button></div>`, "wide");
  }
  function settings() {
    const p = state.prefs;
    sheet(`<h2>Settings</h2><div class="aa-stack" style="gap:12px;text-align:left;margin-top:12px">
      <label class="aa-row"><input type="checkbox" data-a="pref" data-k="music" ${p.music ? "checked" : ""}> Background music</label>
      <label class="aa-row">Volume <input type="range" min="0" max="1" step="0.05" value="${p.vol}" data-a="vol"></label>
      <label class="aa-row"><input type="checkbox" data-a="pref" data-k="sfx" ${p.sfx ? "checked" : ""}> Sound effects</label>
      <label class="aa-row">Time for each turn <select class="aa-sel" data-a="timer">${[[15, "15 seconds"], [20, "20 seconds"], [30, "30 seconds"], [45, "45 seconds"], [60, "a minute"], [0, "no limit"]].map(([n, l]) => `<option value="${n}"${p.timer === n ? " selected" : ""}>${l}</option>`).join("")}</select></label>
      <button class="aa-btn ghost sm" data-a="a11y">Accessibility &amp; reading…</button>
      <details class="aa-keys"><summary>Keys in battle</summary><p><b>1-4</b> or <b>← →</b> choose a card · <b>↑ ↓</b> celestials · <b>R</b> reversed · <b>F</b> Fury · <b>M</b> mulligan · <b>Enter</b> or <b>Space</b> reveal · <b>Esc</b> closes a window</p></details>
      <button class="aa-btn ghost sm" data-a="musicFolder">Open the music folder</button><small class="aa-muted">Drop songs (mp3, ogg, flac...) in it, then turn the music off and on.</small>
      ${state.made ? '<button class="aa-chip" data-a="forgetSheet">Forget the Library and the Archive…</button>' : ""}
      ${state.made ? '<button class="aa-btn ghost sm" data-a="guidebook">The Guidebook (every tutorial chapter)</button><button class="aa-chip" data-a="newGame">Begin a new collection…</button>' + (state.diff === "free" ? '<button class="aa-chip" data-a="sandboxSheet">Testing tools…</button>' : '<small class="aa-muted">Testing tools live in Free (sandbox) saves -- make one from Saves (your picture, top right).</small>') : ""}</div>`, true);
  }
  /** A new save begins, at the difficulty chosen on the start screen (or when the save was made). */
  async function beginSave(skip) {
    const P = activeProfile(), diff = firstOpen(ui.startDiff || P.diff || "normal");
    const r = act("start", { seed: (Math.random() * 2 ** 31) | 0, skipTutorial: skip || diff === "free", diff, name: P.name, face: P.face });
    if (!r.ok) return;
    const x = await Store.call("profile_edit", [profiles.active, { diff, setDiff: true }]).catch(() => null);
    if (x && !x.error) profiles = x;
    go(skip || diff === "free" ? "store" : "home");
  }
  // the layers (Q12): Easy the cards, Normal the decks, Hard the lore -- each opens the next by beating The World
  const DIFF_TEXT = { free: "everything open and every feature on, the testing tools, no achievements (the sandbox)",
    easy: "The cards: Power, celestials, abilities, Fury, combos of a suit. 4 mulligans, more Moonstones",
    normal: "The decks: adds Deck Harmony, Full Spreads, fields, Seals and the Underdog. 2 mulligans, more card XP",
    hard: "The lore: adds signature cards, leans, hunts and fears, the keepers' own spreads. 1 mulligan, 0.8x Moonstones, much more card XP" };
  const DIFF_LOCK = { normal: "Beat The World on Easy to open", hard: "Beat The World on Normal to open" };
  const diffOpen = () => C.diffsOpen(diaryRec);
  /** The layer a friendly duel is played at (Cam, 2 Nov): any you've opened; Free saves pick too. */
  const duelTiers = () => { const o = diffOpen(); return ["easy", "normal", "hard"].filter((d) => o[d] || state.diff === "free"); };
  const duelTierPick = (act0) => { const cur = ui.duelTier || (state.diff === "free" ? "hard" : state.diff);
    return `<div class="aa-row aa-duelTier" style="justify-content:center;gap:6px"><span class="aa-muted">Play it at</span>${duelTiers().map((d) => `<button class="aa-chip${cur === d ? " on" : ""}" data-a="${act0}" data-d="${d}" title="${esc(DIFF_TEXT[d])}">${DIFF_NAME[d]}</button>`).join("")}</div>`; };
  const duelTier = () => { const t = ui.duelTier || (state.diff === "free" ? "hard" : state.diff); return duelTiers().includes(t) ? t : "easy"; };
  const firstOpen = (cur) => { const o = diffOpen(); return o[cur] ? cur : o.normal ? "normal" : "easy"; };
  const diffPicker = (cur, act0) => { const o = diffOpen(); cur = firstOpen(cur);
    return `<div class="aa-diffs">${["free", "easy", "normal", "hard"].map((d) => `<button class="aa-diff d-${d}${cur === d ? " on" : ""}${o[d] ? "" : " locked"}" ${o[d] ? `data-a="${act0}" data-d="${d}"` : "disabled"}><b>${o[d] ? "" : "🔒 "}${DIFF_NAME[d]}</b><small>${esc(o[d] ? DIFF_TEXT[d] : DIFF_LOCK[d] + " -- " + DIFF_TEXT[d])}</small></button>`).join("")}</div>`; };
  // ---- the achievement diary (Cam, PT61): every achievement, at Easy, Normal and Hard, across all your saves ----
  let diaryRec = { easy: {}, normal: {}, hard: {} };
  async function loadDiary() { try { const x = await Store.call("ach_get", []); if (x && x.easy) diaryRec = x; } catch (e) { /* none */ } }
  function diary(v) {
    const groups = [];
    C.ACH.forEach((a) => { if (!groups.includes(a.group)) groups.push(a.group); });
    const count = (d) => Object.keys(diaryRec[d] || {}).length, total = C.ACH.length;
    const medal = (a, d) => { const r = diaryRec[d] && diaryRec[d][a.id]; return r ? `<button class="aa-medal on" data-a="badgePick" data-id="${a.id}" data-d="${d}" title="${TIER[d]}: earned ${esc(new Date(r.at).toLocaleDateString())}${r.by ? " by " + esc(r.by) : ""} -- click to make it your picture">${badge(a.id, d, "sm")}</button>`
      : `<span class="aa-medal" title="${TIER[d]}: not yet">${badge(a.id, d, "sm off")}</span>`; };
    return `<div class="aa-hello"><div><div class="aa-muted">Click a badge you've earned to wear it.</div></div>
        <div class="aa-diarytally">${["easy", "normal", "hard"].map((d) => `<span class="t-${d}">${TIER[d]} <b>${count(d)}</b>/${total}</span>`).join("")}</div></div>
      ${v.diff === "free" ? '<p class="aa-sealed">This is a Free (sandbox) save: nothing here is earned. Switch to an Easy, Normal or Hard save to add to the diary.</p>' : ""}
      ${groups.map((g) => `<div class="aa-rule">${esc(g)}</div><div class="aa-diary">${C.ACH.filter((a) => a.group === g).map((a) => `<div class="aa-diaryrow"><div class="medals">${["easy", "normal", "hard"].map((d) => medal(a, d)).join("")}</div>
        <div><b>${esc(a.name)}</b>${a.text ? `<small class="aa-muted">${esc(a.text)}</small>` : ""}</div></div>`).join("")}</div>`).join("")}`;
  }
  /** A save opened: anything it has already done (before achievements existed, say) is earned now. */
  function catchUpAchievements() {
    if (!state.made || state.diff === "free") return;
    const got = C.achieve(state, now());
    if (got.length) { persist(); toast("✦ " + got.length + " achievement" + (got.length === 1 ? "" : "s") + " earned (" + TIER[state.diff] + ") -- see the Diary"); }
  }
  // ---- the profile (Cam, 1 Nov: "the achievements and stats page on the profile page, denoted by the player's avatar in
  // the side bar at the bottom"): who you are, your numbers, your decks, your achievements ----
  function profile(v) {
    if (!v.made) return home(v);
    const tab = screen === "diary" ? "ach" : ui.ptab || "stats", P = activeProfile();
    const head = `<div class="aa-profhead">${withLv(cardFace(v.face || P.face, "big"), v.plv, "big")}<div><h1>${esc(v.name || P.name || "Seeker")}</h1>
        <div class="aa-plvbar"><b>Level ${v.plv}</b>${v.pneed ? `<span class="bar"><i style="width:${Math.round(100 * v.pxp / v.pneed)}%"></i></span><small class="aa-muted">${v.pxp} / ${v.pneed} XP -- each level brings Moonstones and a card</small>` : '<small class="aa-muted">the highest level</small>'}</div>
        <div class="aa-row"><span class="aa-difftag d-${v.diff}">${DIFF_NAME[v.diff]}</span>${v.ngp ? `<span class="aa-difftag d-ngp">New Game+ ${ROMAN_N[v.ngp]}</span><span class="aa-muted">Legacy: ${v.legacy.map((b) => esc((C.LEGACY.find((x) => x.id === b) || {}).name || b)).join(", ")}</span>` : ""}${v.diff === "free" ? '<span class="aa-muted">a sandbox save -- nothing here counts for achievements</span>' : ""}</div>
        <div class="aa-row" style="margin-top:8px"><button class="aa-btn ghost sm" data-a="faceDraw">Draw a new picture</button><button class="aa-btn ghost sm" data-a="ptab" data-t="ach">Wear a badge…</button><button class="aa-btn ghost sm" data-a="saves">Saves…</button></div></div></div>
      <div class="aa-tabs"><button class="aa-tab${tab === "stats" ? " on" : ""}" data-a="ptab" data-t="stats">Stats</button><button class="aa-tab${tab === "ach" ? " on" : ""}" data-a="ptab" data-t="ach">Achievements</button></div>`;
    return head + (tab === "ach" ? diary(v) : statsHTML(v));
  }
  /** The multiplayer record (Cam, 1 Nov): duels nearby -- won, lost, knockouts, winnings, each opponent -- and trades. */
  function multiplayerHTML(tile, pct) {
    const S = state.stats, L = (S.byMode || {}).lan || { w: 0, l: 0, d: 0 }, D = (S.byMode || {}).duel || { w: 0, l: 0, d: 0 };
    const PV = S.pvp || { peers: {}, ko: 0, koed: 0, gold: 0 }, all = L.w + L.l + L.d, TW = S.tradeWith || {};
    const names = Object.keys(Object.assign({}, PV.peers, TW)).sort((a, b) => ((PV.peers[b] || {}).at || 0) - ((PV.peers[a] || {}).at || 0) || a.localeCompare(b));
    const day = (t) => (t ? new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "--");
    return plate(`<div class="aa-h"><h2>Multiplayer</h2><small>duels nearby and trades with other players</small></div><div class="aa-stats">
        ${tile("Duels nearby", num(all), all ? pct(L.w, all) + " won" : "none yet")}${tile("Won", num(L.w))}${tile("Lost", num(L.l))}${tile("Drawn", num(L.d))}
        ${tile("Knockouts", num(PV.ko || 0), "knocked out " + num(PV.koed || 0))}${tile("Moonstones won", num(PV.gold || 0), "20 a win")}
        ${tile("Trades", num(S.traded || 0), "cards in " + num(S.tradeGot || 0) + " · out " + num(S.tradeGave || 0))}${tile("Duels on one computer", num(D.w + D.l + D.d), "player 1 won " + num(D.w))}</div>
      ${names.length ? `<table class="aa-modes-t"><tr><th>Against</th><th>Won</th><th>Lost</th><th>Drawn</th><th>Rate</th><th>Trades</th><th>Last duel</th></tr>${names.map((n) => { const x = PV.peers[n] || { w: 0, l: 0, d: 0, at: 0 }, a = x.w + x.l + x.d; return `<tr><td>${esc(n)}</td><td>${x.w}</td><td>${x.l}</td><td>${x.d}</td><td>${pct(x.w, a)}</td><td>${TW[n] || 0}</td><td>${day(x.at)}</td></tr>`; }).join("")}</table>` : all || S.traded ? '<p class="aa-muted">Each opponent gets a line here from your next duel or trade.</p>' : '<p class="aa-muted">Play Nearby (Battle page) to duel and trade with someone on your home network.</p>'}`);
  }
  function statsHTML(v) {
    const S = state.stats, pct = (w, n) => (n ? Math.round(100 * w / n) + "%" : "--");
    const tile = (label, val, sub) => `<div class="aa-stat"><b>${val}</b><span>${esc(label)}</span>${sub ? `<small>${sub}</small>` : ""}</div>`;
    const played = S.played || {}, wins = S.cardWins || {};
    const top = (obj, n, f) => Object.keys(obj).filter((k) => C.card(k) && (!f || f(k))).sort((a, b) => obj[b] - obj[a]).slice(0, n);
    const rate = top(played, 5, (k) => played[k] >= 5).sort((a, b) => (wins[b] || 0) / played[b] - (wins[a] || 0) / played[a]);
    const cardRow = (keys, fmt) => keys.length ? `<div class="aa-favs">${keys.map((k) => `<div class="aa-fav">${cardHTML(cv(k), { size: "xs", attrs: 'data-a="card"' })}<small>${fmt(k)}</small></div>`).join("")}</div>` : '<p class="aa-muted">Not yet -- play some battles.</p>';
    const MODES = [["journey", "The roads"], ["skirmish", "Skirmish"], ["gauntlet", "Gauntlet"], ["trial", "Daily Trial"], ["keeps", "Play for Keeps"]];   // (duels: the Multiplayer plate)
    const bm = S.byMode || {};
    // decks: the eight in any order; saved decks by name
    const sigOf = (keys) => keys.slice().sort().join("|"), D = S.decks || {};
    const named = {}; v.decksSaved.forEach((d) => { named[sigOf(d.keys)] = d.name; });
    const deckRows = Object.keys(D).sort((a, b) => D[b].n - D[a].n);
    const mostUsed = deckRows[0], mostWon = Object.keys(D).filter((k) => D[k].n >= 3).sort((a, b) => D[b].w / D[b].n - D[a].w / D[a].n || D[b].w - D[a].w)[0];
    const deckName = (sig) => named[sig] || (sig === sigOf(state.spread) ? "Your current spread" : "An unsaved spread");
    const deckThumbs = (sig) => `<div class="aa-favs mini">${sig.split("|").filter((k) => C.card(k)).map((k) => cardHTML(cv(k), { size: "xs", attrs: 'data-a="card"' })).join("")}</div>`;
    const cur = D[sigOf(state.spread)] || { n: 0, w: 0 };
    const owned = v.owned, maxed = Object.keys(state.cards).filter((k) => C.card(k) && state.cards[k].n > 0 && state.cards[k].lv >= C.maxLv(k)).length, gilded = Object.keys(state.cards).filter((k) => state.cards[k].g && state.cards[k].n > 0).length;
    const fool = v.camps.find((c) => c.id === "fool"), orc = v.camps.find((c) => c.id === "oracle");
    return `${plate(`<div class="aa-h"><h2>The record</h2></div><div class="aa-stats">
        ${tile("Battles", num(S.battles))}${tile("Wins", num(S.wins), pct(S.wins, S.battles) + " of battles")}${tile("Losses", num(S.losses))}${tile("Draws", num(S.draws))}
        ${tile("Win streak", num(v.streak), "best " + num(S.bestStreak || 0))}${tile("Moonstones won", num(S.moonWon || 0), "lost " + num(S.moonLost || 0))}
        ${tile("The Fool's Journey", (fool.best || 0) + "/21", fool.ascBest ? "Ascension " + (ROMAN_N[fool.ascBest] || fool.ascBest) + " open" : "")}${tile("The Veiled Pilgrimage", orc.open ? (orc.best || 0) + "/13" : "sealed")}</div>
      <table class="aa-modes-t"><tr><th></th><th>Won</th><th>Lost</th><th>Drawn</th><th>Rate</th></tr>${MODES.map(([m, n]) => { const x = bm[m] || { w: 0, l: 0, d: 0 }, all = x.w + x.l + x.d; return `<tr><td>${n}</td><td>${x.w}</td><td>${x.l}</td><td>${x.d}</td><td>${pct(x.w, all)}</td></tr>`; }).join("")}</table>`)}
      ${multiplayerHTML(tile, pct)}
      ${plate(`<div class="aa-h"><h2>Favourite cards</h2><small>from the rounds they fought</small></div>
        <h3 class="aa-subh">Played most</h3>${cardRow(top(played, 6), (k) => played[k] + (played[k] === 1 ? " round" : " rounds"))}
        <h3 class="aa-subh">Won most</h3>${cardRow(top(wins, 6), (k) => wins[k] + (wins[k] === 1 ? " win" : " wins"))}
        <h3 class="aa-subh">Best record <small class="aa-muted">(5 rounds or more)</small></h3>${cardRow(rate, (k) => pct(wins[k] || 0, played[k]))}`)}
      ${plate(`<div class="aa-h"><h2>Spreads</h2><small>the eight you took into battle, in any order</small></div>
        <div class="aa-deckstat"><div><h3 class="aa-subh">Your current spread</h3>${deckThumbs(sigOf(state.spread))}<small class="aa-muted">${cur.n} battles · ${cur.w} wins · ${pct(cur.w, cur.n)}</small></div>
          ${mostUsed ? `<div><h3 class="aa-subh">Used most -- ${esc(deckName(mostUsed))}</h3>${deckThumbs(mostUsed)}<small class="aa-muted">${D[mostUsed].n} battles · ${pct(D[mostUsed].w, D[mostUsed].n)} won</small></div>` : ""}
          ${mostWon ? `<div><h3 class="aa-subh">Wins most -- ${esc(deckName(mostWon))}</h3>${deckThumbs(mostWon)}<small class="aa-muted">${D[mostWon].w} of ${D[mostWon].n} won (${pct(D[mostWon].w, D[mostWon].n)})</small></div>` : ""}</div>
        <h3 class="aa-subh">Saved spreads</h3>${v.decksSaved.length ? `<table class="aa-modes-t"><tr><th>Spread</th><th>Battles</th><th>Won</th><th>Rate</th><th></th></tr>${v.decksSaved.map((d) => { const x = D[sigOf(d.keys)] || { n: 0, w: 0 }; return `<tr><td>${esc(d.name)}${d.current ? " <small class=\"aa-muted\">(playing)</small>" : ""}</td><td>${x.n}</td><td>${x.w}</td><td>${pct(x.w, x.n)}</td><td>${d.ok && !d.current ? `<button class="aa-chip" data-a="deckUse" data-id="${esc(d.id)}">Play it</button>` : ""}</td></tr>`; }).join("")}</table>` : '<p class="aa-muted">No saved spreads -- save one on the Cards page.</p>'}`)}
      ${plate(`<div class="aa-h"><h2>The collection</h2></div><div class="aa-stats">
        ${tile("Cards owned", num(owned), "of " + num(v.total))}${tile("Decks complete", v.decks.filter((d) => d.done).length, "of " + v.decks.length)}${tile("Maxed cards", maxed)}${tile("Gilded cards", gilded)}
        ${tile("Combo Book", Object.keys(state.combos).length + "/" + v.book.length, "pages")}${tile("Book of Keepers", state.journal.filter((e) => e.kind === "keeper").length, "pages")}
        ${tile("Seals", Object.values(v.seals || {}).reduce((a, b) => a + b, 0), (S.sealsSprung || 0) + " sprung")}${tile("Readings", state.journal.filter((e) => e.kind === "reading").length, (v.omenRun && v.omenRun.n || 0) + " days of omens running")}</div>`)}`;
  }
  // ---- play nearby: the home network (Cam, 1 Nov: "my PC and my partner's are hooked into the same router -- can we set up
  // LAN for trading cards and fighting?"). One hosts, the other joins (shell/lan.js; neuroarcana.py in NeuroNet). Messages:
  // invite / accept / decline {what: trade|duel, spread?}; trade: offer / lock / unlock / confirm / cancel; duel: battle
  // (host -> guest, the whole battle), move (guest -> host), round (host -> guest: the story and the battle), end ----
  const lan = { hosting: false, role: null, peer: null, since: 0, polling: false, addrs: [], port: 47432, found: null, trade: null, theirMove: null, invite: null };
  const meInfo = () => ({ name: state.name || activeProfile().name || "Seeker", face: state.face || activeProfile().face || null, diff: state.diff || "normal" });
  const spreadInfo = () => ({ name: meInfo().name, face: meInfo().face, plv: state.plv, keys: state.spread.slice(), levels: state.spread.map((k) => (state.cards[k] ? state.cards[k].lv : 1)) });
  async function lanSend(msg) { const r = await Store.call("lan_send", [msg]).catch(() => ({ error: "no shell" })); if (r && r.error) toast(r.error, true); return r; }
  function lanPoll() {
    if (lan.polling) return;
    lan.polling = true;
    const tick = async () => {
      if (!lan.hosting && !lan.role) { lan.polling = false; return; }
      const r = await Store.call("lan_inbox", [lan.since]).catch(() => null);
      if (r && Array.isArray(r.msgs)) r.msgs.forEach((m) => { lan.since = Math.max(lan.since, m.seq); lanGot(m.msg); });
      setTimeout(tick, 700);
    };
    tick();
  }
  function lanGot(m) {
    if (m.type === "joined") { lan.peer = m.peer; lanSend({ kind: "me", plv: state.plv }); lan.role = lan.hosting ? "host" : "guest"; sfx("coin"); toast("⇄ Playing with " + m.peer.name + " on the home network"); if (screen === "nearby") repaint(); return; }
    if (m.type === "left" || (m.type === "msg" && m.msg && m.msg.type === "bye")) { const who = (lan.peer && lan.peer.name) || "They"; lan.peer = null; if (!lan.hosting) lan.role = null; else lan.role = "host";
      lanDropBattle(who + " left."); lan.trade = null; closeSheet(); if (screen === "nearby") repaint(); return; }
    if (m.type !== "msg" || !m.msg) return;
    const x = m.msg, name = (lan.peer && lan.peer.name) || "They";
    if (x.kind === "invite") {
      lan.invite = x;
      if (x.what === "trade" && tradeBlocked()) { lanSend({ kind: "decline", what: "trade", why: "free" }); return; }
      sheet(`<h2>${esc(name)} ${x.what === "trade" ? "wants to trade cards" : "challenges you to a duel" + (DIFF_NAME[x.tier] ? " at " + DIFF_NAME[x.tier] : "")}</h2><p class="aa-muted">${x.what === "trade" ? "You each put cards on the table; nothing changes hands until you both confirm." : "A friendly duel across the home network -- nothing is won or lost."}</p>
        <div class="aa-row" style="justify-content:center"><button class="aa-btn" data-a="lanAccept">Accept</button><button class="aa-btn ghost" data-a="lanDecline">Not now</button></div>`, true);
      sfx("rare"); return;
    }
    if (x.kind === "decline") { toast(name + (x.why === "free" ? " can't trade between a Free save and a normal one." : " said not now."), true); return; }
    if (x.kind === "accept") { if (x.what === "trade") tradeOpen(); else if (lan.role === "host") lanStartDuel(x.spread, x.tier); return; }
    // trading
    if (lan.trade && (x.kind === "offer" || x.kind === "lock")) lan.trade.theirsLv = Array.isArray(x.lv) ? x.lv : [];
    if (lan.trade && (x.kind === "offer" || x.kind === "lock")) intelSee(x.keys || []);
    if (lan.trade && x.kind === "offer") { lan.trade.theirs = x.keys || []; lan.trade.lockTheirs = false; lan.trade.confirmMine = lan.trade.confirmTheirs = false; tradeSheet(); return; }
    if (lan.trade && x.kind === "lock") { lan.trade.theirs = x.keys || []; lan.trade.lockTheirs = true; tradeSheet(); return; }
    if (lan.trade && x.kind === "unlock") { lan.trade.lockTheirs = false; lan.trade.confirmMine = lan.trade.confirmTheirs = false; tradeSheet(); return; }
    if (lan.trade && x.kind === "confirm") { lan.trade.confirmTheirs = true; tradeMaybeDone(); return; }
    if (x.kind === "tradeCancel") { if (lan.trade) { lan.trade = null; closeSheet(); toast(name + " closed the trade."); } return; }
    // duels
    if (x.kind === "battle" && lan.role === "guest") { state.battle = x.B; ui = { intro: true, found: [] }; closeSheet(); sfx("clash"); go("battle", true); return; }
    if (x.kind === "move" && lan.role === "host") { lan.theirMove = x.ch; lanTryRound(); return; }
    if (x.kind === "round" && lan.role === "guest") { state.battle = x.B; playStory(x.story, x.B, x.story.ch[1].card).then(() => { if (state.battle && state.battle.mode === "lan" && state.battle.over) act("lanEnd"); }); return; }
    // seeing each other's collections: ask, and the other game answers with its album
    if (x.kind === "me") { if (lan.peer) lan.peer.plv = x.plv | 0; if (screen === "nearby") repaint(); return; }
    if (x.kind === "peek") { lanSend({ kind: "album", album: albumOf() }); return; }
    if (x.kind === "album" && x.album && typeof x.album === "object") { lan.album = x.album; albumSheet(); return; }
    if (x.kind === "end") { lanDropBattle(name + " left the duel."); return; }
  }
  function lanDropBattle(msg) {
    if (!state.battle || state.battle.mode !== "lan") return;
    state.battle = null; persist();                         // (friendly: nothing is won or lost, so it simply ends) ui = {}; toast(msg, true); go("nearby");
  }
  function lanStartDuel(p2, tier) {
    if (!p2 || !Array.isArray(p2.keys) || p2.keys.length !== C.DECK) return toast("Their spread didn't arrive whole.", true);
    if (state.battle && !state.battle.over) return toast("Finish your own battle first.", true);
    lan.theirMove = null;
    const r = act("battle", { mode: "lan", p2, tier: ["easy", "normal", "hard"].includes(tier) ? tier : duelTier() });
    if (!r.ok) return;
    lanSend({ kind: "battle", B: state.battle });
    closeSheet(); ui = { intro: true, found: [] }; sfx("clash"); go("battle", true);
  }
  async function lanTryRound() {
    const B = state.battle;
    if (!B || B.mode !== "lan" || !ui.lanMine || !lan.theirMove || busy) return;
    const ci = ui.lanMine.card, r = act("duelMove", { a: ui.lanMine, b: lan.theirMove });
    ui.lanMine = null; lan.theirMove = null;
    if (!r.ok) { ui.lanWaiting = false; repaint(); return; }
    const story = r.events.find((e) => e.kind === "round").story;
    lanSend({ kind: "round", story, B: state.battle });
    await playStory(story, state.battle, ci);
  }
  // a trade: both lay cards down; locking freezes your offer; when both are locked, both confirm; then it happens on both
  const tradeBlocked = () => lan.peer && (lan.peer.diff === "free") !== (state.diff === "free");
  function tradeOpen() { lan.trade = { mine: [], theirs: [], lockMine: false, lockTheirs: false, confirmMine: false, confirmTheirs: false, done: false }; tradeSheet(); }
  const offerMsg = (kind) => ({ kind, keys: lan.trade.mine.slice(), lv: lan.trade.mine.map((k) => (state.cards[k] ? state.cards[k].lv : 1)) });
  /** A card shown at someone else's level (their pow and harm, not yours). */
  const cvAt = (k, lv) => C.cardView({ cards: { [k]: { n: 1, lv: lv || 1, xp: 0 } } }, k);
  /** One card in the trade or the album, big enough to tell apart: the card, then its name, deck, rarity and a line. */
  function tTile(k, view, line, o) {
    o = o || {};
    const c = C.card(k);
    if (!c) return `<div class="aa-ttile unknown"><div class="aa-tq">?</div><div class="aa-tcap"><b>A card this game doesn't have</b><small>${esc(k)}</small></div></div>`;
    return `<div class="aa-ttile${o.cls ? " " + o.cls : ""}" ${o.attrs || ""} data-name="${esc((c.name + " " + c.deckName).toLowerCase())}" data-deck="${esc(c.deck)}" data-rar="${c.rarity}" data-only="${o.only ? 1 : 0}" title="${esc(o.title || "")}">
      ${cardHTML(view, { size: "sm" })}${o.n > 1 ? `<b class="aa-tn">×${o.n}</b>` : ""}<div class="aa-tcap"><b>${esc(c.name)}</b><small>${esc(c.deckName)}</small><small class="aa-rar r-${c.rarity}">${esc(C.RARITY[c.rarity].name)}</small>${line ? `<small>${line}</small>` : ""}</div></div>`;
  }
  /** Search, deck, rarity and one tick-box over a box of tiles (onlyLabel: what the tick-box keeps). */
  function tFilters(keys, onlyLabel) {
    const decks = {}; keys.forEach((k) => { const c = C.card(k); if (c) decks[c.deck] = c.deckName; });
    return `<div class="aa-tfilters"><input class="aa-sel aa-tf-q" type="search" placeholder="Search a name or deck…">
      <select class="aa-sel aa-tf-deck"><option value="">Every deck</option>${Object.keys(decks).sort((a, b) => decks[a].localeCompare(decks[b])).map((d) => `<option value="${esc(d)}">${esc(decks[d])}</option>`).join("")}</select>
      <select class="aa-sel aa-tf-rar"><option value="">Every rarity</option>${Object.keys(C.RARITY).map((r) => `<option value="${r}">${esc(C.RARITY[r].name)}</option>`).join("")}</select>
      <label class="aa-check"><input type="checkbox" class="aa-tf-only"> ${esc(onlyLabel)}</label><span class="aa-muted aa-tf-n"></span></div>`;
  }
  function tileFilter(box) {
    if (!box) return;
    const g = (c) => box.querySelector(c), q = (g(".aa-tf-q") || {}).value || "", deck = (g(".aa-tf-deck") || {}).value || "", rar = (g(".aa-tf-rar") || {}).value || "", only = !!(g(".aa-tf-only") || {}).checked;
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    let shown = 0;
    box.querySelectorAll(".aa-tgrid .aa-ttile").forEach((t) => {
      const ok = (!deck || t.dataset.deck === deck) && (!rar || t.dataset.rar === rar) && (!only || t.dataset.only === "1") && words.every((w) => t.dataset.name.includes(w));
      t.hidden = !ok; if (ok) shown++;
    });
    const n = g(".aa-tf-n"); if (n) n.textContent = shown + " shown";
  }
  function tradeSheet() {
    const T = lan.trade;
    if (!T) return;
    const name = (lan.peer && lan.peer.name) || "They", count = {};
    T.mine.forEach((k) => { count[k] = (count[k] || 0) + 1; });
    const mineKeys = Object.keys(state.cards).filter((k) => C.card(k) && state.cards[k].n > (count[k] || 0))
      .sort((a, b) => C.card(a).deckName.localeCompare(C.card(b).deckName) || C.RARITY[C.card(b).rarity].tier - C.RARITY[C.card(a).rarity].tier || C.card(a).name.localeCompare(C.card(b).name));
    const left = (k) => state.cards[k].n - (count[k] || 0);
    const giveTiles = T.mine.map((k, i) => tTile(k, cv(k), `Lv${state.cards[k].lv} · ${state.cards[k].n - count[k] ? "you keep " + (state.cards[k].n - count[k]) : '<span class="aa-bad">your last copy</span>'}`, T.lockMine ? {} : { attrs: `data-a="tradeDrop" data-i="${i}"`, title: "Take it back", cls: "click" })).join("");
    const getTiles = T.theirs.map((k, i) => {
      if (!C.card(k)) return tTile(k);
      const h = state.cards[k], lv = (T.theirsLv || [])[i] || 1;
      const line = h && h.n > 0 ? `theirs Lv${lv} · you have ${h.n} (Lv${h.lv})` : `<span class="aa-newtxt">New to you</span> · arrives Lv${h ? h.lv : 1}`;
      return tTile(k, cvAt(k, lv), line);
    }).join("");
    const status = T.done ? "Done!" : T.lockMine && T.lockTheirs ? (T.confirmMine ? `Waiting for ${esc(name)} to confirm…` : "Both offers are locked -- check them, then confirm.") : T.lockMine ? `Your offer is locked. Waiting for ${esc(name)}…` : T.lockTheirs ? `${esc(name)} has locked their offer.` : "Click your cards below to offer them (one copy each click), then lock your offer.";
    sheet(`<div id="aa-trade-sheet"><h2>Trading with ${esc(name)}</h2><p class="aa-muted">${status}</p>
      <div class="aa-trade"><div class="aa-tside${T.lockMine ? " locked" : ""}"><h3 class="aa-subh">You give <small class="aa-muted">${T.mine.length}/12${T.lockMine ? " · locked" : ""}</small></h3>${giveTiles ? `<div class="aa-trow">${giveTiles}</div>` : '<p class="aa-muted">Nothing yet.</p>'}</div>
        <div class="aa-tside${T.lockTheirs ? " locked" : ""}"><h3 class="aa-subh">${esc(name)} gives <small class="aa-muted">${T.theirs.length}/12${T.lockTheirs ? " · locked" : ""}</small></h3>${getTiles ? `<div class="aa-trow">${getTiles}</div>` : '<p class="aa-muted">Nothing yet.</p>'}</div></div>
      <div class="aa-row" style="justify-content:center;margin:12px 0">${T.lockMine ? '<button class="aa-btn ghost" data-a="tradeUnlock">Change my offer</button>' : `<button class="aa-btn" data-a="tradeLock">Lock my offer</button>`}
        <button class="aa-btn" data-a="tradeConfirm" ${T.lockMine && T.lockTheirs && !T.confirmMine ? "" : "disabled"}>Confirm the trade</button><button class="aa-btn ghost" data-a="lanPeek">See ${esc(name)}'s collection</button><button class="aa-btn ghost" data-a="tradeCancel">Call it off</button></div>
      ${T.lockMine ? "" : `<div class="aa-tbox"><h3 class="aa-subh">Your cards</h3>${tFilters(mineKeys, "Spares only (2 or more)")}
        <div class="aa-tgrid">${mineKeys.map((k) => tTile(k, cv(k), `Lv${state.cards[k].lv}${state.spread.includes(k) ? " · in your spread" : ""}`, { attrs: `data-a="tradeAdd" data-k="${esc(k)}"`, cls: "click", n: left(k), only: left(k) > 1, title: "Offer one copy" })).join("")}</div></div>`}</div>`);
    tileFilter(document.querySelector("#aa-trade-sheet .aa-tbox"));
  }
  /** What the other player may see of this save: the collection and the record (Cam, 1 Nov: "view the other player's
   *  card collection and stats"). Never the Moonstones. */
  function albumOf() {
    const v = V(), S = state.stats || {}, cards = {}, played = S.played || {};
    Object.keys(state.cards).forEach((k) => { const h = state.cards[k]; if (h.n > 0 && C.card(k)) cards[k] = [h.n, h.lv, h.g ? 1 : 0]; });
    const camp = (id) => v.camps.find((c) => c.id === id) || {};
    return { name: meInfo().name, face: meInfo().face, plv: state.plv, diff: v.diff, ngp: v.ngp || 0, cards, spread: state.spread.slice(),
      fav: Object.keys(played).filter((k) => C.card(k)).sort((a, b) => played[b] - played[a]).slice(0, 4),
      stats: { battles: S.battles || 0, wins: S.wins || 0, losses: S.losses || 0, draws: S.draws || 0, streak: v.streak || 0, best: S.bestStreak || 0, lan: (S.byMode || {}).lan || { w: 0, l: 0, d: 0 },
        owned: v.owned, total: v.total, decksDone: v.decks.filter((d) => d.done).length, decks: v.decks.length, fool: camp("fool").best || 0, oracle: camp("oracle").open ? camp("oracle").best || 0 : null, traded: S.traded || 0 } };
  }
  function albumSheet() {
    const X = lan.album;
    if (!X) return;
    const S = X.stats || {}, L = S.lan || { w: 0, l: 0, d: 0 }, cards = X.cards && typeof X.cards === "object" ? X.cards : {};
    const tile = (label, val, sub) => `<div class="aa-stat"><b>${val}</b><span>${esc(label)}</span>${sub ? `<small>${sub}</small>` : ""}</div>`;
    const pct = (w, n) => (n ? Math.round(100 * w / n) + "%" : "--");
    const lvOf = (k) => (cards[k] ? cards[k][1] : 1);
    const mineLine = (k) => { const h = state.cards[k]; return h && h.n > 0 ? `you have ${h.n} (Lv${h.lv})` : '<span class="aa-newtxt">You don\'t have it</span>'; };
    const keys = Object.keys(cards).filter((k) => C.card(k)).sort((a, b) => C.card(a).deckName.localeCompare(C.card(b).deckName) || C.RARITY[C.card(b).rarity].tier - C.RARITY[C.card(a).rarity].tier || C.card(a).name.localeCompare(C.card(b).name));
    const row = (ks) => (ks || []).filter((k) => C.card(k)).map((k) => tTile(k, cvAt(k, lvOf(k)), `Lv${lvOf(k)}`)).join("");
    const missing = keys.filter((k) => !(state.cards[k] && state.cards[k].n > 0)).length;
    sheet(`<div id="aa-album"><div class="aa-profhead">${withLv(cardFace(X.face, "big"), X.plv | 0, "big")}<div><div class="aa-muted">The collection of</div><h1>${esc(X.name || "Someone")}</h1>
        <div class="aa-row"><span class="aa-difftag d-${esc(X.diff || "normal")}">${DIFF_NAME[X.diff] || "Normal"}</span>${X.ngp ? `<span class="aa-difftag d-ngp">New Game+ ${ROMAN_N[X.ngp] || X.ngp}</span>` : ""}</div></div></div>
      <div class="aa-stats">${tile("Battles", num(S.battles || 0))}${tile("Wins", num(S.wins || 0), pct(S.wins || 0, S.battles || 0) + " of battles")}${tile("Losses", num(S.losses || 0))}${tile("Win streak", num(S.streak || 0), "best " + num(S.best || 0))}
        ${tile("Duels nearby", L.w + "–" + L.l + (L.d ? "–" + L.d : ""), "won–lost" + (L.d ? "–drawn" : ""))}${tile("Cards owned", num(S.owned || 0), "of " + num(S.total || 0))}${tile("Decks complete", num(S.decksDone || 0), "of " + num(S.decks || 0))}
        ${tile("The Fool's Journey", (S.fool || 0) + "/21")}${tile("The Veiled Pilgrimage", S.oracle == null ? "sealed" : S.oracle + "/13")}${tile("Trades", num(S.traded || 0))}</div>
      <h3 class="aa-subh">Their spread</h3><div class="aa-trow">${row(X.spread)}</div>
      ${(X.fav || []).length ? `<h3 class="aa-subh">Played most</h3><div class="aa-trow">${row(X.fav)}</div>` : ""}
      <div class="aa-tbox"><h3 class="aa-subh">Every card they have <small class="aa-muted">${keys.length} different · ${missing} you don't have</small></h3>${tFilters(keys, "Only cards I don't have")}
        <div class="aa-tgrid">${keys.map((k) => tTile(k, cvAt(k, lvOf(k)), `Lv${lvOf(k)} · ${mineLine(k)}`, { n: cards[k][0], only: !(state.cards[k] && state.cards[k].n > 0) })).join("")}</div></div>
      <div class="aa-row" style="justify-content:center;margin-top:14px">${lan.trade ? '<button class="aa-btn" data-a="albumBack">Back to the trade</button>' : `<button class="aa-btn" data-a="lanInvite" data-w="trade" ${tradeBlocked() ? "disabled" : ""}>Ask to trade</button><button class="aa-btn ghost" data-a="albumBack">Close</button>`}</div></div>`);
    tileFilter(document.querySelector("#aa-album .aa-tbox"));
  }
  function tradeMaybeDone() {
    const T = lan.trade;
    if (!T) return;
    if (T.confirmMine && T.confirmTheirs && !T.done) {
      const r = act("tradeApply", { give: T.mine, get: T.theirs, peer: (lan.peer && lan.peer.name) || "" });
      T.done = true;
      if (r.ok) { sfx("rare"); toast("⇄ Traded with " + ((lan.peer && lan.peer.name) || "them") + ": " + (T.theirs.map((k) => C.card(k) ? C.card(k).name : k).join(", ") || "nothing") + " for " + (T.mine.map((k) => C.card(k).name).join(", ") || "nothing")); }
      lan.trade = null; closeSheet(); chrome(V()); repaint();
      return;
    }
    tradeSheet();
  }
  function nearby(v) {
    if (!v.made) return home(v);
    const P = lan.peer, me = meInfo();
    const peerCard = P ? plate(`<div class="aa-peer">${withLv(cardFace(P.face, "big"), P.plv, "big")}<div><div class="aa-muted">Playing with</div><h2>${esc(P.name)}</h2><span class="aa-difftag d-${esc(P.diff || "normal")}">${DIFF_NAME[P.diff] || "Normal"}</span>
        ${duelTierPick("lanTier")}<div class="aa-row" style="margin-top:12px"><button class="aa-btn" data-a="lanInvite" data-w="duel">Duel</button><button class="aa-btn" data-a="lanInvite" data-w="trade" ${tradeBlocked() ? 'disabled title="A Free (sandbox) save can only trade with another Free save"' : ""}>Trade cards</button><button class="aa-btn" data-a="lanPeek">Their collection</button><button class="aa-btn ghost" data-a="lanLeave">Leave</button></div></div></div>`) : "";
    const hostPlate = plate(`<div class="aa-h"><h2>Host a game</h2><small>your partner joins you</small></div>
      ${lan.hosting ? `<p>Hosting as <b>${esc(me.name)}</b>. On the other computer, open <b>Play Nearby</b> and press <b>Find games</b>${lan.addrs.length ? `, or type this computer's address: <b>${lan.addrs.map(esc).join("</b> or <b>")}</b>` : ""}.</p>
        <p class="aa-muted">If they can't find you, this computer's firewall needs the game's port open once (see the note below).</p><button class="aa-btn ghost" data-a="lanHost" data-on="0">Stop hosting</button>`
        : '<p class="aa-muted">Let someone on your home network join you. Only the host needs the firewall note below.</p><button class="aa-btn" data-a="lanHost" data-on="1">Host</button>'}`);
    const found = lan.found;
    const joinPlate = plate(`<div class="aa-h"><h2>Join a game</h2><small>someone else hosts</small></div>
      <div class="aa-row"><button class="aa-btn" data-a="lanScan">Find games</button><input class="aa-sel" id="aa-lanaddr" placeholder="or an address, e.g. 192.168.1.20" style="width:240px"><button class="aa-btn ghost sm" data-a="lanJoinAddr">Join</button></div>
      ${found === "busy" ? '<p class="aa-muted">Looking around the home network…</p>' : Array.isArray(found) ? (found.length ? `<div class="aa-hosts">${found.map((h) => `<div class="aa-hostrow">${cardFace(h.face, "save")}<div><b>${esc(h.name || "Someone")}</b><small class="aa-muted">${esc(h.addr)}${h.busy ? " · already playing" : ""}</small></div><button class="aa-btn sm" data-a="lanJoin" data-addr="${esc(h.addr)}" ${h.busy ? "disabled" : ""}>Join</button></div>`).join("")}</div>` : '<p class="aa-muted">No games found. Is the other computer hosting? Its firewall may need the note below.</p>') : ""}`);
    const note = plate(`<div class="aa-h"><h2>The firewall note</h2><small>once, on the hosting computer only</small></div>
      <p class="aa-muted">Most computers block games from the home network until asked. On the computer that hosts, run this once in a terminal (it asks for your password):</p>
      <pre class="aa-cmd">sudo ufw allow from 192.168.0.0/16 to any port ${lan.port} proto tcp comment 'NeuroArcana'</pre>`);
    return `<div class="aa-hello"><div><h1>Play Nearby</h1><div class="aa-muted">Trade cards and duel with someone on the same home network (the same router). Nothing leaves your home network.</div></div></div>
      ${P ? peerCard : `<div class="aa-deckstat">${hostPlate}${joinPlate}</div>`}${note}`;
  }

  async function lanJoinTo(addr) {
    if (!addr) return toast("Type the host's address, e.g. 192.168.1.20", true);
    await Store.call("lan_me", [meInfo()]);
    const r = await Store.call("lan_join", [addr]).catch(() => ({ error: "no shell" }));
    if (r && r.error) return toast(r.error, true);
    lan.role = "guest"; lanPoll(); repaint();
  }
  // ---- New Game+ (Cam, 1 Nov) ----
  function ngpSheet() {
    const v = V(), pick = ui.ngpPick || (ui.ngpPick = []), next = Math.min(C.NGP.maxCycle, (v.ngp || 0) + 1);
    if (!ui.ngpDiff) ui.ngpDiff = v.diff;
    sheet(`<h2>New Game+ ${ROMAN_N[next]}</h2><p class="aa-muted">A new save begins -- the same name and picture -- and the road starts again at the Magician. This save stays exactly as it is.
      Every keeper is stronger (+${C.NGP.pow * next} Power, +${C.NGP.spirit * next} Spirit) and Journey wins pay ${Math.round(C.NGP.pay * next * 100)}% more. Choose <b>${C.NGP.boons}</b> Legacy boons to take with you:</p>
      ${v.diff === "free" ? "" : `<div class="aa-muted" style="font-family:var(--head);font-size:12px;letter-spacing:.14em">ITS DIFFICULTY</div>${diffPicker(ui.ngpDiff, "ngpDiff").replace(/<button class="aa-diff d-free[^]*?<\/button>/, "")}`}
      <div class="aa-legacy">${C.LEGACY.map((b) => `<button class="aa-legboon${pick.includes(b.id) ? " on" : ""}" data-a="ngpPick" data-id="${b.id}"><b>${esc(b.name)}</b><small>${esc(b.text)}</small></button>`).join("")}</div>
      <div class="aa-row" style="justify-content:center;margin-top:14px"><button class="aa-btn" data-a="ngpGo" ${pick.length === C.NGP.boons ? "" : "disabled"}>Begin New Game+ ${ROMAN_N[next]}</button><button class="aa-btn ghost" data-a="close">Not yet</button></div>`);
  }
  async function ngpBegin() {
    const r = C.newGamePlus(state, ui.ngpPick || [], now(), (Math.random() * 2 ** 31) | 0, state.diff === "free" ? "free" : firstOpen(ui.ngpDiff || state.diff));
    if (r.error) return toast(r.error, true);
    await saving;
    const P = activeProfile(), x = await Store.call("profile_new", [{ name: (state.name || P.name || "Seeker") + " · NG+ " + ROMAN_N[r.state.ngp], diff: r.state.diff, face: r.state.face }]);
    if (!x || x.error) return toast((x && x.error) || "Couldn't make the new save.", true);
    profiles = x;
    const w = await Store.call("save", [r.state]);
    if (w && w.error) return toast(w.error, true);
    ui.ngpPick = null; ui.ngpDiff = null;
    await reloadSave();
    sfx("rare");
    if (!state.spread.length) go("store");
  }
  async function forgetAll() {
    await saving;
    try { const x = await Store.call("codex_reset", []); if (x && x.cards) codex = x; } catch (e) { return toast("Couldn't forget.", true); }
    act("libSync", { pages: 0, books: [] }); toast("Forgotten. The Library and the Archive start again."); repaint();
  }
  async function startOver(diff, forget) {
    await saving;
    const old = activeProfile(), name = (state && state.name) || old.name, face = (state && state.face) || old.face;
    const x = await Store.call("profile_new", [{ name, diff, face }]);
    if (!x || x.error) return toast((x && x.error) || "Couldn't start over.", true);
    profiles = x;
    const d = await Store.call("profile_delete", [old.id]); if (d && !d.error) profiles = d;
    if (forget) { try { const c = await Store.call("codex_reset", []); if (c && c.cards) codex = c; } catch (e) { /* kept */ } }
    ui.startDiff = diff; layerAsked = false; await reloadSave(); toast("A fresh start -- on " + DIFF_NAME[diff] + ".");
  }
  // ---- the saves (Cam, 1 Nov: "multiple saves ... a designated Sandbox save ... another player can have a separate save") ----
  function randomCardKey(not) { const all = C.catalogue().cards.filter((c) => c.key !== not && c.img); return all.length ? all[Math.floor(Math.random() * all.length)].key : null; }
  async function reloadSave() {
    try { const p = await Store.call("profiles", []); if (p && Array.isArray(p.list)) profiles = p; } catch (e) { /* one save */ }
    let saved = null;
    try { saved = await Store.call("load", []); } catch (e) { saved = null; }
    state = C.normal(saved && !saved.error ? saved : C.empty());
    applyZoom(); closeSheet(); music.el && music.el.pause(); music.el = null;
    catchUpAchievements();
    if (state.made && state.diff !== "free" && state.ach && Object.keys(state.ach).length) Store.call("ach_add", [state.diff, { ids: Object.keys(state.ach), by: state.name || activeProfile().name }]).then((x) => { if (x && x.easy) diaryRec = x; }).catch(() => {});
    if (state.battle && state.battle.mode === "lan") state.battle = null;            // (a duel on the home network ends when the game closes)
    if (state.battle && state.battle.over && !(state.battle.keeps && state.battle.keeps.won === null)) state.battle = null;
    go(state.battle ? "battle" : "home");
    toast("Now playing: " + (state.name || activeProfile().name || "a new save") + (state.kind === "sandbox" || activeProfile().kind === "sandbox" ? " (sandbox)" : ""));
  }
  function savesSheet() {
    const cur = profiles.active, v = V();
    sheet(`<h2>Saves</h2><p class="aa-muted">Each save is its own collection, with its own difficulty.</p>
      <div class="aa-saves">${profiles.list.map((p) => { const here = p.id === cur, face = here && v.made ? v.face || p.face : p.face;
        return `<div class="aa-saverow${here ? " on" : ""}">${cardFace(face, "save")}<div class="who"><b>${esc(here && v.made && v.name ? v.name : p.name)}</b><span class="aa-difftag d-${p.diff || "normal"}">${DIFF_NAME[p.diff || "normal"]}</span><small class="aa-muted">${here ? "playing now" : "started " + esc((p.created || "").slice(0, 10))}</small></div>
          ${here ? `<button class="aa-chip" data-a="saveOver">Start over…</button>${profiles.list.length > 1 ? `<button class="aa-chip" data-a="saveDel" data-id="${p.id}">Delete</button>` : ""}` : `<button class="aa-btn sm" data-a="saveUse" data-id="${p.id}">Play</button><button class="aa-chip" data-a="saveDel" data-id="${p.id}">Delete</button>`}</div>`; }).join("")}</div>
      ${v.made ? `<div class="aa-saveedit"><b style="font-family:var(--head)">This save</b><div class="aa-row"><button class="aa-btn ghost sm" data-a="faceDraw">Draw a new picture</button><button class="aa-btn ghost sm" data-a="ptab" data-t="ach">Wear a badge…</button>
        <input class="aa-sel" id="aa-rename" maxlength="30" value="${esc(v.name || activeProfile().name)}"><button class="aa-btn ghost sm" data-a="saveRename">Rename</button></div></div>` : ""}
      <div class="aa-row" style="justify-content:center;margin-top:14px"><button class="aa-btn" data-a="saveNewSheet">New save…</button></div>`);
  }
  function newSaveSheet() {
    sheet(`<h2>A new save</h2><div class="aa-newsave">${cardFace(ui.newFace, "big")}<button class="aa-btn ghost sm" data-a="saveNewFace">Draw another card</button></div>
      <label class="aa-row">Name <input class="aa-sel" id="aa-newname" maxlength="30" placeholder="Who's playing?" value="${esc(ui.newDiffName || "")}"></label>
      <div class="aa-muted" style="font-family:var(--head);font-size:12px;letter-spacing:.14em;margin-top:12px">DIFFICULTY (for good)</div>${diffPicker(ui.newDiff || "normal", "newDiff")}
      <div class="aa-row" style="justify-content:center;margin-top:12px"><button class="aa-btn" data-a="saveCreate">Create and play</button><button class="aa-btn ghost" data-a="saves">Back</button></div>`, true);
  }
  /** The sandbox (QA Lead, voted 1 Nov): quick ways to test. A save that has used it is marked. */
  function sandboxSheet() {
    const B = state.battle, tool = (op, label, n) => `<button class="aa-btn ghost sm" data-a="sandbox" data-op="${op}"${n != null ? ` data-n="${n}"` : ""}>${label}</button>`;
    sheet(`<h2>Testing tools</h2><p class="aa-muted">For play tests. Using them marks this save as a sandbox save.</p><div class="aa-row" style="flex-wrap:wrap;justify-content:center;gap:8px">
      ${tool("moon", "+1,000 Moonstones")}${tool("cards", "Three free boosters")}${tool("maxdeck", "Max out my spread")}${tool("daily", "Draw today's card again")}
      ${tool("road", "Journey: to the Chariot", 6)}${tool("road", "Journey: to Temperance", 13)}${tool("road", "Journey: to the World", 20)}${tool("world", "Beat the World (open the Pilgrimage)")}
      ${B && !B.over ? tool("win", "Win this battle") : ""}</div>`, true);
  }

  // ---- the guides and the tutorial (Cam, 1 Nov: "NPCs ... a tutorial which talks through all the starter game play") ----
  // Each step: who speaks, on which screen, the pages, what to point at, and what moves it on. The rules keep only which
  // step you're at (C.TUT_STEPS); the words live here.
  const TUT = {
    welcome: { npc: "selene", on: null, pages: ["Oh -- hello. You found the Observatory. Most people walk straight past the door. I'm Selene; I keep the lamps lit and the stars honest.",
      "Every card in here was drawn from a real deck -- six tarot, four oracle, a few hundred faces in all. You'll collect them, duel with them, raise them, and one day read with them. But nobody starts with nothing. Let's find Orrin. He'll want to sell you something."], done: () => { act("tut", { step: "starter" }); go("store"); } },
    starter: { npc: "orrin", on: "store", spot: "#aa-buystarter", pages: ["Ah! Fresh hands. Let me guess -- you've got exactly five hundred Moonstones? Wonderful, because my Starter Spread costs exactly five hundred. Eight cards, three of them sharing a suit so they hum together, plus an uncommon and a rare. A bargain. Mostly."], wait: true },
    card: { npc: "selene", on: "collection", pages: ["Let's look at one of yours properly. The art sits in the arch, the name runs across the top, and the suit's little sign waits in the corner.",
      "The gold coin is its Power, how hard it pushes in a clash. The red one is its Harm, how much Spirit your rival loses when it wins.",
      "The gem under the window is its rarity. Silver for common, jade for uncommon, sapphire for the Majors, amber for the courts -- and the shimmering one belongs to the World alone. People have fought over less.",
      "Underneath are its boons, one for each level it climbs. Cards grow by winning. And if you end up with spares, the Altar will gladly take them off your hands in exchange for a little growth."], done: () => { closeSheet(); act("tut", { step: "deck" }); repaint(); } },
    deck: { npc: "selene", on: "collection", spot: "#aa-deckslots", pages: ["These eight are your spread. Each battle shuffles them and deals you four, so there's no hiding a weak card at the back -- it'll turn up at the worst possible moment. Cards have a sense of humour that way.",
      "Combos listen to all eight, though. Click a card and choose Put in spread to swap it in. The Archivist has a book you'll want to see."], done: () => { act("tut", { step: "combos" }); go("combos"); } },
    combos: { npc: "archivist", on: "combos", pages: ["Hoo. Welcome to the Combo Book. Every combo there is has a page here, but a page stays blank until you've carried that combo into battle. I don't write down rumours.",
      "Three cards of one suit wake their element. Wands burn brighter, Cups refill what's spent, Swords cut deeper, Pentacles stand their ground. The Golden Dawn's magicians tied the suits to fire, water, air and earth, and people have been arguing about it ever since.",
      "Your spread is already humming with something. Take it into a fight and I'll fetch my quill."], done: () => { act("tut", { step: "daily" }); go("divine"); } },
    daily: { npc: "selene", on: "divine", spot: "#aa-fan", pages: ["Every morning, draw one card from your own collection. Its suit watches over your battles until midnight, and I'll note it in your journal. Pick from the fan, and don't overthink it -- the cards rather like being chosen on instinct."], wait: true,
      after: ["There's your omen for today. Now -- Vesper's been pacing by the arena for an hour. Shall we put her out of her misery?"], afterDone: () => { act("tut", { step: "battle1" }); go("play"); } },
    battle1: { npc: "vesper", on: "play", pages: ["So you're the new one. Good. Spar with my apprentice first. He bruises easily, so be gentle. Or don't -- it's educational either way."], button: ["Spar", () => fight("tutorial", { n: 0 })] },
    battle2: { npc: "vesper", on: "play", pages: ["Not bad at all. Now let me show you Fury. Light the flame and your card costs two more stars, but if it wins, it hits for two more Harm. Save it for finishing someone off, or for punishing a card that had no business being on the table. Duel me, and try it."], button: ["Duel Vesper", () => fight("tutorial", { n: 1 })] },
    farewell: { npc: "selene", on: null, pages: ["Look at you. A spread, a book, a road ahead. Twenty-one keepers stand between you and the World, one for each step of the Fool's journey. Lost battles cost Moonstones, so travel wisely. Here are three hundred for the road -- Orrin will act surprised when you spend them."],
      button: ["Onward", () => { const r = act("tut", { step: "done" }); if (r.ok) { sfx("coin"); toast("+" + C.ECON.tutorial + " Moonstones"); } lessonStart("I"); }] }
  };
  // ---- the tutorial's chapters (Cam, 2 Nov: "the new features ... will all need a tutorial section that goes through
  //      things in detail. I am happy if the tutorial goes for an extended time"; Q12 q10: I on your first Easy save, II and
  //      III the first time you play Normal and Hard; skippable; all replayable from the Guidebook). Chapter I begins with
  //      the starting tutorial above (its steps live in the rules) and goes on here, after its farewell.
  const CHAPTER = {
    I: { name: "The Cards", npc: "orrin", steps: [
      { npc: "orrin", on: "collection", spot: ".aa-archtabs", pages: ["One more thing before you go -- and no, I'm not charging for it. This page is your Cards page, and it doubles as the Archive: every card of every deck, laid out like a collector's album. Mine has coffee stains.",
        "Cards you own glow in full colour. The ones you've only glimpsed -- across a table, in a booster, in someone's trade -- stay grey. And the ones you've never met sit there as question marks, being mysterious on purpose.",
        "Click any card and its page slides open on the right. Face a card once and you learn its numbers; beat it three times and you learn what beats it; raise your own copy all the way and the Archivist will scribble you some tips. Right-click works anywhere in the game, too."] },
      { npc: "orrin", on: "collection", spot: "#aa-deckslots", pages: ["Your spread lives up top. Only four of the eight get dealt each battle, so eight solid cards beat four stars and four duds every time. I learned that the expensive way.",
        "Name a spread and save it, and you can swap between them with a click. Most readers keep a few -- one for each road, and one for each grudge."] },
      { npc: "selene", on: "play", pages: ["Let's talk about the clash, since you'll be doing a lot of it. Each round you pick a card and bid stars on it. Twelve have to last the whole battle, and the best players lose a round on purpose to win the next two. It feels terrible the first time. Then it feels clever.",
        "Some cards carry abilities. Most only fire when the card wins, but a few bend the round before anyone counts -- the Fool loves a bid of nothing, and the High Priestess quietly cancels whatever the other card had planned. The Wheel of Fortune rolls a die. Boethius wrote about that wheel from a prison cell fifteen hundred years ago, and it still hasn't stopped turning.",
        "Turn a card reversed before you reveal and it shrugs off the other card's ability, at the cost of its own and a point of Power. In a reading, reversed means something blocked or turned inward. Here, it's a shield.",
        "And if the hand you're dealt makes you wince, there's the mulligan. Use it before the first round and two other cards from your spread are offered, for the price of a star. Easy gives you four a battle, Normal two, Hard just the one. Hard is like that."] },
      { npc: "selene", on: "play", spot: ".aa-road", pages: ["This is the Fool's Journey. The Fool is card zero -- the beginning, the leap -- and the Majors are the road he walks, from the Magician all the way to the World. Each keeper here guards one of those steps.",
        "Win a station and the next one opens. Lose, and it costs you a few Moonstones, more the further you've come. Mind the crowned stations: those keepers send you back to the start of their stretch if they beat you. Rude, but fair.",
        "Beat the World on Easy and Normal opens, where the decks themselves start to wake. Beat it on Normal and Hard is waiting. I'll walk you through each one when you get there."] },
      { npc: "orrin", on: "store", pages: ["My shop! Starlight Boosters hold five cards from anywhere. A deck's own booster costs more, but every card comes from that deck -- that's how you finish one.",
        "Spare copies are never wasted. Feed them to the Altar from a card's page and they'll help it grow, and once a card is maxed, one more spare will gild it. Shiny. I approve."] },
      { npc: "selene", on: "divine", pages: ["Every day starts here. Draw one card from your collection and its suit blesses your battles until midnight. Keep it up seven days running and something rather nice turns up.",
        "Readings lay your own cards out in real tarot spreads, and the Journal remembers every reading and every keeper's story. That's everything, really. If you ever forget something, the Guidebook in Settings has all of this again. Go well."] },
      { npc: "archivist", on: "library", pages: ["Hoo. One last door before you go -- mine. This is the Library. Every book in here was written by someone who walked this road before you, and every one of them is missing pages.",
        "You'll find those pages as you play: beat a keeper, win enough battles, draw your card every morning, lay a reading, pull the right card from a booster. When one turns up, it arrives sealed. Come here, break the seal, and it goes into its book. The ones you haven't found yet are question marks, and they'll stay mysterious for a while. Good things take time.",
        "Two seals are waiting for you already. One is Selene's guide -- everything she's told you tonight, written into a book. The other is a page from the Major Arcana: the Fool, card zero. Every keeper you beat on the Fool's Journey adds their own page. Go on. Break the seals. I'll be here. I'm always here."] } ] },
    II: { name: "The Decks", npc: "selene", steps: [
      { npc: "selene", on: "home", pages: ["Welcome to Normal. Everything you've learned still holds, but now the decks themselves have opinions. Five new things, and none of them bite. Much."] },
      { npc: "selene", on: "collection", spot: "#aa-deckslots", pages: ["Put five cards from the same tarot deck in your spread -- three from an oracle deck -- and that deck wakes in harmony. The Crows hit a little harder, Splendor Solis brings extra stars, Wonderland gives you more Spirit to lose. Each deck sings its own note.",
        "You'll find a deck's harmony on any of its cards, under Its deck. So finishing a deck isn't only for reading with it anymore."] },
      { npc: "archivist", on: "combos", pages: ["Hoo. All eight cards from a single deck is something else entirely -- a Full Spread. Each deck has its own, and they are not subtle. Wonderland's Looking Glass shows you the card your rival chose each round. The Crows steal a star every round they win. Crows do that.",
        "I'll write each one into this book once you've carried it into battle. Fair warning: eight from one deck means leaving your favourites at home. That's the price of a full voice."] },
      { npc: "selene", on: "play", spot: ".aa-road", pages: ["From now on, every battle happens on an element. On the Field of Fire, Wands gain two Power and Swords -- the suit fire consumes -- lose one. It works the same for both of you.",
        "Each keeper fights on their own ground; the little sign on their station tells you which. Old astrologers paired every Major with a sign and an element, and the keepers still keep to it. Build for the ground and the ground fights with you."] },
      { npc: "orrin", on: "store", spot: ".aa-sealshelf", pages: ["And now, my favourite thing to sell. Seals! Little traps you set before a battle. They wait face down and spring once, when their moment comes. The Lantern shows you their card, the Hourglass buys you time, the Fool's Seal flips a coin for three Power one way or the other. Very popular with gamblers. And fools.",
        "Buy them here or win them from keepers, then choose which one to carry on the Battle page. Keepers set them too, so if you see a face-down Seal on their side of the table, be a little bit worried."] },
      { npc: "vesper", on: "play", pages: ["One for the little ones. When a card faces one a level or more above it and wins anyway, it earns double experience. The underdog learns fastest. I should know.",
        "Further down this page there's the Apprentice's Circuit -- seven Pages a week, for humble spreads whose levels add up to twelve or less -- and the Gauntlet, foe after foe for a growing pot. That's Normal. Try not to enjoy it too much."] }] },
    III: { name: "The Lore", npc: "archivist", steps: [
      { npc: "archivist", on: "home", pages: ["Hoo. Hard. Here the decks remember who they are. A Six of Pentacles isn't the same card in two different decks anymore -- each deck has a nature, and it shows. Make yourself comfortable. This takes a few pages."] },
      { npc: "archivist", on: "collection", pages: ["Each deck has claimed three or four cards as its own. A signature card is a rarity higher, carries a point more Power, and brings the deck's own ability instead of the usual one. The Crows' Death feasts on carrion. Wonderland's Fool tumbles down the rabbit hole on a coin toss.",
        "You'll know them by the deck's little sigil in the top corner. And on Hard, Wonderland's Full Spread trades the Looking Glass for Mushroom Growth -- a die every round, and on four or more your card grows by three Power. Eat me. Or don't."] },
      { npc: "archivist", on: "collection", pages: ["Every card in a deck leans the same way, too. The Crows hit harder but less often, Old School the other way round, and Wonderland's cards somehow get stronger upside down -- which, given the source material, seems fair.",
        "And every deck hunts one kind of card and fears another: Majors, courts, Aces and numbers, or oracle cards. The hunter gains two Power against its prey and loses one against what it fears. The clash tells you when it happens, so you needn't keep score."] },
      { npc: "archivist", on: "play", spot: ".aa-road", pages: ["The keepers stop dealing random hands here. They play spreads drawn from what their card truly means -- the Magician lays out a tool from each suit, the Star Gazer brings the three lights of the sky. The early ones keep a single spread; from the Wheel on, they keep two and take turns.",
        "They have temperaments as well. The Tower spends everything early, the Hermit hoards, the Devil can't resist Fury, and the High Priestess turns cards reversed to cancel yours. A keeper becomes a puzzle you can learn."] },
      { npc: "archivist", on: "tent", pages: ["Which is what this tent is for. Every keeper you've met has a page here, the ones who've beaten you first: their ground, their temperament, what they bring, which spread comes next, and every card you've seen them lay down.",
        "Below that, each of your saved spreads shows how many of its cards hunt something they bring, and how many fear something. Pick the one that hunts, and challenge them from right here.",
        "Win or lose, you'll learn a little more each time, and the Archive keeps it in every save you ever make. Knowledge outlives Moonstones. That's the whole of the lore, reader. Go well."] }] }
  };
  let lesson = null;                                            // {ch, i, p}: a chapter being shown
  function lessonStart(ch) { if (!CHAPTER[ch]) return; closeSheet(); closePanel(); lesson = { ch, i: 0, p: 0 }; const st = CHAPTER[ch].steps[0]; go(st.on || "home"); }
  function lessonEnd(done) {
    const ch = lesson && lesson.ch; lesson = null;
    if (ch && done !== false) { codex.taught[ch] = 1; codexSave(); }
    if (ch === "II" && state.diff === "hard" && !codex.taught.III) return lessonStart("III");      // (a Hard save: the lore follows the decks)
    repaint(); if (ch && done !== false) toast("✦ " + CHAPTER[ch].name + " -- done");
  }
  function lessonRender(host) {
    const L = CHAPTER[lesson.ch], st = L.steps[lesson.i];
    if (!st) { lessonEnd(true); return true; }
    if (st.on && st.on !== screen) { speak(host, st.npc, "This way -- " + (SCREEN_NAMES[st.on] || st.on) + ".", ["Go", "lessonGo"]); return true; }
    const page = Math.min(lesson.p, st.pages.length - 1), last = page === st.pages.length - 1, end = last && lesson.i === L.steps.length - 1;
    speak(host, st.npc, st.pages[page], [end ? "Done" : last ? "Onward" : "Next", "lessonNext"], false, L.steps.map((_, k) => (k < lesson.i ? "●" : k === lesson.i ? "◉" : "○")).join(" "));
    if (st.spot) spot(st.spot);
    return true;
  }
  /** A save on a layer whose chapter you haven't had: offered once a session ("This difficulty brings new features"). */
  function layerOffer(v) {
    if (lesson || !v.made || v.tutStep != null || ui.layerAsked || layerAsked || screen === "battle" || $("aa-over").innerHTML) return;
    const need = v.diff === "hard" ? ["II", "III"].filter((c) => !codex.taught[c]) : v.diff === "normal" && !codex.taught.II ? ["II"] : [];
    if (!need.length) return;
    layerAsked = true;
    sheet(`<h2>This difficulty brings new features</h2><p>${DIFF_NAME[v.diff]} has a few new things in it -- ${need.map((c) => `<b>${esc(CHAPTER[c].name.toLowerCase())}</b>`).join(" and ")}. Shall we go over them? It only takes a few minutes.</p>
      <div class="aa-row" style="justify-content:center;margin-top:12px"><button class="aa-btn" data-a="lessonStart" data-ch="${need[0]}">Let's go over them</button><button class="aa-btn ghost" data-a="close">Later</button></div>`, true);
  }
  let layerAsked = false;
  function guidebook() {
    sheet(`<h2>The Guidebook</h2><p class="aa-muted">Every chapter of the tutorial, to read again.</p><div class="aa-stack" style="gap:8px;margin-top:10px">
      ${Object.keys(CHAPTER).map((c) => `<button class="aa-btn ghost" data-a="lessonStart" data-ch="${c}">${c} · ${esc(CHAPTER[c].name)}${codex.taught[c] ? " ✓" : ""}</button>`).join("")}
      <button class="aa-chip" data-a="tutRestart">Replay the starting tutorial</button></div>`, true);
  }
  const BATTLE_TIPS = {
    0: ["Four of your eight have been dealt. Pick a card, then light some stars. Might is its Power plus two for every star, and the higher Might takes the round -- the winner's Harm comes straight off the loser's Spirit.",
      "You both choose in secret and reveal together, so think about what they're thinking. Twelve stars have to last four rounds. And a card flipped reversed ignores their ability, but loses its own and a point of Power. Ready? Reveal."],
    1: ["See that flame? That's Fury. Two extra stars on top of your bid, two extra Harm if you win. Use it when you're sure."]
  };
  const KEEPER_LINES = {
    fool: ["", "Every trick you know, I taught myself first.", "What's hidden stays hidden -- unless you can see past the veil.", "Grow, or be grown over.", "Order. Kneel to it, or break on it.",
      "The old ways are old because they win.", "Choose -- and live with the choosing.", "Hold the reins, or be dragged.", "Gentle hands can hold a lion.", "My lantern shows you only one step. Take it.",
      "Round and round -- who knows where it stops?", "Every card weighed. Every debt paid.", "Upside down, the world makes more sense.", "All things end. Today, perhaps, you.", "A little of this, a little of that -- and patience.",
      "Your chains are of your own making.", "Everything you built, I can bring down.", "Wish on me. I dare you.", "Nothing here is what it seems -- not even you.", "Stand in my light and be seen.", "Rise. Be judged.", "You've walked the whole road. Now dance with the World -- and lose, and walk it again."],
    oracle: ["", "Roll up, roll up -- the show is you!", "Cross my palm. I already know how this ends.", "Bones dance best under the big top.", "Every rune I cut is a promise.", "Shields up. Hold the line.",
      "The roots of the World-Tree hear everything.", "Hedge and thorn, root and leaf -- mind your step.", "Drink from the cauldron, and be changed.", "Crow and battle-queen. Which am I today?", "Every leaf a cure. Every root a poison.",
      "Just a drop. You'll hardly notice.", "Welcome to my garden. Touch nothing.", "Four realms you crossed to reach me. Now see what lies behind the veil."]
  };
  const keeperLine = (camp, n) => ((KEEPER_LINES[camp] || [])[n] || "");
  // what a keeper says when the fight is over: [beaten, victorious] (Story Writer, 1 Nov)
  const KEEPER_AFTER = {
    fool: [null, ["A trick I hadn't seen. Teach it to me some day.", "Every trick has a price. Today, you paid it."],
      ["So you saw through the veil. Keep what you saw.", "Some doors stay closed until you're ready."],
      ["You've grown. Go on -- the garden lets you pass.", "Wilt a little. Then grow back stronger."],
      ["Order bends. It seems it bends to you.", "Kneel today. Rule tomorrow, perhaps."],
      ["You've learned the old ways well enough to break them.", "The choir sings on without you. Try again."],
      ["You chose. And chose well.", "Hesitate, and the choice is made for you."],
      ["The reins are yours. Ride on, and don't look back.", "You pulled too hard. The horses felt it."],
      ["Gentle hands, and still you won. Well done.", "The lion only roars at those who fear it."],
      ["My lantern is yours for one more step.", "Too fast. The dark waits for the hasty."],
      ["The wheel turns your way. Enjoy it -- it turns again.", "Round it goes. Down, this time."],
      ["The scales favour you. Fairly won.", "Weighed, and found wanting -- for now."],
      ["You see it now, don't you? Upside down, it all makes sense.", "Hang a while. It helps you think."],
      ["An ending -- but not yours. Not today.", "Every road ends. Yours just bent back."],
      ["Patience suits you. Take a little of mine.", "Too much of this, not enough of that."],
      ["You slipped the chains. Few do.", "The chains fit you well. Stay a while."],
      ["You stood while everything fell. Remember that.", "Everything you built, gone. Build it again."],
      ["Make your wish. You've earned it.", "Not every star answers. Mine didn't, for you."],
      ["You walked the moonlit path and didn't stumble.", "Nothing was what it seemed -- least of all your plan."],
      ["Stand in the light, then. You've earned the warmth.", "Too bright for you yet. Come back in the morning."],
      ["Rise, then. You're judged worthy.", "Not yet. The trumpet will sound again."],
      ["Dance with me once more, some day. The world is yours.", "Back to the beginning, little Fool. Walk it again -- and dance better."]],
    oracle: [null, ["Ha! The show goes on -- with you in it!", "Roll up, roll up -- step right back to the start!"],
      ["The ball didn't show me that. How interesting.", "I told you how this ends. Cross my palm again."],
      ["The bones rattle your name with respect.", "Another skeleton for the big top."],
      ["You've cut your own rune today.", "The stone remembers every failure."],
      ["The line breaks. Pass, shield-sister.", "Shields up next time."],
      ["The roots whisper your name now.", "The World-Tree did not choose you. Not yet."],
      ["Mind your step on the way out. You've done well.", "Thorns. I did warn you."],
      ["Changed, and for the better. Drink deep.", "The cauldron isn't finished with you."],
      ["Crows will sing of this.", "The crows are already circling."],
      ["Your cure, this time. Keep it.", "Your poison, this time. Rest."],
      ["Just a drop -- and you shook it off.", "You hardly noticed. That's how it works."],
      ["My garden bows to you. Touch what you like.", "I said touch nothing."],
      ["You've seen behind the veil. Few ever do.", "The veil falls again. Begin again."]]
  };
  // the Book of Keepers: a page for each keeper, written the first time you beat them (Story Writer, 1 Nov). The tarot's
  // history runs through them -- Pamela Colman Smith, A. E. Waite, Aleister Crowley and Frieda Harris, Carl Jung (Cam's picks)
  const KEEPER_PAGES = {
    fool: [null,
      "The Magician's Apprentice keeps the first station, where the Fool learns that will can shape the world.\nIn the deck A. E. Waite designed and Pamela Colman Smith painted in 1909, the Magician stands with one hand raised to the sky and one pointing to the earth, the four suits laid on the table before him -- every tool the journey will need, all at once.",
      "The Veiled Priestess guards what is known but not said.\nIn older decks she was the Papess, a woman pope -- a figure so troubling that some printers renamed her Juno. Waite and Smith seated her between two pillars, dark and light, a scroll half-hidden in her robe.",
      "The Garden Empress is abundance: growth, comfort, the senses.\nPamela Colman Smith crowned her with twelve stars and seated her in ripening wheat, a heart-shaped shield at her side bearing the sign of Venus.",
      "The Iron Emperor is order -- the walls and laws that let a garden survive.\nSmith gave him a throne carved with rams' heads, the sign of Aries, and set him against bare red mountains: he rules the hard places.",
      "The Hierophant's Choir keeps tradition, teaching and belonging.\nOnce he was the Pope of the Marseille decks. Carl Jung would have called him an archetype of the wise elder -- the voice of what everyone already agrees is true.",
      "The Twin Lovers are a choice of the heart, not only romance.\nOlder decks show a young man torn between two women. Waite changed the scene to a man and woman in a garden beneath an angel -- Eden before the fall, a choice still to be made.",
      "The Charioteer is will in motion -- and the first main keeper of the road.\nSmith's charioteer holds no reins: two sphinxes, one black and one white, pull because he wills it. Seven cards in, the Fool must prove they can hold opposites together.",
      "The Lion Tamer is courage that is gentle rather than fierce.\nWaite moved Strength to eighth place and Justice to eleventh, swapping the older order to fit the Golden Dawn's astrology. Many decks since follow him; others, like Crowley's Thoth deck, kept the old order and renamed her Lust.",
      "The Lantern Hermit withdraws to find what can only be found alone.\nHis lantern holds a six-pointed star. Smith painted him alone on a high peak, the lamp lit for whoever climbs behind him -- the teacher who has walked the road first.",
      "The Wheelwright turns the Wheel of Fortune, where everything rises and falls in its time.\nSmith's wheel carries letters that spell TARO, ROTA and the Hebrew name of God, ringed by a sphinx, a serpent and a jackal-headed figure -- the oldest idea in the deck: nothing stays.",
      "The Magistrate weighs every card and every debt.\nJustice holds scales and an upright sword. In Crowley's Thoth deck she becomes Adjustment -- not punishment, but the balance that sets itself right.",
      "The Hanged Wanderer hangs by one foot and is perfectly calm.\nSmith gave him a halo: he chose this. Jung's readers saw in him the surrender that comes before change -- looking at the world upside down until it makes sense.",
      "The Pale Rider brings endings, which in the tarot are rarely about dying.\nThe armoured skeleton on a white horse carries a banner with a white rose. Behind him the sun rises between two towers: every ending is also a door.",
      "The Alchemist mixes what shouldn't mix until it becomes something new -- and is the second main keeper of the road.\nCrowley and Frieda Harris, who painted his Thoth deck between 1938 and 1943, called this card Art: Temperance as the great work of alchemy.",
      "The Horned One is what binds us -- habit, fear, appetite.\nIn Smith's card the chains around the two figures' necks are loose. They could lift them off at any moment. That is the Devil's secret.",
      "The Tower Warden guards what must fall.\nLightning strikes, the crown is knocked from the tower, figures tumble. It's the most feared card in the deck, and often the most freeing: what was false comes down.",
      "The Star Gazer is hope after the Tower: calm, healing, open sky.\nSmith painted a woman kneeling naked by a pool, pouring water onto land and sea beneath one great star and seven small ones.",
      "The Moon Witch rules the half-light, where nothing is quite what it seems.\nA dog and a wolf howl, a crayfish climbs from the water, and a path winds between two towers into the dark. Jung would have called it the unconscious, rising.",
      "The Sun King is joy without a shadow.\nSmith painted a child on a white horse beneath a blazing sun, sunflowers along the wall behind -- the Fool, almost home, made new.",
      "The Last Herald blows the trumpet of Judgement: wake, rise, answer.\nCrowley's Thoth deck called it the Aeon, the turning of an age. In every deck it is a calling -- the moment you can't pretend you didn't hear.",
      "The World Dancer waits at the end of the road -- the last main keeper, and the whole journey in one figure.\nShe dances in a laurel wreath, the four creatures of the evangelists in the corners. Crowley called the card the Universe. The Fool who reaches her has walked all twenty-one steps -- and, in the tarot, begins again."],
    oracle: [null,
      "The Barker at the Gate calls you into the carnival of souls, where every attraction is a lesson in disguise.\nOracle decks, unlike the tarot, follow no fixed pattern: each is its maker's own world.",
      "Madame Pythia reads palms in a painted wagon.\nShe takes her name from the Pythia, the priestess of Delphi who spoke for Apollo -- the most famous oracle of the ancient world.",
      "The Ringmaster of Bones keeps the show going after dark.\nThe carnival realm ends with him: a reminder that every performance, like every reading, is a story told to someone.",
      "The Rune-Carver cuts promises into stone.\nThe runes were an alphabet before they were an oracle. In the Hávamál, Odin hangs nine nights on the World-Tree to win them.",
      "The Shield-Maiden holds the line.\nShe is the northern realm's courage: a reading as a shield-wall, each card standing beside the next.",
      "The Seer of the World-Tree hears what the roots hear.\nIn the Norse poems a völva, a seeress, tells Odin of the world's beginning and its end. She keeps the north's last gate.",
      "The Hedge-Witch lives at the border of the village and the wild.\nHers is the oldest kind of reading: herbs, weather, signs on the path.",
      "Ceridwen's Keeper tends the cauldron of change.\nIn Welsh legend, Ceridwen brewed a potion of wisdom for a year and a day; three drops of it made a boy into the bard Taliesin.",
      "The Morrigan is the crow-queen of battle and prophecy.\nIn Irish legend she foretells the fate of warriors -- the rooted realm's last and fiercest guardian.",
      "The Herbalist knows that every leaf is both cure and poison.\nThe difference, as an old saying of Paracelsus has it, is only the dose.",
      "The Poisoner's Apprentice is still learning, and very proud of it.\nThe apothecary realm teaches caution: what helps in a little harms in a lot.",
      "The Apothecary Queen rules a garden where nothing may be touched.\nNightshade, foxglove, hemlock: beautiful, and deadly. She is the last of the realms' keepers.",
      "The Veiled Oracle stands behind every reading you have ever made.\nShe knows the carnival, the north, the roots and the poison garden. Lift her veil, and the Cartomancer's Parlour waits beyond -- thirty-six small cards, named for Mademoiselle Lenormand, the most famous fortune-teller of Napoleon's Paris."]
  };
  const keeperAfter = (camp, n, beaten) => { const L = (KEEPER_AFTER[camp] || [])[n]; return L ? L[beaten ? 0 : 1] : ""; };
  const SCREEN_NAMES = { store: "the Store", collection: "Cards", combos: "the Combo Book", divine: "Divine", play: "Battle", home: "Home", tent: "the Scouting Tent", library: "the Library" };
  function guideRender(v) {
    const host = $("aa-guide");
    if (!host) return;
    document.querySelectorAll(".aa-spot").forEach((el) => el.classList.remove("aa-spot"));
    if (v.made && lesson && screen !== "battle" && !$("aa-opening-live")) { lessonRender(host); return; }
    if (v.made && v.tutStep == null) later(400, () => layerOffer(V()));
    if (!v.made || v.tutStep == null || $("aa-opening-live")) { host.innerHTML = ""; return; }
    const step = v.tutStep, T = TUT[step];
    if (screen === "battle") {
      const B = v.battle, tips = B && B.mode === "tutorial" && !B.over && B.round === 0 ? BATTLE_TIPS[B.opts.n] : null;
      if (!tips || ui.tipDone) { host.innerHTML = ""; return; }
      const page = Math.min(ui.tipPage || 0, tips.length - 1);
      speak(host, "vesper", tips[page], page < tips.length - 1 ? ["Next", "tipNext"] : ["Got it", "tipDone"], "mid");
      if (B.opts.n === 1) spot(".aa-toggle.fury");
      return;
    }
    if (!T) { host.innerHTML = ""; return; }
    if (T.on && T.on !== screen) { speak(host, T.npc, "Come -- I'm waiting in " + SCREEN_NAMES[T.on] + ".", ["Go", "tutGo"]); return; }
    if (step === "card" && !ui.detail && !ui.cardShown) {
      ui.cardShown = true;
      const pick = state.spread.find((k) => C.card(k).suit === "major") || state.spread.find((k) => C.card(k).ab) || state.spread[0];
      if (pick) later(80, () => detail(pick));
    }
    // today's card already drawn (a replayed tutorial, or drawn before the tutorial reached it): skip the wait for the fan
    if (step === "daily" && v.daily && !ui.tutAfter) { ui.tutAfter = true; ui.tp = 0; }
    const pages = ui.tutAfter ? T.after : T.pages, page = Math.min(ui.tp || 0, pages.length - 1), last = page === pages.length - 1;
    const btn = !last ? ["Next", "tutNext"] : ui.tutAfter ? ["Onward", "tutAfterDone"] : T.button ? [T.button[0], "tutButton"] : T.wait ? null : ["Onward", "tutDone"];
    speak(host, T.npc, pages[page], btn, !!T.up);
    if (last && T.spot && !ui.tutAfter) spot(T.spot);
  }
  function speak(host, who, text, btn, up, chapter) {
    const N = ART.NPC[who];
    host.innerHTML = `<div class="aa-guide${up === "mid" ? " mid" : up ? " up" : ""}"><div class="portrait">${face("guide-" + who)}</div><div class="talk"><div class="who">${esc(N.name)}<small>${esc(N.role)}</small></div>${chapter ? `<div class="aa-chapterline" title="How far through this part of the guide">${esc(chapter)}</div>` : ""}<p>${esc(text)}</p>
      <div class="aa-row">${btn ? `<button class="aa-btn sm" data-a="${btn[1]}">${esc(btn[0])}</button>` : ""}${chapter ? '<button class="aa-chip" data-a="lessonSkip">Skip this chapter</button>' : ""}</div></div></div>`;
  }
  // (the designer, 2 Nov: the guide never sits on what it points at -- a target low on the screen sends the bubble up top)
  function spot(sel) { const el = document.querySelector(sel); if (!el) return; el.classList.add("aa-spot");
    const r = el.getBoundingClientRect(), g = document.querySelector("#aa-guide .aa-guide"); if (g && r.bottom > innerHeight * 0.55) g.classList.add("up"); }

  // ---- clicks: one listener for the whole page ----
  const A = {
    go: (el) => { closeSheet(); go(el.dataset.to); },
    settings, close: () => userClose(), closeBg: (el, e) => { if (e.target === el) userClose(); },
    yes: () => { const f = ui.onYes; ui.onYes = null; closeSheet(); if (f) f(); },
    begin: () => beginSave(false),
    beginSkip: () => beginSave(true),
    pickDiff: (el) => { ui.startDiff = el.dataset.d; repaint(); },
    saves: () => savesSheet(),
    ptab: (el) => { const t = el.dataset.t; closeSheet(); if (screen !== "profile") go("profile"); ui.ptab = t; repaint(); },
    badgePick: async (el) => { const key = "ach:" + el.dataset.id + ":" + el.dataset.d; const r = act("setFace", { key }); if (!r.ok) return; const x = await Store.call("profile_edit", [profiles.active, { face: key }]); if (x && !x.error) profiles = x; sfx("rare"); toast("Your picture: " + C.ACH_BY[el.dataset.id].name + " (" + TIER[el.dataset.d] + ")"); chrome(V()); },
    saveUse: async (el) => { await saving; const r = await Store.call("profile_use", [el.dataset.id]); if (r && r.error) return toast(r.error, true); profiles = r; await reloadSave(); },
    saveDel: (el) => { const P = profiles.list.find((p) => p.id === el.dataset.id); confirmSheet(`Delete the save "${P.name}"? It's kept aside in the game's folder, but it leaves this list.`, "Delete", async () => {
      await saving;
      if (P.id === profiles.active) { const other = profiles.list.find((p) => p.id !== P.id); if (!other) return; const u = await Store.call("profile_use", [other.id]); if (u && u.error) return toast(u.error, true); profiles = u; }   // (the save you're in: to another first)
      const r = await Store.call("profile_delete", [P.id]); if (r && r.error) return toast(r.error, true); profiles = r; await reloadSave(); savesSheet(); }); },
    // start over (Cam, 2 Nov: "a delete option for users"): this save begins again from the tutorial at the difficulty you
    // pick -- a new save in its place; the old one is kept aside in the game's folder, never destroyed
    saveOver: () => { ui.overDiff = ui.overDiff || "easy"; ui.overForget = ui.overForget !== false;
      sheet(`<h2>Start this save over</h2><p class="aa-muted">Back to the very beginning: the tutorial, an empty collection, the road from the Magician. Your achievements stay.</p>
        <div class="aa-muted" style="font-family:var(--head);font-size:12px;letter-spacing:.14em;margin-top:10px">DIFFICULTY</div>${diffPicker(ui.overDiff, "overDiff")}
        <label class="aa-row" style="margin-top:10px"><input type="checkbox" data-a="overForget" ${ui.overForget ? "checked" : ""}> Forget the Library and the Archive too, and find everything again</label>
        <div class="aa-row" style="justify-content:center;margin-top:14px"><button class="aa-btn" data-a="overGo">Start over</button><button class="aa-btn ghost" data-a="saves">Back</button></div>`, true); },
    overDiff: (el) => { ui.overDiff = el.dataset.d; A.saveOver(); },
    overForget: (el) => { ui.overForget = !!el.checked; },
    overGo: () => confirmSheet("Start over? This save's collection and road begin again (the old save is kept aside in the game's folder).", "Start over", () => startOver(firstOpen(ui.overDiff || "easy"), ui.overForget !== false)),
    forgetSheet: () => confirmSheet("Forget the Library and the Archive? Every page, every card you've seen and every keeper's dossier goes, in every save -- you find them all again. (The old record is kept aside in the game's folder.)", "Forget", () => forgetAll()),
    saveNewSheet: () => { ui.newFace = randomCardKey(); newSaveSheet(); },
    newDiff: (el) => { ui.newDiffName = ($("aa-newname") || {}).value || ui.newDiffName || ""; ui.newDiff = el.dataset.d; newSaveSheet(); const n = $("aa-newname"); if (n) n.value = ui.newDiffName; },
    saveNewFace: () => { ui.newFace = randomCardKey(ui.newFace); newSaveSheet(); },
    saveCreate: async () => {
      const name = ($("aa-newname") || {}).value || "", diff = firstOpen(ui.newDiff || "normal");
      await saving;
      const r = await Store.call("profile_new", [{ name, diff, face: ui.newFace }]);
      if (r && r.error) return toast(r.error, true);
      profiles = r; await reloadSave();
    },
    faceDraw: async () => { const r = act("drawFace"); if (!r.ok) return; sfx("flip"); const x = await Store.call("profile_edit", [profiles.active, { face: state.face }]); if (x && !x.error) profiles = x; chrome(V()); savesSheet(); },
    saveRename: async () => { const n = ($("aa-rename") || {}).value || ""; const r = act("rename", { name: n }); if (!r.ok) return; const x = await Store.call("profile_edit", [profiles.active, { name: state.name }]); if (x && !x.error) profiles = x; chrome(V()); toast("Renamed."); savesSheet(); },
    tutNext: () => { ui.tp = (ui.tp || 0) + 1; guideRender(V()); },
    tutDone: () => { const T = TUT[V().tutStep]; ui.tp = 0; if (T && T.done) T.done(); },
    tutAfterDone: () => { const T = TUT[V().tutStep]; ui.tp = 0; ui.tutAfter = false; if (T && T.afterDone) T.afterDone(); },
    tutButton: () => { const T = TUT[V().tutStep]; ui.tp = 0; if (T && T.button) T.button[1](); },
    lessonStart: (el) => lessonStart(el.dataset.ch),
    lessonGo: () => { const st = lesson && CHAPTER[lesson.ch].steps[lesson.i]; if (st) { closeSheet(); go(st.on); } },
    lessonNext: () => { if (!lesson) return; const st = CHAPTER[lesson.ch].steps[lesson.i]; if (lesson.p < st.pages.length - 1) lesson.p++; else { lesson.i++; lesson.p = 0; if (lesson.i >= CHAPTER[lesson.ch].steps.length) return lessonEnd(true);
      const nx = CHAPTER[lesson.ch].steps[lesson.i]; if (nx.on && nx.on !== screen) { closeSheet(); go(nx.on); return; } } guideRender(V()); },
    lessonSkip: () => lessonEnd(true),
    guidebook: () => guidebook(),
    tutGo: () => { const T = TUT[V().tutStep]; if (T && T.on) { closeSheet(); go(T.on); } },
    tipNext: () => { ui.tipPage = (ui.tipPage || 0) + 1; guideRender(V()); },
    tipDone: () => { ui.tipDone = true; guideRender(V()); },
    tutRestart: () => { const r = act("tut", { restart: true }); if (r.ok) { closeSheet(); go(state.tut === 0 ? "home" : "collection"); } },
    newGame: () => confirmSheet("Begin a new collection? Everything you have now -- cards, Moonstones, journal -- is gone for good.", "Begin again", () => { state = C.normal(C.empty()); persist(); go("home"); }),
    claim: (el) => { const r = act("claim", { id: el.dataset.id }); if (r.ok) { sfx("coin"); toast(r.msg); repaint(); } },
    skirmish: () => { const v = V(); sheet(`<h2>Skirmish</h2><div class="aa-stack" style="gap:8px;align-items:center">
      ${["easy", "normal", "hard"].map((d) => `<button class="aa-btn${d === "normal" ? "" : " ghost"}" data-a="fight" data-mode="skirmish" data-diff="${d}">${d[0].toUpperCase() + d.slice(1)} · win +${C.ECON.skirmish[d].win} · lose −${v.lossFor[d]} · up to ${C.ECON.skirmishXp[d].round + C.ECON.skirmishXp[d].win} XP a card</button>`).join("")}</div>
      `, true); },
    keeps: () => {
      const n = C.keepsCount(state), need = C.ECON.keeps.minCards;
      sheet(`<h2>Play for Keeps</h2><p class="aa-muted">A gambler waits at the crossroads. No Moonstones change hands -- the cards do. Only the four drawn into the battle are at stake:</p>
        <ul class="aa-keepsrules"><li><b>Win</b>, and you choose one of their four cards to keep.</li><li><b>Lose</b> (or walk away), and they take the best of your four -- one copy, so a double goes first; if it was your only copy, it's gone.</li><li>A draw: nothing changes hands.</li></ul>
        ${n >= need ? `<div class="aa-row" style="justify-content:center"><button class="aa-btn" data-a="keepsGo">Play for keeps</button><button class="aa-btn ghost" data-a="close">Not today</button></div>`
          : `<p class="aa-bad" style="text-align:center">You need at least ${need} different cards to play for keeps (you have ${n}).</p>`}`, true);
    },
    keepsGo: () => fight("keeps"),
    humble: () => { const r = act("humbleSpread"); if (r.ok) { toast(r.msg); sfx("coin"); repaint(); } },
    circuitStn: (el) => {
      const v = V(), CI = v.circuit, st = CI.stations[+el.dataset.n - 1], over = CI.levels > CI.cap;
      sheet(`<div class="aa-muted">The Apprentice's Circuit · Page ${st.n} of ${CI.stations.length}</div>${cardFace(st.key, "sheet")}<h2>${esc(st.name)}</h2><p class="aa-muted">${esc(st.deck)}${st.field ? " · " + esc(fieldWords(st.field)) : ""}</p>
        <p>${st.n <= CI.cleared ? `Passed this week. Again: +${C.ECON.circuit.replay} Moonstones.` : `First win: <b>+${st.pay}</b> Moonstones${st.n === CI.stations.length ? ", a Seal, and a card from the deck you're nearest to completing" : ""}. A loss costs nothing.`}</p>
        ${over ? `<p class="aa-bad">Your spread's levels come to ${CI.levels}; the Circuit allows ${CI.cap}.</p><div class="aa-row" style="justify-content:center"><button class="aa-btn" data-a="humble">Make a humble spread</button></div>` : `<div class="aa-row" style="justify-content:center"><button class="aa-btn big" data-a="circuitGo" data-n="${st.n}">Face the Page</button></div>`}`, true);
    },
    circuitGo: (el) => fight("circuit", { station: +el.dataset.n }),
    lanHost: async (el) => { await Store.call("lan_me", [meInfo()]); const r = await Store.call("lan_host", [el.dataset.on === "1"]); if (r && r.error) toast(r.error, true); lan.hosting = !!(r && r.hosting); lan.addrs = (r && r.addrs) || []; lan.port = (r && r.port) || lan.port; if (lan.hosting) { lan.role = lan.role || null; lanPoll(); } else { lan.role = null; lan.peer = null; } repaint(); },
    lanScan: async () => { lan.found = "busy"; repaint(); await Store.call("lan_me", [meInfo()]); const r = await Store.call("lan_scan", [[]]).catch(() => null); lan.found = (r && r.hosts) || []; repaint(); },
    lanJoin: (el) => lanJoinTo(el.dataset.addr),
    lanJoinAddr: () => lanJoinTo((($("aa-lanaddr") || {}).value || "").trim()),
    lanLeave: async () => { await Store.call("lan_leave", []); lan.peer = null; lan.role = lan.hosting ? "host" : null; lan.trade = null; repaint(); },
    lanInvite: (el) => { const w = el.dataset.w; if (w === "trade" && tradeBlocked()) return; lanSend({ kind: "invite", what: w, tier: w === "duel" ? duelTier() : null, spread: w === "duel" ? spreadInfo() : null }); toast("Asked " + ((lan.peer && lan.peer.name) || "them") + "…"); },
    lanAccept: () => { const x = lan.invite; closeSheet(); if (!x) return; lanSend({ kind: "accept", what: x.what, tier: x.tier || null, spread: x.what === "duel" ? spreadInfo() : null }); if (x.what === "trade") tradeOpen(); else if (lan.role === "host") lanStartDuel(x.spread, x.tier); lan.invite = null; },
    lanDecline: () => { const x = lan.invite; closeSheet(); if (x) lanSend({ kind: "decline", what: x.what }); lan.invite = null; },
    tradeAdd: (el) => { const T = lan.trade; if (!T || T.lockMine || T.mine.length >= 12) return; T.mine.push(el.dataset.k); lanSend(offerMsg("offer")); tradeSheet(); },
    tradeDrop: (el) => { const T = lan.trade; if (!T || T.lockMine) return; T.mine.splice(+el.dataset.i, 1); lanSend(offerMsg("offer")); tradeSheet(); },
    tradeLock: () => { const T = lan.trade; if (!T) return; T.lockMine = true; lanSend(offerMsg("lock")); tradeSheet(); },
    tradeUnlock: () => { const T = lan.trade; if (!T) return; T.lockMine = false; T.confirmMine = T.confirmTheirs = false; lanSend({ kind: "unlock" }); tradeSheet(); },
    tradeConfirm: () => { const T = lan.trade; if (!T || !T.lockMine || !T.lockTheirs) return; T.confirmMine = true; lanSend({ kind: "confirm" }); tradeMaybeDone(); },
    tradeCancel: () => { if (lan.trade) lanSend({ kind: "tradeCancel" }); lan.trade = null; closeSheet(); },
    lanPeek: () => { lanSend({ kind: "peek" }); toast("Looking at " + ((lan.peer && lan.peer.name) || "their") + "'s collection…"); },
    albumBack: () => (lan.trade ? tradeSheet() : closeSheet()),
    ngpSheet: () => { ui.ngpPick = []; ui.ngpDiff = null; ngpSheet(); },
    ngpDiff: (el) => { ui.ngpDiff = el.dataset.d; ngpSheet(); },
    ngpPick: (el) => { const p = ui.ngpPick || (ui.ngpPick = []), i = p.indexOf(el.dataset.id); if (i >= 0) p.splice(i, 1); else if (p.length < C.NGP.boons) p.push(el.dataset.id); else { p.shift(); p.push(el.dataset.id); } ngpSheet(); },
    ngpGo: () => confirmSheet("Begin New Game+ in a new save? This save stays as it is; you can come back to it from Saves.", "Begin", () => ngpBegin()),
    duel: () => {
      const decks = V().decksSaved.filter((d) => d.ok), others = profiles.list.filter((p) => p.id !== profiles.active);
      sheet(`<h2>Duel a Friend</h2><p class="aa-muted">Player 1 plays your spread; Player 2 picks one below. Nothing changes hands.</p>
        ${duelTierPick("duelTier")}
        <div class="aa-stack" style="gap:8px;align-items:center">${others.map((p) => `<button class="aa-btn" data-a="duelSave" data-id="${p.id}">${cardFace(p.face, "xs")} Player 2: ${esc(p.name)}'s save</button>`).join("")}
        <button class="aa-btn ghost" data-a="duelGo" data-deck="current">Player 2: your current spread (a mirror match)</button>
        <button class="aa-btn${others.length ? " ghost" : ""}" data-a="duelGo" data-deck="">Player 2: a ready-made spread</button>
        ${decks.map((d) => `<button class="aa-btn ghost" data-a="duelGo" data-deck="${esc(d.id)}">Player 2: ${esc(d.name)}</button>`).join("")}</div>
        ${decks.length ? "" : '<p class="aa-muted" style="text-align:center">Save spreads on the Cards page and player 2 can play one of them.</p>'}`, true);
    },
    duelTier: (el) => { ui.duelTier = el.dataset.d; A.duel(); },
    lanTier: (el) => { ui.duelTier = el.dataset.d; repaint(); },
    duelGo: (el) => fight("duel", { deck: el.dataset.deck || "", tier: duelTier() }),
    duelSave: async (el) => {
      const P = profiles.list.find((p) => p.id === el.dataset.id), o = await Store.call("profile_load", [P.id]);
      const x = o && !o.error ? C.normal(o) : null;
      if (!x || !x.made || x.spread.length !== C.DECK) return toast(`${P.name}'s save has no spread of ${C.DECK} yet.`, true);
      fight("duel", { tier: duelTier(), p2: { name: x.name || P.name, face: x.face || P.face, plv: x.plv || 1, keys: x.spread, levels: x.spread.map((k) => (x.cards[k] ? x.cards[k].lv : 1)) } });
    },
    duelReady: () => { ui.curtain = false; ui.turnRound = null; repaint(); },
    buySeal: (el) => { const r = act("buySeal", { id: el.dataset.id }); if (r.ok) { sfx("coin"); toast(r.msg); chrome(V()); repaint(); } },
    setSeal: (el) => { const r = act("setSeal", { id: el.dataset.id || null }); if (r.ok) repaint(); },
    gild: () => { const k = ui.detail || arch.sel, r = act("gild", { key: k }); if (r.ok) { sfx("rare"); toast("✦ " + r.msg); chrome(V()); repaint(); detail(k); } },
    ascend: (el) => { const n = +el.dataset.n, cur = V().camps[0].asc; if (n === cur) return;
      confirmSheet(n ? `Walk the Fool's Journey from the start at Ascension ${n}? Every keeper: ${C.ascText(n)}. A first pass at this level pays well.` : "Walk the Fool's Journey from the start, without Ascension?", n ? `Ascension ${n}` : "Begin again", () => { const r = act("ascend", { n }); if (r.ok) { toast(r.msg); repaint(); } }); },
    jfilter: (el) => { ui.jf = el.dataset.f; repaint(); },
    sandboxSheet: () => sandboxSheet(),
    sandbox: (el) => { const r = act("sandbox", { op: el.dataset.op, n: +el.dataset.n || 0 }); if (!r.ok) return; toast("Done."); if (el.dataset.op === "win") { closeSheet(); ui.koBanner = "The stars favour you"; repaint(); resultSheet(state.battle); } else { chrome(V()); repaint(); sandboxSheet(); } },
    mulliganSheet: () => {
      const B = state.battle, me = B && B.sides[0];
      if (!me || B.round !== 0 || !(B.mulls > 0)) return;
      const r = act("mulliganOffer");
      if (!r.ok) return;
      const spare = r.events.find((e) => e.kind === "offer").keys, out = me.cards[ui.pick];
      sheet(`<h3 style="color:var(--gold3)">Swap ${esc(C.card(out.key).name)} for…</h3><p class="aa-muted">Two cards from the rest of your spread are offered. ${B.mulls} mulligan${B.mulls === 1 ? "" : "s"} left this battle (before the first round); each costs ${C.ECON.mulligan} celestial.</p>
        <div class="aa-keepspick">${spare.map((k) => cardHTML(cv(k), { attrs: `data-a="mulligan" data-key="${esc(k)}"` })).join("")}</div>`, true);
    },
    mulligan: (el) => { const r = act("mulligan", { card: ui.pick, with: el.dataset.key }); if (r.ok) { closeSheet(); sfx("flip"); toast("Swapped in " + C.card(el.dataset.key).name + "."); repaint(); } },
    keepsPick: (el) => { const r = act("keepsClaim", { key: el.dataset.key }); if (r.ok) { const c = r.events.find((e) => e.kind === "keepsClaimed"); sfx("rare"); ui.keepsGot = c; resultSheet(state.battle); } },
    gauntlet: () => { const g = V().gauntlet; sheet(`<h2>Gauntlet</h2><p class="aa-muted">Each win adds to the pot (${C.ECON.gauntlet.base} + ${C.ECON.gauntlet.per} × wins) and the next foe is tougher. Cash out whenever you like; lose, and the pot is gone -- and it costs you half of it in Moonstones.</p>
      ${g ? `<div class="aa-gain">${g.wins} wins · pot ${num(g.pot)}</div>` : ""}<div class="aa-row" style="justify-content:center"><button class="aa-btn" data-a="fight" data-mode="gauntlet">${g ? "Next foe" : "Begin a run"}</button>${g && g.pot ? '<button class="aa-btn ghost" data-a="cashOut">Cash out</button>' : ""}</div>`, true); },
    trial: () => { const t = V().trial; sheet(`<h2>Daily Trial</h2><h3 style="color:var(--verd)">☾ ${esc(t.twist.name)}</h3><p class="aa-muted">${esc(t.twist.text)}. One try a day: ${C.ECON.trial.win} Moonstones for a win; a loss costs ${C.ECON.trial.lose}.</p>
      <div class="aa-row" style="justify-content:center"><button class="aa-btn" data-a="fight" data-mode="trial" ${t.done ? "disabled" : ""}>${t.done ? "Done today" : "Face the trial"}</button></div>`, true); },
    station: (el) => { const cp = V().camps.find((x) => x.id === el.dataset.camp), s = cp.stations[+el.dataset.n - 1]; sheet(`<div class="aa-muted">${esc(cp.name)} · station ${esc(s.numeral)}${s.known ? " · " + esc(s.name) : ""}</div>${s.known ? keeperFace(cp.id, s.n, "sheet") : '<div class="aa-face-img sheet unknown">?</div>'}<h2>${s.known ? esc(s.keeper) : "An unknown keeper"}</h2>
      ${s.known ? `<p class="aa-quote">“${esc(keeperLine(cp.id, s.n))}”</p>` : '<p class="aa-quote">Who waits here, you\'ll learn when you face them.</p>'}${s.known && s.field ? `<p class="aa-fieldline f-${s.field}">${FIELD_GLYPH[s.field]} ${esc(fieldWords(s.field))}</p>` : ""}
      <p class="aa-muted">${s.passed ? "Passed before." : "Not yet passed."} A win pays <b>${s.reward}</b> Moonstones${s.passed ? "" : " and opens the road on"}; a loss costs <b>${s.loss}</b>.${s.main ? ` <span class="aa-bad">A main keeper: lose here and you go back to the start of the road, and every name is hidden again.</span>` : ""}</p>
      <button class="aa-btn" data-a="fight" data-mode="journey" data-camp="${cp.id}" data-n="${s.n}">Challenge</button>`, true); },
    // Fight goes straight to the battle (Cam, PT66 k1); scouting lives in the tent
    fight: (el) => { closePanel(); fight(el.dataset.mode, { diff: el.dataset.diff, camp: el.dataset.camp, station: +el.dataset.n || 0 }); },
    tentSel: (el) => { ui.tentSel = el.dataset.id; repaint(); },
    tentUse: (el) => { const r = act("deckUse", { id: el.dataset.id }); if (r.ok) { sfx("flip"); toast(r.msg); repaint(); } },
    panelClose: () => closePanel(),
    a11y: () => a11ySheet(),
    a11ySet: (el) => { const k = el.dataset.k, raw = el.dataset.v, v = isNaN(+raw) ? raw : +raw; act("prefs", { [k]: v }); applyA11y(); if (k === "text") applyZoom(); const sc = ($("aa-over").querySelector(".aa-sheet") || {}).scrollTop; a11ySheet(); const sh = $("aa-over").querySelector(".aa-sheet"); if (sh && sc) sh.scrollTop = sc; },
    libBook: (el) => { const b = LIB.BOOKS.find((x) => x.id === el.dataset.id); const first = b && b.pages.find((p) => libRead(p.id)); sfx("flip"); bookSheet(el.dataset.id, first && first.id); },
    libPage: (el) => { sfx("tick"); bookSheet(el.dataset.book, el.dataset.id); },
    libOpenAll: () => { const ids = Object.keys(libHave()).filter((id) => !libRead(id) && LIB.PAGE[id]); ids.forEach((id) => { libHave()[id][1] = 1; }); codexSave(); libSync(); sfx("rare");
      const books = [...new Set(ids.map((id) => LIB.PAGE[id].book))].map((b) => LIB.BOOKS.find((x) => x.id === b).title);
      repaint(); toast(`✦ ${ids.length} pages added to ${books.length === 1 ? books[0] : books.length + " books"}`); },
    libOpenPage: (el) => { const id = el.dataset.id, p = LIB.PAGE[id]; if (!p) return; libHave()[id] = [libHave()[id] ? libHave()[id][0] : Date.now(), 1]; codexSave(); libSync(); sfx("rare"); repaint(); bookSheet(p.book, id, true); },
    archSet: (el) => { const k = el.dataset.k; arch[k] = el.dataset.v; if (k === "deck") arch.q = ""; repaint(); },
    cashOut: () => { const r = act("cashOut"); if (r.ok) { sfx("coin"); closeSheet(); toast(r.msg); render(); } },
    pick: (el) => { if (busy) return; ui.pick = +el.dataset.i; sfx("tick"); repaint(); },
    peek: (el) => { const B = state.battle, c = B && B.sides[+el.dataset.side] && B.sides[+el.dataset.side].cards[+el.dataset.i]; if (c) detailBattle(c); },
    cel: (el) => { if (busy) return; const n = +el.dataset.n; ui.cel = ui.cel === n ? n - 1 : n; ui.cel = Math.max(0, ui.cel); sfx("tick"); repaint(); },
    rev: () => { if (busy) return; ui.rev = !ui.rev; repaint(); },
    fury: () => { if (busy) return; ui.fury = !ui.fury; if (ui.fury) sfx("fury"); repaint(); },
    reveal,
    claim2: () => { const B = state.battle; if (B && B.over) resultSheet(B); },
    forfeit: () => state.battle && state.battle.mode === "lan" ? confirmSheet("Leave this duel? It ends for both of you.", "Leave", () => { lanSend({ kind: "end" }); lanDropBattle("You left the duel."); }) : confirmSheet("Walk away from this battle? It counts as a loss.", "Walk away", () => { const r = act("forfeit"); if (r.ok) { repaint(); resultSheet(state.battle); } }),
    leave: () => {
      if (state.battle && state.battle.mode === "lan") { if (lan.role === "guest") { state.battle = null; persist(); } else act("leaveBattle"); closeSheet(); ui = {}; return go("nearby"); }
      // read what the battle opened before ui is cleared (it was read after, so the unlock sheet never showed)
      const B = state.battle, tut = B && B.mode === "tutorial" ? B.opts.n : null, mode = B && B.mode, unlocked = ui.unlocked;
      act("leaveBattle"); closeSheet(); ui = {};
      if (tut === 0) { act("tut", { step: "battle2" }); return go("play"); }
      if (tut === 1) { act("tut", { step: "farewell" }); return go("home"); }
      go(mode ? "play" : "home");                                   // (N75: back to the Battle page, where every fight begins)
      if (unlocked) unlockSheet(unlocked);
    },
    rematch: () => {
      const B = state.battle;
      if (!B || !B.over) return;
      const mode = B.mode, o = mode === "journey" ? { camp: B.opts.camp, station: B.opts.station } : mode === "circuit" ? { station: B.opts.station } : {};
      if (!act("leaveBattle").ok) return;
      closeSheet(); fight(mode, o);
    },
    again: () => { const d = state.battle && state.battle.opts.diff; act("leaveBattle"); closeSheet(); fight("skirmish", { diff: d }); },
    card: (el) => { const k = el.dataset.key || el.closest("[data-key]").dataset.key; ui.feed = {}; if (C.card(k)) detail(k); },
    indeck: () => { const k = ui.detail || arch.sel; if (state.spread.length < C.DECK) { act("spread", { keys: state.spread.concat([k]) }); closeSheet(); repaint(); detail(k); } else replaceSheet(k); },
    replace: (el) => { const keys = state.spread.map((k) => (k === el.dataset.k ? ui.replaceWith : k)); const r = act("spread", { keys }); if (r.ok) { closeSheet(); toast("Spread changed."); repaint(); refreshPanel(); } },
    feed: (el) => {
      const k = el.dataset.k, spare = k === (ui.detail || arch.sel) ? state.cards[k].n - 1 : C.sacrificeable(state, k);
      ui.feed[k] = Math.max(0, Math.min(spare, (ui.feed[k] || 0) + +el.dataset.d));
      const xp = Object.keys(ui.feed).reduce((a, q) => a + (ui.feed[q] || 0) * C.sacrificeXp(q, state.cards[q].lv), 0);
      const nEl = document.querySelector(`[data-feedn="${CSS.escape(k)}"]`), xEl = $("aa-feedxp"), btn = $("aa-sacbtn");
      if (nEl) nEl.textContent = String(ui.feed[k]);
      if (xEl) xEl.textContent = xp ? ` · +${xp} XP chosen` : "";
      if (btn) btn.disabled = !xp;
      sfx("tick");
    },
    deckSave: () => { const nm = ($("aa-deckname") || {}).value || ""; const r = act("deckSave", { name: nm }); if (r.ok) { toast(r.msg); repaint(); } },
    deckUse: (el) => { const r = act("deckUse", { id: el.dataset.id }); if (r.ok) { toast(r.msg); repaint(); } },
    deckDel: (el) => { const d = state.decks.find((x) => x.id === el.dataset.id); if (d) confirmSheet(`Delete the saved spread \u201c${d.name}\u201d? The cards stay yours.`, "Delete", () => { const r = act("deckDelete", { id: d.id }); if (r.ok) repaint(); }); },
    sacrifice: () => {
      const k = ui.detail || arch.sel, gone = Object.keys(ui.feed || {}).filter((q) => (ui.feed[q] || 0) > 0 && (ui.feed[q] || 0) >= state.cards[q].n);
      if (gone.length && !ui.sacOk) { const names = gone.map((q) => C.card(q).name).join(", "); return confirmSheet(`Give ${names} to the Altar for good? ${gone.length === 1 ? "It leaves" : "They leave"} your collection; ${gone.length === 1 ? "its" : "their"} training goes into ${C.card(k).name}.`, "Sacrifice", () => { ui.sacOk = true; detail(k); A.sacrifice(); ui.sacOk = false; }); }
      const r = act("sacrifice", { target: k, feed: ui.feed });
      if (!r.ok) return;
      const e = r.events.find((x) => x.kind === "levelUp");
      ui.feed = {}; repaint(); detail(k); sfx(e.to > e.from ? "rare" : "coin");
      toast(r.msg + (e.max ? " ✦ Maxed!" : ""));
      const big = document.querySelector(".aa-pnl-card .aa-card");
      if (big && e.to > e.from) { big.classList.add("glow-mythic"); later(1700, () => big.classList.remove("glow-mythic")); }
    },
    buyStarter: async () => {
      if (busy) return;
      const r = act("buyStarter");
      if (!r.ok) return;
      chrome(V());
      await openingFX(r.events[0].cards, "starter", "Starter Spread", null);
      if (state.tut != null && state.tut <= 1) { act("tut", { step: "card" }); go("collection"); } else repaint();
    },
    buyPack: async (el) => {
      if (busy) return;
      const deck = el.dataset.deck || null, r = act("buyPack", { deck });
      if (!r.ok) return;
      chrome(V());
      const D = deck ? C.deckOf(deck) : null;
      await openingFX(r.events.find((x) => x.kind === "pack").cards, D ? "deck" : "starlight", D ? D.name : "Starlight", D && D.cover ? imgPath(D.cover, false) : null);
      repaint();
    },
    buyDeck: (el) => { const d = V().decks.find((x) => x.slug === el.dataset.deck); confirmSheet(`Complete ${d.name} for ${num(d.price)} Moonstones?`, "Complete it", () => { const r = act("buyDeck", { deck: d.slug }); if (r.ok) { sfx("rare"); toast(r.msg); repaint(); } }); },
    drawDaily: async (el) => {
      if (busy) return;
      const r = act("daily");
      if (!r.ok) return;
      busy = true;
      $("aa-guide").innerHTML = "";
      const e = r.events[0], fan = $("aa-fan");
      fan.querySelectorAll(".aa-card").forEach((x) => { if (x !== el) x.style.opacity = "0"; });
      el.style.transform = "translateY(-30px) scale(1.5)";
      await wait(450);
      el.insertAdjacentHTML("afterend", cardHTML(cv(e.key), { back: true, big: true, rev: e.rev, attrs: 'style="transform:translateY(-30px) scale(1.5)" id="aa-today"' }));
      el.remove();
      await wait(80);
      $("aa-today").classList.remove("back"); sfx("rare");
      await wait(1300);
      busy = false;
      // the Omen streak's gift: every 7th day running, a Starlight booster (Economist, voted 1 Nov)
      if (e.gift) { toast("✦ " + e.run + " days running -- the stars send " + e.gift.length + " cards: " + e.gift.map((g) => C.card(g.key).name + (g.isNew ? " (new)" : "")).join(", ") + "."); sfx("rare"); }
      if (V().tutStep === "daily") { ui.tutAfter = true; ui.tp = 0; }
      repaint();
    },
    rspread: (el) => { ui.rspread = el.dataset.k; ui.reading = null; repaint(); },
    read: async () => {
      if (busy) return;
      const sel = document.querySelector('[data-a="rdeck"]'), r = act("reading", { deck: sel ? sel.value : "collection", spread: ui.rspread || "three" });
      if (!r.ok) return;
      ui.reading = r.events[0].entry; ui.dealing = true; repaint();
      busy = true;
      for (const el of document.querySelectorAll("#aa-read .aa-card")) { await wait(260); el.classList.remove("back"); sfx("flip"); }
      ui.dealing = false; busy = false;
    },
    unjournal: (el) => confirmSheet("Delete this entry? Its notes go with it.", "Delete", () => { const r = act("unjournal", { id: el.dataset.id }); if (r.ok) repaint(); }),
    musicFolder: async () => { const r = await Store.call("music_folder", []); if (r && r.error) toast(r.error, true); }
  };
  /** Beating the last keeper of a road (the story writer's words, docs/STORY.md). */
  function unlockSheet(what) {
    sfx("rare");
    const N = ART.NPC.selene;
    const say = what === "oracle"
      ? ["The World is yours, seeker -- and with it, the doors behind the World. New Game+ is open on the Battle page, if you'd walk it all again.", "Four oracle decks wake: the Carnival of Souls, the Viking Oracle, the Rooted Woman and the Deadly Apothecary. Their cards will come to you in Orrin's boosters now, and his shelves have their decks.", "And a new road opens: the Veiled Pilgrimage, through the four oracle realms to the Veiled Oracle herself. Her keepers play their own realms' cards. Go carefully."]
      : ["The Veiled Oracle bows. Few come so far.", "Somewhere a door opens onto a parlour of thirty-six small cards -- the Cartomancer's Parlour. Its cards are not yet in this world, but they are coming, and you've earned your place there."];
    sheet(`<div class="aa-result win"><div class="aa-unlockart">${icon(what === "oracle" ? "laurel" : "chest")}</div><h1>${what === "oracle" ? "The World Falls" : "The Veil Lifts"}</h1>${say.map((t) => `<p>${esc(t)}</p>`).join("")}
      <div class="aa-row" style="justify-content:center"><button class="aa-btn" data-a="close">Onward</button></div></div>`, true);
  }
  function detailBattle(c) {
    const b = C.card(c.key), ab = b.ab ? C.ABILITIES[b.ab] : null;
    sheet(`<div class="aa-detail"><div>${cardHTML(battleView(c), { size: "lg", big: true })}</div>
      <div><div class="aa-muted">${esc(b.deckName)}</div><h2>${esc(b.name)}</h2><div class="aa-kv"><span>Power ${c.pow}</span><span>Harm ${c.harm}</span><span>Level ${c.lv}</span>${c.used ? "<span>Played</span>" : ""}</div>
      ${ab ? `<div class="aa-ability"><b>${esc(ab.name)}</b> -- ${esc(ab.text)}</div>` : ""}${identityHTML(b)}</div></div>`);
  }
  document.addEventListener("click", (e) => {
    if (audio && audio.state === "suspended") audio.resume();
    if (state && state.made && !music.el && state.prefs.music) startMusic();
    const el = e.target.closest("[data-a]");
    if (!el || el.tagName === "SELECT" || el.tagName === "TEXTAREA" || el.tagName === "INPUT") return;
    if (el.disabled) return;
    const f = A[el.dataset.a];
    if (f) f(el, e);
  });
  document.addEventListener("contextmenu", (e) => {
    const any = e.target.closest(".aa-card[data-key]");
    if (any && !any.closest(".aa-battle") && !any.closest(".aa-clash") && state && C.card(any.dataset.key)) {
      e.preventDefault(); ui.feed = {};
      detail(any.dataset.key); return;
    }
    const el = e.target.closest(".aa-battle .aa-card[data-side]");
    if (!el || !state || !state.battle) return;
    e.preventDefault();
    const c = state.battle.sides[+el.dataset.side].cards[+el.dataset.i];
    if (c) detailBattle(c);
  });
  document.addEventListener("input", (e) => { if (e.target.id === "aa-archq") { arch.q = e.target.value; const a = $("aa-album"), h = $("aa-albumhead"); if (a) a.innerHTML = albumHTML(V()); if (h && arch.q) h.innerHTML = `Every deck: “${esc(arch.q)}”`; return; } });
  document.addEventListener("input", (e) => { if (e.target.closest && e.target.closest(".aa-tfilters")) tileFilter(e.target.closest(".aa-tbox")); });
  document.addEventListener("change", (e) => {
    if (e.target.closest && e.target.closest(".aa-tfilters")) return tileFilter(e.target.closest(".aa-tbox"));
    const el = e.target.closest("[data-a]");
    if (!el) return;
    if (el.dataset.a === "deckFilter") { arch.deck = el.value; repaint(); }
    if (el.dataset.a === "archPick") { arch[el.dataset.k] = el.value; repaint(); }
    if (el.dataset.a === "overForget") ui.overForget = !!el.checked;
    if (el.dataset.a === "a11yTog") { act("prefs", { [el.dataset.k]: !!el.checked }); applyA11y(); }
    if (el.dataset.a === "deckPick" && el.value) { const r = act("deckUse", { id: el.value }); if (r.ok) toast(r.msg); repaint(); }
    if (el.dataset.a === "timer") { act("prefs", { timer: +el.value }); }
    if (el.dataset.a === "textsize") { act("prefs", { text: +el.value }); applyZoom(); }
    if (el.dataset.a === "rdeck") { ui.rdeck = el.value; ui.reading = null; repaint(); }
    if (el.dataset.a === "note") act("note", { id: el.dataset.id, text: el.value });
    if (el.dataset.a === "pref") { act("prefs", { [el.dataset.k]: el.checked }); musicPrefs(); chrome(V()); }
    if (el.dataset.a === "vol") { act("prefs", { vol: +el.value }); musicPrefs(); }
  });
  document.addEventListener("keydown", (e) => {
    if (e.target && (e.target.tagName === "TEXTAREA" || e.target.tagName === "INPUT")) return;
    if (e.key === "Escape" && ($("aa-panel") || {}).classList && $("aa-panel").classList.contains("open") && !$("aa-over").innerHTML) { closePanel(); return; }
    if (e.key === "Escape" && $("aa-over").innerHTML) userClose();
    const B = state && state.battle;
    if (screen === "battle" && !busy && B && !B.over && !$("aa-over").innerHTML) {
      const mine = B.sides[duelMe(B)];
      if (ui.curtain) return;
      if (/^[1-4]$/.test(e.key)) { const i = +e.key - 1; if (mine.cards[i] && !mine.cards[i].used) { ui.pick = i; repaint(); } }
      if (e.key === "ArrowUp" || e.key === "+") { ui.cel = (ui.cel || 0) + 1; repaint(); }
      if (e.key === "ArrowDown" || e.key === "-") { ui.cel = Math.max(0, (ui.cel || 0) - 1); repaint(); }
      if (e.key === "r" || e.key === "R") { ui.rev = !ui.rev; repaint(); }
      if ((e.key === "f" || e.key === "F") && mine.cel >= B.fury) { ui.fury = !ui.fury; repaint(); }
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); reveal(); }
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") { const free = mine.cards.map((c, i) => (c.used ? -1 : i)).filter((i) => i >= 0), at = free.indexOf(ui.pick); if (free.length) { ui.pick = free[(at + (e.key === "ArrowRight" ? 1 : free.length - 1)) % free.length]; repaint(); } }
      if (e.key === "m" || e.key === "M") { if (!twoPlayer(B) && B.round === 0 && !B.log.length && (B.mulls || 0) > 0) A.mulliganSheet(); else toast(twoPlayer(B) ? "No mulligans in a duel." : B.round > 0 ? "A mulligan is only before the first round." : "No mulligans left in this battle.", true); }
    }
  });

  // text size (UX, voted 1 Nov): the whole page scales, as the window's own zoom does
  function applyZoom() {
    const z = (state && state.prefs && state.prefs.text) || 1;
    Store.call("zoom", [z]).then((r) => { document.documentElement.style.zoom = r && r.zoom ? "" : (z === 1 ? "" : String(z)); }).catch(() => { document.documentElement.style.zoom = z === 1 ? "" : String(z); });
  }
  async function init() {
    document.body.innerHTML = frameHTML();
    document.documentElement.style.setProperty("--corner", ART.cornerURL);
    try { const p = await Store.call("profiles", []); if (p && Array.isArray(p.list)) profiles = p; } catch (e) { /* one save */ }
    // the catalogue: Cam's decks from the art folder, and the game's own (decks.js -- the Gilded Observatory)
    const own = Array.isArray(window.ArcanaOwnDecks) ? window.ArcanaOwnDecks : [];
    try { const cat = await Store.call("catalogue", []); const theirs = cat && !cat.error && Array.isArray(cat.decks) ? cat.decks : []; C.useCatalogue(theirs.length || own.length ? { v: 1, decks: theirs.concat(own) } : null); } catch (e) { C.useCatalogue(own.length ? { v: 1, decks: own } : null); }
    if (LIB && LIB.deckBooks) LIB.deckBooks(C.catalogue());            // (each deck's guidebook, from its own words)
    let saved = null;
    try { saved = await Store.call("load", []); } catch (e) { saved = null; }
    state = C.normal(saved && !saved.error ? saved : C.empty());
    applyZoom(); applyA11y();
    await loadDiary();
    await loadCodex();
    catchUpAchievements();
    libCheck(); libSync();
    if (state.made && state.diff !== "free" && state.ach && Object.keys(state.ach).length) Store.call("ach_add", [state.diff, { ids: Object.keys(state.ach), by: state.name || activeProfile().name }]).then((x) => { if (x && x.easy) diaryRec = x; }).catch(() => {});
    if (state.battle && state.battle.over && !(state.battle.keeps && state.battle.keeps.won === null)) state.battle = null;
    if (state.battle) screen = "battle";
    else if (state.made && state.tut != null && C.TUT_STEPS[state.tut] === "card") screen = "collection";
    render();
  }
  init();
})();
