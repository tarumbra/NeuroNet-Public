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
