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
