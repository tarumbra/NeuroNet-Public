/* ==========================================================================
   Grid world -- a prototype (Collaboration project "Grid game", 2026-10-18).

   Cam: "build a prototype of the grid based approach. It should show the main areas on the main island only and i should be
   able to enter the areas. So when going into a foraging, digging node etc it will start collecting. Add some sound in the
   prototype test as well. It should contain only the hunter and berserker in order to test it."

   RuneScape / RPG MO style: the main island as a tile grid; click a tile to walk (the shortest way round), walk into an area's
   gate to go in, click a node to walk up to it and keep gathering, click a creature to fight it. Everything it knows -- the
   gathering spots, their levels, finds and xp, the creatures and their drops, the two classes' specials, the pictures -- comes
   from the game itself (window.PetCore, window.PetArt). Its save is its own (localStorage "np:grid"); nothing touches your game.
   ========================================================================== */
(function () {
  "use strict";
  const Core = window.PetCore, Art = window.PetArt;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const rnd = Math.random, pickW = (list) => { const t = list.reduce((a, x) => a + x[1], 0); let r = rnd() * t; for (const x of list) { r -= x[1]; if (r < 0) return x[0]; } return list[list.length - 1][0]; };

  // ---- the main island (the other islands, the sea and the Misty Isle wait for the real thing) ----
  const MAIN = ["village", "farmyard", "pasture", "meadow", "forest", "deepforest", "coast", "jungle", "deepjungle", "crystalcaves", "magetower"];
  const GATHER = ["foraging", "fishing", "mining", "lumbering", "digging"];
  const SKILL_LIST = ["attack", "ranged", "defence", "hitpoints", "foraging", "fishing", "mining", "lumbering", "digging", "cooking"];
  const THEME = {   // each area's ground: [grass, path, water, wall/decor] and the kind of decor it's thick with
    village: {g: "#7fae58", p: "#c9a46a", w: "#4f8fc0", d: "house", amb: "village"}, farmyard: {g: "#86b55a", p: "#b98f55", w: "#5a9ac8", d: "fence", amb: "birds"},
    pasture: {g: "#8cbf5e", p: "#bd9a5e", w: "#5598c4", d: "bush", amb: "birds"}, meadow: {g: "#9cc766", p: "#c4a36a", w: "#5a9ac8", d: "flower", amb: "birds"},
    forest: {g: "#5f9442", p: "#9c7a48", w: "#4a86b0", d: "tree", amb: "forest"}, deepforest: {g: "#3f7034", p: "#7d6440", w: "#3f789c", d: "tree", amb: "forest"},
    coast: {g: "#d9c48c", p: "#c7ad72", w: "#3f8fc4", d: "rock", amb: "waves"}, jungle: {g: "#4f8c3a", p: "#8a6a3c", w: "#3d8c8c", d: "tree", amb: "jungle"},
    deepjungle: {g: "#356e2c", p: "#6f5532", w: "#2f7a7a", d: "tree", amb: "jungle"}, crystalcaves: {g: "#5a5a6e", p: "#77778c", w: "#4f7fb0", d: "crystal", amb: "cave"},
    magetower: {g: "#6f6a8a", p: "#9a94b4", w: "#5a7fc0", d: "rock", amb: "cave"}, world: {g: "#7fae58", p: "#c9a46a", w: "#3f86bf", d: "tree", amb: "birds"}};
  const T = 32;                                   // tile size (pixels, before the stage's scale)
  // SPEED (Cam, PT22 q3: "RPG MO has a great feature called speed ... You start off walking slow until you unlock better gear
  // that increases speed. For example killing snakes for extended time you will get reptile boots") -- a first try: you walk a
  // tile every STEP ms, less with speed gear; the prototype's one piece is the reptile boots, now and then from a snake.
  const STEP = 280;
  const PROTO_ITEMS = {reptileboots: {name: "Reptile boots", iconAs: "fleetboots", speed: 0.3, about: "Scaled snakeskin boots: you walk 30% faster. A snake drops a pair now and then (1 in 40)."}};
  const SPEED_DROPS = {snake: ["reptileboots", 40], anaconda: ["reptileboots", 25]};
  const itemName = (id) => (PROTO_ITEMS[id] || Core.ITEMS[id] || {name: id}).name;
  const ROUND = 1800;                             // a fight's round (the game's is longer -- a prototype should feel lively)

  // ---- sound: everything is made on the fly with WebAudio -- no files ----
  const Sfx = (() => {
    let ctx = null, master = null, on = true, vol = 0.6, amb = null, ambKind = "";
    const start = () => { if (ctx) return; try { ctx = new (window.AudioContext || window.webkitAudioContext)(); master = ctx.createGain(); master.gain.value = vol; master.connect(ctx.destination); } catch (e) { ctx = null; } };
    const noise = (dur) => { const b = ctx.createBuffer(1, Math.max(1, ctx.sampleRate * dur), ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1; const s = ctx.createBufferSource(); s.buffer = b; return s; };
    const env = (node, t0, a, peak, dec) => { const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + dec); node.connect(g); g.connect(master); return g; };
    const tone = (f, dur, type, peak, at, glide) => { if (!ctx || !on) return; const t0 = ctx.currentTime + (at || 0), o = ctx.createOscillator(); o.type = type || "sine"; o.frequency.setValueAtTime(f, t0); if (glide) o.frequency.exponentialRampToValueAtTime(glide, t0 + dur); env(o, t0, 0.005, peak || 0.2, dur); o.start(t0); o.stop(t0 + dur + 0.05); };
    const hiss = (dur, freq, q, peak, at, type) => { if (!ctx || !on) return; const t0 = ctx.currentTime + (at || 0), n = noise(dur + 0.05), f = ctx.createBiquadFilter(); f.type = type || "bandpass"; f.frequency.value = freq; f.Q.value = q || 1; n.connect(f); env(f, t0, 0.004, peak || 0.25, dur); n.start(t0); n.stop(t0 + dur + 0.05); };
    const play = {
      step: () => hiss(0.05, 900 + rnd() * 300, 2, 0.05),
      click: () => tone(660, 0.05, "square", 0.04),
      chop: () => { hiss(0.08, 1800, 3, 0.35); tone(110, 0.12, "triangle", 0.25, 0, 70); },
      mine: () => { tone(1400 + rnd() * 300, 0.25, "square", 0.08); tone(2100, 0.18, "sine", 0.1, 0.01); hiss(0.05, 4000, 4, 0.2); },
      pick: () => { tone(520 + rnd() * 80, 0.08, "triangle", 0.15, 0, 900); hiss(0.06, 3000, 2, 0.08); },
      dig: () => { hiss(0.18, 400, 1, 0.35, 0, "lowpass"); hiss(0.1, 900, 1.5, 0.15, 0.08); },
      fish: () => { hiss(0.25, 1500, 0.8, 0.22); tone(300, 0.2, "sine", 0.08, 0.02, 180); },
      loot: () => { tone(880, 0.07, "triangle", 0.12); tone(1320, 0.09, "triangle", 0.1, 0.06); },
      rare: () => { [880, 1108, 1320, 1760].forEach((f, i) => tone(f, 0.18, "triangle", 0.14, i * 0.07)); },
      level: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.28, "square", 0.08, i * 0.09)); },
      swing: () => hiss(0.12, 1200, 0.7, 0.2, 0, "highpass"),
      arrow: () => { tone(900, 0.06, "triangle", 0.12, 0, 300); hiss(0.18, 2500, 1, 0.12, 0.02, "highpass"); },
      hit: () => { tone(160, 0.12, "square", 0.2, 0, 60); hiss(0.07, 700, 1, 0.25); },
      miss: () => hiss(0.1, 2200, 1, 0.08, 0, "highpass"),
      hurt: () => { tone(220, 0.18, "sawtooth", 0.12, 0, 110); },
      roar: () => { tone(140, 0.4, "sawtooth", 0.14, 0, 70); hiss(0.35, 500, 0.7, 0.12); },
      die: () => { tone(300, 0.5, "triangle", 0.15, 0, 60); },
      eat: () => { [0, 0.12, 0.24].forEach((a) => hiss(0.06, 1200, 2, 0.15, a)); },
      special: () => { tone(330, 0.25, "sawtooth", 0.12, 0, 660); tone(660, 0.3, "square", 0.06, 0.1, 990); },
      gate: () => { hiss(0.6, 600, 0.5, 0.15, 0, "lowpass"); tone(392, 0.35, "sine", 0.08, 0.1, 523); },
      deny: () => { tone(200, 0.12, "square", 0.08); tone(150, 0.16, "square", 0.08, 0.1); },
      cook: () => { hiss(0.5, 2500, 0.6, 0.12, 0, "highpass"); },
    };
    // the area's ambience: a soft bed of noise and the odd bird, wave or drip
    function ambient(kind) {
      if (!ctx || ambKind === kind) return;
      ambKind = kind;
      if (amb) { try { amb.src.stop(); } catch (e) { /* already */ } clearInterval(amb.timer); amb = null; }
      if (!kind) return;
      const src = noise(4), f = ctx.createBiquadFilter(), g = ctx.createGain();
      src.loop = true; f.type = "lowpass"; f.frequency.value = kind === "waves" ? 500 : kind === "cave" ? 300 : 900; g.gain.value = kind === "waves" ? 0.06 : 0.025;
      src.connect(f); f.connect(g); g.connect(master); src.start();
      let lfo = null;
      if (kind === "waves") { lfo = ctx.createOscillator(); const lg = ctx.createGain(); lfo.frequency.value = 0.12; lg.gain.value = 0.05; lfo.connect(lg); lg.connect(g.gain); lfo.start(); }
      const timer = setInterval(() => {
        if (!on) return;
        if ((kind === "birds" || kind === "forest" || kind === "village") && rnd() < 0.45) { const f0 = 2200 + rnd() * 1800; tone(f0, 0.07, "sine", 0.05, 0, f0 * 1.3); tone(f0 * 1.1, 0.06, "sine", 0.04, 0.1, f0 * 1.4); }
        if (kind === "forest" && rnd() < 0.15) tone(400, 0.25, "sine", 0.04, 0, 300);
        if (kind === "jungle" && rnd() < 0.6) { const f0 = 1200 + rnd() * 2400; for (let i = 0; i < 4; i++) tone(f0, 0.04, "square", 0.015, i * 0.06); }
        if (kind === "cave" && rnd() < 0.35) tone(1800 + rnd() * 900, 0.15, "sine", 0.05, 0, 900);
      }, 1400);
      amb = {src, timer, lfo};
    }
    return {start, play: (k) => { if (ctx && on && play[k]) try { play[k](); } catch (e) { /* never stop the game for a sound */ } },
            ambient, get on() { return on; }, set on(v) { on = !!v; if (master) master.gain.value = on ? vol : 0; },
            setVol(v) { vol = v; if (master) master.gain.value = on ? vol : 0; }};
  })();

  // ---- pictures ----
  const imgs = {};
  function img(src) { if (!src) return null; if (!imgs[src]) { const i = new Image(); i.src = src; imgs[src] = i; } return imgs[src].complete && imgs[src].naturalWidth ? imgs[src] : null; }
  const pix = {};
  function pixelURL(rows, pal, flip) { const k = JSON.stringify([rows, pal, flip]); if (pix[k]) return pix[k]; const c = document.createElement("canvas"), sc = 3; c.width = rows[0].length * sc; c.height = rows.length * sc; Art.draw(c.getContext("2d"), rows, pal, 0, 0, sc, !!flip); return (pix[k] = c.toDataURL()); }
  function itemSrc(id) { if (PROTO_ITEMS[id]) return itemSrc(PROTO_ITEMS[id].iconAs); const it = Core.ITEMS[id]; if (it && it.iconAs && !(window.PET_ICONS || {})[id]) return itemSrc(it.iconAs); if ((window.PET_ICONS || {})[id]) return "../art/icons/" + id + ".webp"; const a = Art.itemArt(id) || Art.item(id); return a ? pixelURL(a.rows, a.pal) : ""; }
  function monSrc(id) { if ((window.MONSTER_PICS || {})[id]) return "../art/creatures/" + id + ".webp"; const m = Art.monster(id); return m ? pixelURL(m.rows, m.pal, true) : ""; }

  // ---- the save (the prototype's own) ----
  const KEY = "np:grid";
  let S = null;
  const fresh = (cls, body) => ({cls, body, skills: Object.fromEntries(SKILL_LIST.map((k) => [k, k === "hitpoints" ? Core.XP[10] : 0])), bag: cls === "hunter" ? {shrimps: 5} : {shrimps: 5},
                                 hp: 0, spec: 100, fury: 0, map: "world", at: null, testOpen: true});
  function load() { try { const v = JSON.parse(localStorage.getItem(KEY) || "null"); if (v && v.skills) S = v; } catch (e) { S = null; } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* private window: it lasts the session */ } }
  const lvl = (k) => Core.levelOf(S.skills[k] || 0);
  const maxHp = () => lvl("hitpoints");

  // ---- maps ----
  const maps = {};
  /** The main island: a meadow ringed by sea, a road between linked areas, each area a signposted gate. */
  function worldMap() {
    if (maps.world) return maps.world;
    const W = 44, H = 28, m = {id: "world", name: "The main island", W, H, tiles: [], deco: {}, gates: {}, nodes: [], mons: [], theme: THEME.world};
    for (let y = 0; y < H; y++) { m.tiles.push([]); for (let x = 0; x < W; x++) { const e = Math.min(x, y, W - 1 - x, H - 1 - y); m.tiles[y].push(e < 2 || (e < 3 && rnd() < 0.35) ? "w" : "g"); } }
    const pos = {}; MAIN.forEach((r) => { const R = Core.REGIONS[r]; pos[r] = [Math.round(4 + R.x / 100 * (W - 9)), Math.round(4 + R.y / 100 * (H - 9))]; });
    const road = (a, b) => { let [x, y] = a; const [tx, ty] = b; while (x !== tx || y !== ty) { if (x !== tx && (rnd() < 0.6 || y === ty)) x += Math.sign(tx - x); else y += Math.sign(ty - y); if (m.tiles[y][x] === "g") m.tiles[y][x] = "p"; } };
    const links = Core.worldView(Core.advance(Core.empty(), Date.now()), Date.now()).links.filter(([a, b]) => MAIN.includes(a) && MAIN.includes(b));
    links.forEach(([a, b]) => road(pos[a], pos[b]));
    MAIN.forEach((r) => { const [x, y] = pos[r]; m.tiles[y][x] = "gate"; m.gates[x + "," + y] = r; });
    for (let i = 0; i < 160; i++) { const x = 3 + Math.floor(rnd() * (W - 6)), y = 3 + Math.floor(rnd() * (H - 6)); if (m.tiles[y][x] === "g" && !near(m, x, y, 1, "gate") && !near(m, x, y, 0, "p")) m.deco[x + "," + y] = rnd() < 0.7 ? "tree" : "rock"; }
    m.start = pos.village.slice(); m.start[1] += 1;
    m.pos = pos;
    return (maps.world = m);
  }
  function near(m, x, y, d, kind) { for (let j = -d; j <= d; j++) for (let i = -d; i <= d; i++) { const t = (m.tiles[y + j] || [])[x + i]; if (t === kind) return true; } return false; }
  /** An area: its own ground, a pond, its gathering spots as nodes, its creatures on a hunting ground, and the way out. */
  function areaMap(r) {
    if (maps[r]) return maps[r];
    const th = THEME[r] || THEME.meadow, W = 30, H = 20, m = {id: r, name: Core.REGIONS[r].name, level: Core.REGIONS[r].level, W, H, tiles: [], deco: {}, gates: {}, nodes: [], mons: [], theme: th, hunt: Core.HUNTS[r] || null};
    for (let y = 0; y < H; y++) { m.tiles.push([]); for (let x = 0; x < W; x++) m.tiles[y].push(x === 0 || y === 0 || x === W - 1 || y === H - 1 ? "edge" : "g"); }
    // a pond (top right) for the fishing spots; the coast's is the sea along the top
    if (r === "coast") { for (let y = 1; y < 5; y++) for (let x = 1; x < W - 1; x++) m.tiles[y][x] = "w"; }
    else { for (let y = 2; y < 6; y++) for (let x = W - 9; x < W - 2; x++) if ((x - (W - 5.5)) ** 2 / 12 + (y - 4) ** 2 / 3.5 < 1) m.tiles[y][x] = "w"; }
    // a path from the way out (bottom middle) up through the middle
    const gx = Math.floor(W / 2); for (let y = 3; y < H - 1; y++) m.tiles[y][gx] = "p"; for (let x = 3; x < W - 3; x++) m.tiles[10][x] = "p";
    m.tiles[H - 1][gx] = "gate"; m.gates[gx + "," + (H - 1)] = "world"; m.start = [gx, H - 2];
    // the nodes: every gathering spot in this area, grouped by skill (no essence veins -- they're the Runecrafting skill's)
    const spots = []; GATHER.forEach((k) => (Core.SKILLS[k].spots || []).forEach((sp) => { if (sp.area === r && !/^essence/.test(sp.id) && !sp.secret) spots.push({skill: k, sp}); }));
    const free = (x, y) => m.tiles[y] && m.tiles[y][x] === "g" && !m.deco[x + "," + y] && !m.nodes.some((n) => n.x === x && n.y === y);
    const zone = {lumbering: [2, 2, 11, 8], foraging: [2, 12, 11, 17], mining: [17, 12, 27, 17], digging: [9, 12, 18, 17]};
    spots.forEach(({skill, sp}, i) => {
      let x = 0, y = 0, tries = 0;
      if (skill === "fishing") {   // on the water's edge
        const edge = []; for (let yy = 1; yy < H - 1; yy++) for (let xx = 1; xx < W - 1; xx++) if (m.tiles[yy][xx] === "w" && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => free(xx + a, yy + b))) edge.push([xx, yy]);
        do { [x, y] = edge[Math.floor(rnd() * edge.length)] || [W - 6, 4]; } while (m.nodes.some((n) => n.x === x && n.y === y) && ++tries < 30);
      } else { const z = zone[skill]; do { x = z[0] + Math.floor(rnd() * (z[2] - z[0])); y = z[1] + Math.floor(rnd() * (z[3] - z[1])); } while (!free(x, y) && ++tries < 60); }
      for (let c = 0; c < (skill === "fishing" ? 1 : 2); c++) {   // two of each tree, rock, bush, mound -- one fishing spot each
        let nx = x, ny = y;
        if (c) { let t2 = 0; do { nx = x + Math.floor(rnd() * 5) - 2; ny = y + Math.floor(rnd() * 3) - 1; } while (!free(nx, ny) && ++t2 < 30); if (!free(nx, ny)) continue; }
        m.nodes.push({x: nx, y: ny, skill, sp, left: 0, emptyUntil: 0});
      }
    });
    // decor and the hunting ground (the middle right)
    for (let i = 0; i < 45; i++) { const x = 1 + Math.floor(rnd() * (W - 2)), y = 1 + Math.floor(rnd() * (H - 2)); if (free(x, y) && !(x > 16 && y > 5 && y < 10) && Math.abs(x - gx) > 1 && y !== 10) m.deco[x + "," + y] = th.d === "flower" && rnd() < 0.6 ? "flower" : th.d === "crystal" ? "crystal" : rnd() < 0.5 ? "tree" : "rock"; }
    if (m.hunt) { m.huntZone = [1, 1, W - 2, H - 4]; for (let i = 0; i < 11; i++) spawnMon(m); }   // all over the area (PT22: "they all stay on the top right")
    if (r === "village") { m.fire = [gx + 3, 9]; m.tiles[9][gx + 3] = "fire"; }
    return (maps[r] = m);
  }
  function spawnMon(m) {
    const z = m.huntZone, id = pickW(m.hunt.monsters.filter((x) => !x[2] || x[2] === (Core.isNight(Date.now()) ? "night" : "day")).map((x) => [x[0], x[1]]));
    let x, y, t = 0; do { x = z[0] + Math.floor(rnd() * (z[2] - z[0])); y = z[1] + Math.floor(rnd() * (z[3] - z[1])); }
    while ((!walkable(m, x, y) || Math.abs(x - m.start[0]) + Math.abs(y - m.start[1]) < 5 || m.mons.some((o) => Math.abs(o.x - x) + Math.abs(o.y - y) < 3)) && ++t < 80);
    const M = Core.MONSTERS[id];
    m.mons.push({id, x, y, fx: x, fy: y, hp: M.hp, max: M.hp, next: Date.now() + 1500 + rnd() * 3000, aggro: false, home: [x, y]});
  }
  function walkable(m, x, y) {
    const t = (m.tiles[y] || [])[x];
    if (!t || t === "w" || t === "edge" || t === "fire") return false;
    if (m.deco[x + "," + y]) return false;
    if (m.nodes.some((n) => n.x === x && n.y === y)) return false;
    return true;
  }
  /** The shortest way (4 directions) to the goal, or to the nearest free tile beside it. */
  function path(m, from, to, besideOnly, range) {
    const key = (x, y) => x + "," + y, goal = (x, y) => range ? Math.max(Math.abs(x - to[0]), Math.abs(y - to[1])) <= range : besideOnly ? Math.abs(x - to[0]) + Math.abs(y - to[1]) === 1 : x === to[0] && y === to[1];
    if (goal(from[0], from[1])) return [];
    const q = [from], prev = {[key(...from)]: null};
    while (q.length) {
      const [x, y] = q.shift();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, k = key(nx, ny);
        if (k in prev) continue;
        if (!walkable(m, nx, ny) && !(m.tiles[ny] && m.tiles[ny][nx] === "gate" && !besideOnly && !range)) continue;
        prev[k] = [x, y];
        if (goal(nx, ny)) { const out = []; let c = [nx, ny]; while (c && !(c[0] === from[0] && c[1] === from[1])) { out.unshift(c); c = prev[key(...c)]; } return out; }
        q.push([nx, ny]);
      }
    }
    return null;
  }

  // ---- the player ----
  const P = {x: 0, y: 0, fx: 0, fy: 0, path: [], stepAt: 0, job: null, target: null, face: 1};
  let map = null;
  function enter(id, at) {
    map = id === "world" ? worldMap() : areaMap(id);
    S.map = id;
    const st = at || map.start;
    P.x = P.fx = st[0]; P.y = P.fy = st[1]; P.path = []; P.job = null; P.target = null;
    $("g-area").textContent = map.name; $("g-areasub").textContent = map.id === "world" ? " · walk into a signpost to go in" : ` · level ${map.level}${map.hunt ? " · hunting ground: " + map.hunt.name : ""}`;
    Sfx.ambient(map.theme.amb);
    if (id !== "world") say(`You enter the ${map.name}.`, "info");
    resize(); save(); drawPane();
  }
  function stopJob() { P.job = null; P.target = null; }
  function walkTo(x, y) { const p = path(map, [P.x, P.y], [x, y]); if (!p) { Sfx.play("deny"); return false; } P.path = p; stopJob(); return true; }   // (stopJob drops the target: it heals)

  // ---- clicks on the world ----
  function clickTile(x, y) {
    Sfx.play("click");
    const mon = map.mons.find((mm) => mm.hp > 0 && Math.round(mm.fx) === x && Math.round(mm.fy) === y);
    if (mon) return attack(mon);
    const node = map.nodes.find((n) => n.x === x && n.y === y);
    if (node) return gather(node);
    if (map.fire && map.fire[0] === x && map.fire[1] === y) return cook();
    if (walkable(map, x, y) || (map.tiles[y] && map.tiles[y][x] === "gate")) walkTo(x, y);
  }
  function gather(node) {
    const need = node.sp.level, have = lvl(node.skill);
    if (!S.testOpen && have < need) { Sfx.play("deny"); return say(`The ${node.sp.name} needs ${Core.SKILLS[node.skill].name} level ${need} (you're ${have}).`, "bad"); }
    if (bagFull()) { Sfx.play("deny"); return say("Your bag is full -- drop something (right-click it).", "bad"); }
    const p = path(map, [P.x, P.y], [node.x, node.y], true);
    if (!p) { Sfx.play("deny"); return say("You can't get there from here.", "bad"); }
    P.path = p; P.job = {kind: "gather", node, next: 0}; P.target = null;
    say(`You head for the ${node.sp.name}.`);
  }
  const combatLevel = () => Core.combatLevel({skills: S.skills});
  function attack(mon) {
    const M = Core.MONSTERS[mon.id];
    if (map.hunt && !S.testHunt && combatLevel() < map.hunt.level) { Sfx.play("deny"); return say(`The ${map.name}'s creatures need combat level ${map.hunt.level} -- you're ${combatLevel()}. Train somewhere easier first.`, "bad"); }
    P.job = {kind: "fight", mon, next: 0}; P.target = mon; mon.aggro = true;
    P.path = path(map, [P.x, P.y], [Math.round(mon.fx), Math.round(mon.fy)], S.cls !== "hunter", S.cls === "hunter" ? 4 : 0) || [];
    say(`You attack the ${M.name.toLowerCase()}.`);
    if (M.boss || rnd() < 0.3) Sfx.play("roar");
  }
  function cook() {
    const raw = Object.keys(S.bag).filter((k) => S.bag[k] > 0 && cookOf(k));
    const p = path(map, [P.x, P.y], map.fire, true);
    if (!raw.length) { Sfx.play("deny"); return say("Nothing raw in your bag to cook -- catch some fish first.", "bad"); }
    P.path = p || []; P.job = {kind: "cook", next: 0};
  }
  function cookOf(raw) { const r = (Core.WORKSHOPS.kitchen.recipes || []).find((x) => x.needs && x.needs[raw] && Object.keys(x.needs).length <= 2); return r && Core.ITEMS[r.make] && Core.ITEMS[r.make].heal ? r : null; }

  // ---- the bag (28 slots, a kind a slot, RuneScape-style) ----
  const BAG = 28;
  const bagKinds = () => Object.keys(S.bag).filter((k) => S.bag[k] > 0);
  const bagFull = () => bagKinds().length >= BAG;
  function give(id, n) { if (!(S.bag[id] > 0) && bagFull()) { say(`No room for the ${itemName(id).toLowerCase()} -- your bag is full.`, "bad"); return false; } S.bag[id] = (S.bag[id] || 0) + n; return true; }
  function addXp(skill, xp) {
    const before = lvl(skill);
    S.skills[skill] = (S.skills[skill] || 0) + xp;
    const after = lvl(skill);
    if (after > before) { Sfx.play("level"); say(`Congratulations -- ${Core.SKILLS[skill].name} level ${after}!`, "good"); float(P.x, P.y, `${Core.SKILLS[skill].name} ${after}!`, "lv"); }
  }

  // ---- the world ticking on ----
  function tick(now) {
    // walking: a tile every 200 ms
    if (P.path.length && now >= P.stepAt) {
      const [nx, ny] = P.path[0];
      const gate = map.tiles[ny] && map.tiles[ny][nx] === "gate";
      if (!walkable(map, nx, ny) && !gate) { P.path = []; }
      else {
        P.path.shift(); P.face = nx > P.x ? 1 : nx < P.x ? -1 : P.face; P.x = nx; P.y = ny; P.stepAt = now + Math.round(STEP / (1 + speed())); Sfx.play("step");
        if (gate) { const to = map.gates[nx + "," + ny]; Sfx.play("gate"); if (to === "world") return enter("world", nearGate(worldMap(), map.id)); return enter(to); }
      }
    }
    P.fx += (P.x - P.fx) * 0.35; P.fy += (P.y - P.fy) * 0.35;
    const j = P.job;
    if (j && !P.path.length && j.kind === "gather") {
      const n = j.node;
      if (n.emptyUntil > now) { if (!j.waitSaid) { say(`Nothing more at the ${n.sp.name.toLowerCase()} for now -- it'll come back in a few seconds.`); j.waitSaid = true; } }
      else if (!j.next) { j.next = now + n.sp.time * 1000; P.face = n.x >= P.x ? 1 : -1; }
      else if (now >= j.next) {
        if (bagFull() && !Object.keys(S.bag).includes(n.sp.loot[0][0])) { say("Your bag is full.", "bad"); P.job = null; return; }
        const rare = n.sp.rare && rnd() < 1 / n.sp.rare[1];
        const id = rare ? n.sp.rare[0] : pickW(n.sp.loot);
        if (give(id, 1)) {
          addXp(n.skill, n.sp.xp || 1);
          Sfx.play(rare ? "rare" : {lumbering: "chop", mining: "mine", foraging: "pick", digging: "dig", fishing: "fish"}[n.skill]); setTimeout(() => Sfx.play("loot"), 120);
          float(n.x, n.y, `+1 ${Core.ITEMS[id].name}`, rare ? "rare" : ""); if (rare) say(`A rare find: ${Core.ITEMS[id].name.toLowerCase()}!`, "good");
          if (n.skill === "mining" || n.skill === "lumbering") { n.left = (n.left || 4 + Math.floor(rnd() * 4)) - 1; if (n.left <= 0) { n.emptyUntil = now + 9000; n.left = 0; } }
          drawPane(); save();
        } else P.job = null;
        j.next = now + n.sp.time * 1000;
      } else if (!j.swing || now >= j.swing) { j.swing = now + 900; Sfx.play({lumbering: "chop", mining: "mine", foraging: "step", digging: "dig", fishing: "step"}[n.skill]); }
    }
    if (j && !P.path.length && j.kind === "cook") {
      if (!j.next) j.next = now + 1400;
      else if (now >= j.next) {
        const raw = Object.keys(S.bag).find((k) => S.bag[k] > 0 && cookOf(k));
        if (!raw) { say("You've cooked everything.", "good"); P.job = null; }
        else { const r = cookOf(raw); S.bag[raw]--; if (!S.bag[raw]) delete S.bag[raw]; give(r.make, 1); addXp("cooking", r.xp || 5); Sfx.play("cook"); float(map.fire[0], map.fire[1], `+1 ${Core.ITEMS[r.make].name}`); drawPane(); j.next = now + 1400; }
      }
    }
    if (j && j.kind === "fight") fightTick(now);
    monTick(now);
    // health comes back slowly -- 1 a minute, as in the game (PT22); a hunter's special a little every 6 s
    if (!P.lastRegen || now - P.lastRegen > 6000) { P.lastRegen = now; P.regenTicks = (P.regenTicks || 0) + 1; if (S.hp < maxHp() && !(j && j.kind === "fight") && P.regenTicks % 10 === 0) S.hp++; if (S.cls === "hunter") S.spec = Math.min(100, S.spec + 5); else if (!(j && j.kind === "fight")) S.fury = Math.max(0, S.fury - 4); drawTop(); }
    map.nodes.forEach((n) => { if (n.emptyUntil && n.emptyUntil <= now) n.emptyUntil = 0; });
  }
  /** Your speed bonus: the best speed gear you wear (the prototype: boots). */
  function speed() { return S.boots && PROTO_ITEMS[S.boots] ? PROTO_ITEMS[S.boots].speed : 0; }
  function nearGate(w, r) { const [x, y] = w.pos[r]; return [x, y + 1]; }

  // ---- fighting: the two classes ----
  const KIT = {
    hunter: {name: "Hunter", style: "ranged", skill: "ranged", dtype: "pierce", power: 4, range: 4, weapon: "shortbow", sound: "arrow", meter: "spec",
             blurb: "A bow and a quiver: fight from four tiles away and keep the creature at a distance. Special bar refills over time."},
    berserker: {name: "Berserker", style: "melee", skill: "attack", dtype: "slash", power: 5, range: 1, weapon: "bronzemaul", sound: "swing", meter: "fury",
                blurb: "A maul up close. Every blow you deal or take builds fury; spend it on Cleave or Rage."}};
  const kit = () => KIT[S.cls];
  let queued = "";
  function specials() { const C = Core.CLASSES[S.cls]; return Object.keys(C.specials).filter((k) => !C.specials[k].minLevel || lvl(kit().skill) >= C.specials[k].minLevel).map((k) => Object.assign({id: k}, C.specials[k])); }
  const meter = () => kit().meter === "fury" ? S.fury : S.spec;
  function fightTick(now) {
    const j = P.job, mon = j.mon, M = Core.MONSTERS[mon.id];
    if (mon.hp <= 0) { P.job = null; return; }
    const dist = Math.max(Math.abs(Math.round(mon.fx) - P.x), Math.abs(Math.round(mon.fy) - P.y)), reach = kit().range;
    const inReach = reach === 1 ? Math.abs(Math.round(mon.fx) - P.x) + Math.abs(Math.round(mon.fy) - P.y) === 1 : dist <= reach;
    if (!inReach) { if (!P.path.length) P.path = path(map, [P.x, P.y], [Math.round(mon.fx), Math.round(mon.fy)], reach === 1, reach > 1 ? reach : 0) || []; return; }
    P.path = [];
    if (now < (j.next || 0)) return;
    j.next = now + ROUND;
    P.face = mon.fx >= P.x ? 1 : -1;
    const sp = queued ? specials().find((x) => x.id === queued) : null; queued = "";
    if (sp && meter() < sp.cost) { say(`Not enough ${kit().meter === "fury" ? "fury" : "special"} for ${sp.name}.`, "bad"); }
    const use = sp && meter() >= sp.cost ? sp : null;
    if (use) { if (kit().meter === "fury") S.fury -= use.cost; else S.spec -= use.cost; Sfx.play("special"); say(`${use.name}!`, "good"); if (use.rage) j.rage = true; }
    const att = lvl(kit().skill) + kit().power, maxHit = 2 + Math.floor(att / 4);
    const hitMult = (M.weak && M.weak[kit().dtype]) || (M.resist && M.resist[kit().dtype]) || 1;
    let dealt = 0;
    for (let h = 0; h < (use && use.hits ? use.hits : 1); h++) {
      const chance = Math.min(0.95, Math.max(0.1, (att + 3) / (att + M.def + 6)) * (use && use.acc ? use.acc : 1));
      Sfx.play(kit().sound);
      if (rnd() < chance && !(M.eva && rnd() < M.eva * 0.5)) { const d = Math.max(1, Math.round((1 + Math.floor(rnd() * maxHit)) * hitMult * (use && use.dmg ? use.dmg : 1))); mon.hp -= d; dealt += d; float(mon.fx, mon.fy, `-${d}`, "hit"); setTimeout(() => Sfx.play("hit"), 90); }
      else { float(mon.fx, mon.fy, "miss", "miss"); setTimeout(() => Sfx.play("miss"), 90); }
    }
    if (kit().meter === "fury") S.fury = Math.min(100, S.fury + dealt * 3);
    addXp(kit().skill, dealt * 2); addXp("hitpoints", dealt * 0.7);
    if (mon.hp <= 0) return killed(mon);
    // its turn: only when it can reach you
    const adj = Math.abs(Math.round(mon.fx) - P.x) + Math.abs(Math.round(mon.fy) - P.y) === 1;
    if (adj) {
      const ch = Math.max(0.05, Math.min(0.9, (M.att + 1) / (M.att + lvl("defence") + 4)));
      if (rnd() < ch) { const d = Math.max(1, Math.round((1 + Math.floor(rnd() * M.maxHit)) * (j.rage ? 1.5 : 1))); S.hp -= d; float(P.x, P.y, `-${d}`, "hurt"); Sfx.play("hurt"); if (kit().meter === "fury") S.fury = Math.min(100, S.fury + d * 4); addXp("defence", d); }
      else float(P.x, P.y, "block", "miss");
    }
    drawTop();
    if (S.hp <= 0) fall(M);
  }
  function killed(mon) {
    const M = Core.MONSTERS[mon.id];
    Sfx.play("die"); say(`You beat the ${M.name.toLowerCase()}.`, "good");
    const sd = SPEED_DROPS[mon.id]; if (sd && rnd() < 1 / sd[1] && give(sd[0], 1)) { Sfx.play("rare"); say(`The ${M.name.toLowerCase()} dropped ${itemName(sd[0]).toLowerCase()}! Click them in your bag to put them on.`, "good"); }
    (M.drops || []).forEach((d) => { if (rnd() < d[3]) { const n = d[1] + Math.floor(rnd() * (d[2] - d[1] + 1)); if (Core.ITEMS[d[0]] && give(d[0], n)) float(mon.fx, mon.fy - 0.5, `+${n} ${Core.ITEMS[d[0]].name}`); } });
    setTimeout(() => Sfx.play("loot"), 200);
    P.job = null; P.target = null;
    map.mons = map.mons.filter((x) => x !== mon);
    setTimeout(() => { if (map.hunt && maps[map.id] === map) spawnMon(map); }, 8000);
    drawPane(); drawTop(); save();
  }
  function fall(M) {
    say(`The ${M.name.toLowerCase()} knocked you down. You wake up in the Village (the prototype keeps your bag).`, "bad");
    Sfx.play("die"); S.hp = maxHp(); S.fury = 0; map.mons.forEach((m) => { m.aggro = false; m.hp = m.max; });
    enter("village");
  }
  /** The creatures: they wander; one you're fighting comes for you. */
  function monTick(now) {
    map.mons.forEach((mm) => {
      mm.fx += (mm.x - mm.fx) * 0.18; mm.fy += (mm.y - mm.fy) * 0.18;
      if (now < mm.next) return;
      if (mm.aggro && P.target === mm) {
        mm.next = now + 420;
        const adj = Math.abs(mm.x - P.x) + Math.abs(mm.y - P.y) === 1;
        if (!adj) { const p = path(map, [mm.x, mm.y], [P.x, P.y], true); if (p && p.length) { const [nx, ny] = p[0]; if (!(nx === P.x && ny === P.y)) { mm.x = nx; mm.y = ny; } } }
        return;
      }
      // out of the fight: its health comes back (PT22: "The monsters health doesnt return to normal when i pass out")
      if (mm.aggro && P.target !== mm) { mm.aggro = false; mm.calmAt = now; }
      if (mm.hp < mm.max && !mm.aggro && now - (mm.calmAt || 0) > 4000) mm.hp = mm.max;
      mm.next = now + 2000 + rnd() * 3000;
      if (Math.abs(mm.x - mm.home[0]) + Math.abs(mm.y - mm.home[1]) > 4) { const p = path(map, [mm.x, mm.y], mm.home); if (p && p.length) { [mm.x, mm.y] = p[0]; return; } }   // it keeps to its patch
      const z = map.huntZone, [dx, dy] = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(rnd() * 4)], nx = mm.x + dx, ny = mm.y + dy;
      if (nx >= z[0] && nx <= z[2] && ny >= z[1] && ny <= z[3] && walkable(map, nx, ny) && !(nx === P.x && ny === P.y) && !map.mons.some((o) => o !== mm && o.x === nx && o.y === ny)) { mm.x = nx; mm.y = ny; }
    });
  }

  // ---- drawing ----
  const cv = $("g-canvas"), g = cv.getContext("2d");
  let scale = 1, camX = 0, camY = 0, hover = null;
  function resize() {
    const st = $("g-stage"), w = st.clientWidth, h = st.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.floor(w * dpr); cv.height = Math.floor(h * dpr); cv.style.width = w + "px"; cv.style.height = h + "px";
    scale = Math.max(1, Math.min(2.2, Math.min(w / (map ? Math.min(map.W, 26) * T : 800), h / (map ? Math.min(map.H, 18) * T : 600)))) * dpr;
  }
  const shade = (hex, f) => { const n = parseInt(hex.slice(1), 16), r = Math.min(255, Math.max(0, ((n >> 16) & 255) * f)), gg = Math.min(255, Math.max(0, ((n >> 8) & 255) * f)), b = Math.min(255, Math.max(0, (n & 255) * f)); return `rgb(${r | 0},${gg | 0},${b | 0})`; };
  function draw(now) {
    if (!map) return;
    const vw = cv.width / scale, vh = cv.height / scale;
    camX += ((P.fx + 0.5) * T - vw / 2 - camX) * 0.15; camY += ((P.fy + 0.5) * T - vh / 2 - camY) * 0.15;
    camX = Math.max(0, Math.min(map.W * T - vw, camX)); camY = Math.max(0, Math.min(map.H * T - vh, camY));
    if (map.W * T < vw) camX = (map.W * T - vw) / 2; if (map.H * T < vh) camY = (map.H * T - vh) / 2;
    g.setTransform(scale, 0, 0, scale, -camX * scale, -camY * scale);
    g.fillStyle = "#1b120c"; g.fillRect(camX, camY, vw, vh);
    const th = map.theme, x0 = Math.max(0, Math.floor(camX / T)), y0 = Math.max(0, Math.floor(camY / T)), x1 = Math.min(map.W, Math.ceil((camX + vw) / T) + 1), y1 = Math.min(map.H, Math.ceil((camY + vh) / T) + 1);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const t = map.tiles[y][x], X = x * T, Y = y * T, v = ((x * 73 + y * 151) % 7) / 40;
      if (t === "w") { g.fillStyle = shade(th.w, 0.95 + v); g.fillRect(X, Y, T, T); g.strokeStyle = "rgba(255,255,255,.25)"; g.beginPath(); const o = (now / 300 + x + y) % 6; g.moveTo(X + 4 + o, Y + 12); g.lineTo(X + 12 + o, Y + 12); g.stroke(); continue; }
      if (t === "edge") { g.fillStyle = shade(th.g, 0.55); g.fillRect(X, Y, T, T); continue; }
      g.fillStyle = shade(t === "p" ? th.p : th.g, 0.94 + v); g.fillRect(X, Y, T, T);
      if (t === "gate") { const to = map.gates[x + "," + y]; g.fillStyle = "#6b4426"; g.fillRect(X + 13, Y + 8, 6, 22); g.fillStyle = "#c8945a"; g.fillRect(X + 2, Y + 4, 28, 11); g.strokeStyle = "#3b2213"; g.strokeRect(X + 2.5, Y + 4.5, 27, 10);
        if (to) { g.fillStyle = "#f6e6c6"; g.font = "bold 9px sans-serif"; g.textAlign = "center"; g.fillText(to === "world" ? "Out" : (Core.REGIONS[to] || {}).name || to, X + 16, Y - 2 > camY ? Y - 2 : Y + 40); } }
      if (t === "fire") { g.fillStyle = "#5a3a22"; g.fillRect(X + 6, Y + 22, 20, 5); const f = 0.8 + Math.sin(now / 90) * 0.2; g.fillStyle = "#f08a2a"; g.beginPath(); g.moveTo(X + 8, Y + 23); g.quadraticCurveTo(X + 16, Y + 2 * f, X + 24, Y + 23); g.fill(); g.fillStyle = "#f6d24a"; g.beginPath(); g.moveTo(X + 12, Y + 23); g.quadraticCurveTo(X + 16, Y + 10 * f, X + 20, Y + 23); g.fill(); }
      const d = map.deco[x + "," + y];
      if (d === "tree") { g.fillStyle = "#5a3a22"; g.fillRect(X + 13, Y + 18, 6, 12); g.fillStyle = shade(th.g, 0.62); g.beginPath(); g.arc(X + 16, Y + 13, 12, 0, 7); g.fill(); g.fillStyle = shade(th.g, 0.78); g.beginPath(); g.arc(X + 12, Y + 10, 6, 0, 7); g.fill(); }
      if (d === "rock") { g.fillStyle = "#8a8478"; g.beginPath(); g.ellipse(X + 16, Y + 20, 11, 8, 0, 0, 7); g.fill(); g.fillStyle = "#a8a296"; g.beginPath(); g.ellipse(X + 13, Y + 17, 5, 3, 0, 0, 7); g.fill(); }
      if (d === "flower") { ["#f2c43c", "#e8709a", "#ffffff"].forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.arc(X + 8 + i * 8, Y + 14 + (i % 2) * 8, 3, 0, 7); g.fill(); }); }
      if (d === "crystal") { g.fillStyle = "#9ad8f0"; g.beginPath(); g.moveTo(X + 16, Y + 2); g.lineTo(X + 24, Y + 26); g.lineTo(X + 8, Y + 26); g.fill(); g.fillStyle = "#d8f4ff"; g.fillRect(X + 14, Y + 8, 3, 12); }
      if (d === "fence") { g.fillStyle = "#8a6440"; g.fillRect(X, Y + 14, T, 4); g.fillRect(X + 6, Y + 8, 4, 18); g.fillRect(X + 22, Y + 8, 4, 18); }
    }
    // the nodes
    map.nodes.forEach((n) => {
      if (n.x < x0 - 1 || n.x > x1 || n.y < y0 - 1 || n.y > y1) return;
      const X = n.x * T, Y = n.y * T, spent = n.emptyUntil > now, locked = !S.testOpen && lvl(n.skill) < n.sp.level;
      // something you can use: a soft gold ring under it, so it stands out from the scenery
      if (!spent) { g.fillStyle = "rgba(242,196,60,.28)"; g.beginPath(); g.ellipse(X + 16, Y + 27, 14, 5, 0, 0, 7); g.fill(); g.strokeStyle = "rgba(255,230,140,.7)"; g.beginPath(); g.ellipse(X + 16, Y + 27, 14, 5, 0, 0, 7); g.stroke(); }
      g.globalAlpha = spent ? 0.45 : 1;
      if (n.skill === "lumbering") { g.fillStyle = "#4a2e1a"; g.fillRect(X + 12, Y + 16, 8, 15); g.fillStyle = spent ? "#6b5a3a" : "#3f7a2e"; g.beginPath(); g.arc(X + 16, Y + 11, 13, 0, 7); g.fill(); g.fillStyle = "#5c9c3e"; g.beginPath(); g.arc(X + 11, Y + 8, 6, 0, 7); g.fill(); }
      if (n.skill === "mining") { g.fillStyle = "#6e6a62"; g.beginPath(); g.ellipse(X + 16, Y + 19, 14, 11, 0, 0, 7); g.fill(); const ore = oreColour(n.sp); g.fillStyle = spent ? "#5a5650" : ore; [[10, 15], [19, 20], [15, 23], [21, 14]].forEach(([a, b]) => { g.beginPath(); g.arc(X + a, Y + b, 2.6, 0, 7); g.fill(); }); }
      if (n.skill === "foraging") { g.fillStyle = "#3f7a2e"; g.beginPath(); g.arc(X + 16, Y + 18, 12, 0, 7); g.fill(); g.fillStyle = spent ? "#5a6a4a" : "#c83a5a"; [[10, 14], [20, 16], [15, 22], [22, 22], [12, 20]].forEach(([a, b]) => { g.beginPath(); g.arc(X + a, Y + b, 2.4, 0, 7); g.fill(); }); }
      if (n.skill === "digging") { g.fillStyle = "#7a5634"; g.beginPath(); g.ellipse(X + 16, Y + 22, 13, 7, 0, 0, 7); g.fill(); g.fillStyle = "#5a3c22"; g.beginPath(); g.ellipse(X + 16, Y + 21, 6, 3, 0, 0, 7); g.fill(); }
      if (n.skill === "fishing") { const r = 6 + ((now / 120) % 8); g.strokeStyle = "rgba(255,255,255,.75)"; g.lineWidth = 1.5; g.beginPath(); g.arc(X + 16, Y + 16, r, 0, 7); g.stroke(); g.beginPath(); g.arc(X + 16, Y + 16, Math.max(1, r - 5), 0, 7); g.stroke(); g.lineWidth = 1; }
      g.globalAlpha = 1;
      if (locked) { g.fillStyle = "rgba(0,0,0,.55)"; g.fillRect(X + 4, Y + 2, 24, 11); g.fillStyle = "#f6e6c6"; g.font = "bold 8px sans-serif"; g.textAlign = "center"; g.fillText("Lv " + n.sp.level, X + 16, Y + 10); }
    });
    // the creatures and you, back to front
    const actors = map.mons.map((mm) => ({y: mm.fy, draw: () => drawMon(mm, now)})).concat([{y: P.fy, draw: () => drawMe(now)}]).sort((a, b) => a.y - b.y);
    actors.forEach((a) => a.draw());
    // the tile under the mouse, and where you're going
    if (hover) { g.strokeStyle = "rgba(255,240,200,.85)"; g.lineWidth = 2; g.strokeRect(hover[0] * T + 1, hover[1] * T + 1, T - 2, T - 2); g.lineWidth = 1; }
    if (P.path.length) { const [tx, ty] = P.path[P.path.length - 1]; g.fillStyle = "rgba(242,196,60,.6)"; g.beginPath(); g.arc(tx * T + 16, ty * T + 16, 4, 0, 7); g.fill(); }
    // the gathering ring
    const j = P.job;
    if (j && j.kind === "gather" && j.next && !P.path.length && !(j.node.emptyUntil > now)) {
      const f = 1 - Math.max(0, j.next - now) / (j.node.sp.time * 1000);
      g.strokeStyle = "#f2c43c"; g.lineWidth = 3; g.beginPath(); g.arc(j.node.x * T + 16, j.node.y * T + 16, 15, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); g.stroke(); g.lineWidth = 1;
    }
    floatsDraw(now);
  }
  function oreColour(sp) { const l = sp.loot[0][0]; return {copper: "#d07a3a", tin: "#c8c8c8", iron: "#8a5a4a", coal: "#2a2a2a", gold: "#f2c43c", mithril: "#5a6ad8", adamantite: "#3a9a5a", runite: "#4ad8d8", clay: "#c89a6a", stone: "#9a9488"}[l] || "#d8d0c0"; }
  function drawMon(mm, now) {
    const X = mm.fx * T, Y = mm.fy * T, im = img(monSrc(mm.id)), bob = Math.sin(now / 300 + mm.x) * 1.5;
    g.fillStyle = "rgba(0,0,0,.25)"; g.beginPath(); g.ellipse(X + 16, Y + 28, 11, 4, 0, 0, 7); g.fill();
    if (im) g.drawImage(im, X - 4, Y - 10 + bob, 40, 40); else { g.fillStyle = "#a05a3a"; g.fillRect(X + 6, Y + 6, 20, 20); }
    if (mm.hp < mm.max || P.target === mm) { g.fillStyle = "#3a0a0a"; g.fillRect(X + 2, Y - 14, 28, 4); g.fillStyle = "#4cc37a"; g.fillRect(X + 2, Y - 14, 28 * Math.max(0, mm.hp) / mm.max, 4); }
    if (P.target === mm) { g.strokeStyle = "#f08a6e"; g.lineWidth = 2; g.beginPath(); g.ellipse(X + 16, Y + 28, 13, 5, 0, 0, 7); g.stroke(); g.lineWidth = 1; }
  }
  function drawMe(now) {
    const X = P.fx * T, Y = P.fy * T, fighting = P.job && P.job.kind === "fight" && !P.path.length;
    const im = img("../art/player/body-" + (S.body || "m") + "-" + (fighting ? "fight" : "a") + ".webp"), walk = P.path.length ? Math.abs(Math.sin(now / 90)) * 2 : 0;
    g.fillStyle = "rgba(0,0,0,.3)"; g.beginPath(); g.ellipse(X + 16, Y + 29, 10, 4, 0, 0, 7); g.fill();
    if (im) { g.save(); if (P.face < 0) { g.translate(X * 2 + 32, 0); g.scale(-1, 1); } g.drawImage(im, X - 6, Y - 26 - walk, 44, 56); g.restore(); }
    else { g.fillStyle = "#3a5ad8"; g.fillRect(X + 9, Y + 2 - walk, 14, 26); }
    const wi = img(itemSrc(kit().weapon)); if (wi) g.drawImage(wi, X + (P.face > 0 ? 18 : -2), Y + 2 - walk, 16, 16);
  }
  // floating numbers and finds
  let floats = [];
  function float(x, y, text, kind) { floats.push({x, y, text, kind: kind || "", t: performance.now()}); }
  function floatsDraw(now) {
    const t = performance.now();
    floats = floats.filter((f) => t - f.t < 1400);
    floats.forEach((f) => { const a = (t - f.t) / 1400; g.globalAlpha = 1 - a; g.font = "bold 11px sans-serif"; g.textAlign = "center";
      g.fillStyle = f.kind === "hit" ? "#ffd84a" : f.kind === "hurt" ? "#ff6a5a" : f.kind === "miss" ? "#d8d8e8" : f.kind === "lv" ? "#7ae8a0" : f.kind === "rare" ? "#f2a0ff" : "#ffffff";
      g.strokeStyle = "rgba(0,0,0,.7)"; g.lineWidth = 3; const X = f.x * T + 16, Y = f.y * T - 8 - a * 24; g.strokeText(f.text, X, Y); g.fillText(f.text, X, Y); g.lineWidth = 1; g.globalAlpha = 1; });
  }

  // ---- the panels ----
  let tab = "bag";
  function drawTop() {
    const mh = maxHp(); S.hp = Math.max(0, Math.min(S.hp, mh));
    $("g-hp").style.width = (100 * S.hp / mh) + "%"; $("g-hpn").textContent = `${S.hp}/${mh}`;
    const m = meter(); $("g-sp").style.width = m + "%"; $("g-spn").textContent = `${kit().meter === "fury" ? "Fury" : "Special"} ${Math.floor(m)}`;
    $("g-sp").parentNode.classList.toggle("fury", kit().meter === "fury");
    const sig = specials().map((x) => x.id + (meter() >= x.cost ? 1 : 0) + (queued === x.id ? "q" : "")).join();
    if ($("g-specs").dataset.sig !== sig) { $("g-specs").dataset.sig = sig;
      $("g-specs").innerHTML = specials().map((x, i) => `<button class="g-btn spec${meter() >= x.cost ? " ready" : ""}${queued === x.id ? " on" : ""}" data-spec="${x.id}" title="${esc(x.about)} (${x.cost}) -- key ${i + 1}">${i + 1}. ${esc(x.name)}</button>`).join("");
      $("g-specs").querySelectorAll("[data-spec]").forEach((b) => b.addEventListener("click", () => { queued = queued === b.dataset.spec ? "" : b.dataset.spec; drawTop(); })); }
  }
  function drawPane() {
    document.querySelectorAll(".g-tab").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
    const el = $("g-pane");
    if (tab === "bag") {
      const ks = bagKinds();
      el.innerHTML = `<div class="g-head">Bag <span>${ks.length}/${BAG}</span></div><div class="g-grid">${ks.map((k) => `<button class="g-slot" data-item="${k}" title="${esc(itemName(k))} × ${S.bag[k]} -- click: ${PROTO_ITEMS[k] ? "put them on" : "eat (food)"} · right-click: drop">
          <img alt="" src="${itemSrc(k)}"><span>${S.bag[k] > 1 ? S.bag[k] : ""}</span></button>`).join("")}${"<span class=\"g-slot empty\"></span>".repeat(Math.max(0, BAG - ks.length))}</div>
        <p class="g-hint">Click food to eat it. Right-click a thing to drop it.</p>`;
      el.querySelectorAll("[data-item]").forEach((b) => {
        b.addEventListener("click", () => eat(b.dataset.item));
        b.addEventListener("contextmenu", (e) => { e.preventDefault(); const k = b.dataset.item; delete S.bag[k]; Sfx.play("click"); say(`You dropped the ${itemName(k).toLowerCase()}.`); drawPane(); save(); });
      });
    } else if (tab === "skills") {
      el.innerHTML = `<div class="g-head">Skills <span>${kit().name} · combat ${combatLevel()}</span></div>
        <div class="g-skill"><b>Speed</b><span>${Math.round(100 * (1 + speed()))}%</span><div class="g-hint" style="grid-column:1/-1">${S.boots ? "Wearing " + esc(itemName(S.boots).toLowerCase()) : "No speed gear yet -- a snake in the Forest drops reptile boots now and then"}</div></div>` + SKILL_LIST.filter((k) => k !== (S.cls === "hunter" ? "attack" : "ranged")).map((k) => {
        const L = lvl(k), xp = S.skills[k] || 0, a = Core.XP[L] || 0, b = Core.XP[L + 1] || a + 1;
        return `<div class="g-skill"><b>${esc(Core.SKILLS[k].name)}</b><span>${L}</span><div class="g-xp"><i style="width:${Math.min(100, 100 * (xp - a) / Math.max(1, b - a))}%"></i></div></div>`; }).join("")
        + `<label class="g-check"><input type="checkbox" id="g-test" ${S.testOpen ? "checked" : ""}> Prototype: every gathering spot open (ignore levels)</label>
           <label class="g-check"><input type="checkbox" id="g-testhunt" ${S.testHunt ? "checked" : ""}> Prototype: every hunting ground open (ignore combat levels -- the creatures still hit as hard)</label>`;
      $("g-test").addEventListener("change", (e) => { S.testOpen = e.target.checked; save(); });
      $("g-testhunt").addEventListener("change", (e) => { S.testHunt = e.target.checked; save(); });
    } else {
      el.innerHTML = `<div class="g-head">How to</div><ul class="g-help">
        <li><b>Walk:</b> click a tile (or the arrow keys). You take the shortest way round.</li>
        <li><b>Areas:</b> walk into a signpost to go in; the signpost at the bottom of an area takes you back out.</li>
        <li><b>Gather:</b> click a tree, rock, bush, mound or the rings on the water -- you walk up and keep going until your bag is full or you walk off. Trees and rocks run out for a few seconds.</li>
        <li><b>Fight:</b> click a creature. ${S.cls === "hunter" ? "You shoot from up to 4 tiles away -- keep your distance." : "You walk up and swing. Fury builds with every blow."} Specials: the buttons at the top (keys 1, 2, 3) fire on your next attack.</li>
        <li><b>Eat:</b> click food in your bag. Cook raw fish at the Village campfire.</li>
        <li><b>Sound:</b> the button at the top; the slider is the volume.</li></ul>
        <p class="g-hint">This is a prototype of the grid game: the main island, the Hunter and the Berserker. It uses the game's own spots, finds, creatures and pictures; its save is its own.</p>`;
    }
  }
  function eat(k) {
    if (PROTO_ITEMS[k] && PROTO_ITEMS[k].speed) {                       // boots: put them on (and the old ones back in the bag)
      if (S.boots) S.bag[S.boots] = (S.bag[S.boots] || 0) + 1;
      S.boots = k; S.bag[k]--; if (!S.bag[k]) delete S.bag[k]; Sfx.play("loot"); say(`You put on the ${itemName(k).toLowerCase()} -- you walk ${Math.round(PROTO_ITEMS[k].speed * 100)}% faster.`, "good"); drawPane(); return save();
    }
    const it = Core.ITEMS[k];
    if (!it.heal) return say(`You can't eat the ${it.name.toLowerCase()}.`);
    if (S.hp >= maxHp()) return say("You're not hurt.");
    S.hp = Math.min(maxHp(), S.hp + it.heal); S.bag[k]--; if (!S.bag[k]) delete S.bag[k];
    Sfx.play("eat"); say(`You eat the ${it.name.toLowerCase()} (+${it.heal}).`, "good"); if (P.job && P.job.kind === "fight") P.job.next += ROUND / 2;
    drawPane(); drawTop(); save();
  }
  const logLines = [];
  function say(text, kind) { logLines.push({text, kind: kind || ""}); while (logLines.length > 5) logLines.shift(); $("g-log").innerHTML = logLines.map((l) => `<div class="${l.kind}">${esc(l.text)}</div>`).join(""); }

  // ---- input ----
  const tileAt = (e) => { const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1; return [Math.floor(((e.clientX - r.left) * dpr / scale + camX) / T), Math.floor(((e.clientY - r.top) * dpr / scale + camY) / T)]; };
  cv.addEventListener("click", (e) => { Sfx.start(); const [x, y] = tileAt(e); if (x >= 0 && y >= 0 && x < map.W && y < map.H) clickTile(x, y); });
  cv.addEventListener("mousemove", (e) => { hover = tileAt(e); const [x, y] = hover;
    const mon = map.mons.find((mm) => Math.round(mm.fx) === x && Math.round(mm.fy) === y), node = map.nodes.find((n) => n.x === x && n.y === y), gate = map.gates[x + "," + y];
    cv.title = mon ? `${Core.MONSTERS[mon.id].name} -- click to fight` : node ? `${node.sp.name} (${Core.SKILLS[node.skill].name} ${node.sp.level}) -- click to gather` : gate ? (gate === "world" ? "Back out to the island" : `The ${Core.REGIONS[gate].name} (level ${Core.REGIONS[gate].level})`) : map.fire && map.fire[0] === x && map.fire[1] === y ? "The campfire -- click to cook raw fish" : "";
    cv.style.cursor = mon ? "crosshair" : node || gate ? "pointer" : "default"; });
  cv.addEventListener("mouseleave", () => { hover = null; });
  cv.addEventListener("contextmenu", (e) => e.preventDefault());
  document.addEventListener("keydown", (e) => {
    if (!S || e.target.matches("input")) return;
    const d = {ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0]}[e.key];
    if (d) { e.preventDefault(); Sfx.start(); const nx = P.x + d[0], ny = P.y + d[1]; if (walkable(map, nx, ny) || (map.tiles[ny] && map.tiles[ny][nx] === "gate")) { P.path = [[nx, ny]]; stopJob(); } return; }
    const n = +e.key; if (n >= 1 && n <= 3) { const sp = specials()[n - 1]; if (sp) { queued = queued === sp.id ? "" : sp.id; drawTop(); } }
  });
  document.querySelectorAll(".g-tab").forEach((b) => b.addEventListener("click", () => { tab = b.dataset.tab; drawPane(); }));
  $("g-mute").addEventListener("click", () => { Sfx.start(); Sfx.on = !Sfx.on; $("g-mute").textContent = "Sound: " + (Sfx.on ? "on" : "off"); });
  $("g-vol").addEventListener("input", (e) => { Sfx.start(); Sfx.setVol(+e.target.value / 100); });
  $("g-reset").addEventListener("click", () => { if (!window.confirm("Start the prototype again?")) return; try { localStorage.removeItem(KEY); } catch (e) { /* fine */ } S = null; Object.keys(maps).forEach((k) => delete maps[k]); choose(); });
  window.addEventListener("resize", () => { if (map) resize(); });

  // ---- choosing: the Hunter or the Berserker ----
  function choose() {
    const box = $("g-start");
    box.hidden = false;
    box.innerHTML = `<div class="g-card"><h1>Grid world <small>prototype</small></h1>
      <p>The main island as a grid you walk around. Choose who you are:</p>
      <div class="g-pick">${Object.keys(KIT).map((k) => `<button class="g-class" data-cls="${k}"><img alt="" src="${itemSrc(KIT[k].weapon)}"><b>${esc(KIT[k].name)}</b><span>${esc(KIT[k].blurb)}</span></button>`).join("")}</div>
      <div class="g-bodies"><label><input type="radio" name="g-body" value="m" checked> Young man</label><label><input type="radio" name="g-body" value="f"> Young woman</label></div>
      <p class="g-hint">Sound plays once you click. Nothing here touches your real game.</p></div>`;
    box.querySelectorAll("[data-cls]").forEach((b) => b.addEventListener("click", () => {
      Sfx.start(); Sfx.play("level");
      S = fresh(b.dataset.cls, (box.querySelector("input[name=g-body]:checked") || {}).value || "m");
      S.hp = maxHp();                                                   // a new game's levels: 1, and 10 Hitpoints (PT22: "combat seems easy")
      box.hidden = true; start();
    }));
  }
  function start() {
    if (!S.hp) S.hp = maxHp();
    enter(S.map && (S.map === "world" || MAIN.includes(S.map)) ? S.map : "world");
    say(`Welcome, ${kit().name}. Click a tile to walk; walk into a signpost to enter an area.`, "info");
    drawTop(); drawPane();
  }
  function loop(now) { if (S && map) { try { tick(Date.now()); draw(now); } catch (e) { console.error(e); } } requestAnimationFrame(loop); }
  setInterval(() => { if (S) save(); }, 10000);
  load();
  // a demo for screenshots and play tests: #demo:<hunter|berserker>:<area>[:gather|fight]
  const demo = /^#demo:(hunter|berserker):([a-z]+)(?::([a-z]+))?(:new)?/.exec(location.hash || "");   // (:new -- a new game's levels)
  if (demo) {
    S = fresh(demo[1], "m"); if (!demo[4]) { S.skills[KIT[S.cls].skill] = Core.XP[20]; S.skills.hitpoints = Core.XP[20]; } S.hp = maxHp(); S.map = demo[2] === "world" ? "world" : demo[2];
    $("g-start").hidden = true; start();
    setTimeout(() => { if (demo[3] === "gather" && map.nodes.length) gather(map.nodes.find((n) => n.skill === "lumbering") || map.nodes[0]);
      if (demo[3] === "fight" && map.mons.length) attack(map.mons[0]); }, 300);
  } else if (S) { $("g-start").hidden = true; start(); } else choose();
  requestAnimationFrame(loop);
})();
