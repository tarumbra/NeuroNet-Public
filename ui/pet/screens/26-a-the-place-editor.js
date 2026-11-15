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
