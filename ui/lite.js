/* ==========================================================================
   Lite mode in NeuroNet's page (lite.py has the whole story, 17 Nov 2026).
   ==========================================================================
   Cam, on the ThinkPad: "build this lighter version as an option in neuronet
   settings that can be toggled."

   html[data-lite] turns on ui/lite.css. The last answer is kept in this
   page's storage so a lite computer draws lite from the very first frame;
   then the backend (lite_state) has the say. In Auto it asks again each time
   NeuroNet comes back into view, so unplugging a laptop's charger makes it
   lite with no timer running in between.

   NNLite.on                is it lite now
   NNLite.onChange(fn)      fn(on) when that changes; returns an unsubscribe
   NNLite.renderSettings(el)  Settings > Lite mode
   Loaded before app.js (index.html).
   ========================================================================== */
(() => {
  "use strict";
  const KEY = "nn:lite";
  const root = document.documentElement;
  const listeners = new Set();
  let st = null;
  try { st = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { st = null; }

  function apply(on) {
    const was = root.hasAttribute("data-lite");
    if (on) root.setAttribute("data-lite", ""); else root.removeAttribute("data-lite");
    if (was !== !!on) listeners.forEach((fn) => { try { fn(!!on); } catch (e) { /* a listener's own problem */ } });
  }
  if (st && st.on) apply(true);                       // before the first frame

  const api = () => (window.pywebview && window.pywebview.api) || null;
  function took(s) {
    if (!s || s.error) return false;
    st = s;
    try { localStorage.setItem(KEY, JSON.stringify({on: !!s.on, mode: s.mode})); } catch (e) { /* storage off: fine */ }
    apply(!!s.on);
    return true;
  }
  async function refresh() {
    const a = api();
    if (!a || typeof a.lite_state !== "function") return st;
    try { took(await a.lite_state()); } catch (e) { /* the page goes on as it was */ }
    return st;
  }
  if (api()) refresh(); else window.addEventListener("pywebviewready", refresh, {once: true});
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && (!st || !st.machine || st.mode === "auto")) refresh();
  });

  async function set(mode) {
    const a = api();
    if (!a || typeof a.lite_set !== "function") return {error: "Lite mode needs NeuroNet's backend."};
    const s = await a.lite_set(mode);
    if (s && s.error) return s;
    took(s);
    return s;
  }

  /* ---- Settings > Lite mode ---- */
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
  function machineLine(m) {
    if (!m || !m.threads) return "";
    const bits = [m.cpu ? m.cpu.replace(/\(R\)|\(TM\)|CPU /g, "").replace(/\s+/g, " ").trim() : "",
      `${m.threads} threads`, `${m.ram_gb} GB of memory`];
    if (m.has_battery) bits.push(`battery ${m.battery_pct != null ? m.battery_pct + "%" : ""}${m.on_battery ? ", unplugged" : ", plugged in"}`);
    return bits.filter(Boolean).join(" · ");
  }
  async function renderSettings(el) {
    if (!el) return;
    await refresh();
    const s = st || {mode: "auto", on: root.hasAttribute("data-lite")};
    const seg = (val, label) => `<button class="seg-btn ${s.mode === val ? "on" : ""}" data-lite-mode="${val}">${label}</button>`;
    el.innerHTML = `
      <div class="disp-box">
        <div class="label">This computer</div>
        <div class="disp-row"><span class="disp-name">Lite mode</span>
          <div class="seg" role="group" aria-label="Lite mode">${seg("auto", "Auto")}${seg("on", "On")}${seg("off", "Off")}</div></div>
        <p class="stamp" style="margin:8px 0 4px">Lite mode is <b>${s.on ? "on" : "off"}</b> now${s.why ? `: ${esc(s.why)}` : ""}.</p>
        <p class="stamp" style="margin:0 0 14px">${esc(machineLine(s.machine))}</p>
        <p class="stamp" style="margin:0 0 14px">Auto is on for a smaller computer (4 threads or fewer, or 8 GB of
          memory or less) and for any laptop running on its battery. Kept on this computer only, so the PC can stay
          full while the ThinkPad is lite.</p>
        <div class="label">What it changes</div>
        <ul class="stamp" style="margin:4px 0 14px;padding-left:18px;line-height:1.6">
          <li>No blur behind panels; frosted panels get a solid background.</li>
          <li>Animations and fades finish at once, so the screen isn't redrawn while they run.</li>
          <li>The top bar's clock shows the minute, not the second.</li>
          <li>The music visualizer draws 15 frames a second instead of 60.</li>
          <li>Everything else works exactly the same: every section, game and tool is still there.</li>
        </ul>
        <p class="stamp" style="margin:0 0 22px">Shared with NeuroTrain, NeuroPets, NeuroFarm, NeuroCafe and
          NeuroArcana: each picks it up the next time it opens. A few calmer animations (the pages' own
          reduced-motion styles) come in with NeuroNet's next start.</p>
      </div>`;
    el.querySelectorAll("[data-lite-mode]").forEach((b) => b.addEventListener("click", async () => {
      const r = await set(b.dataset.liteMode);
      if (r && r.error) { const p = el.querySelector(".stamp"); if (p) p.textContent = r.error; return; }
      renderSettings(el);
    }));
  }

  window.NNLite = {
    get on() { return root.hasAttribute("data-lite"); },
    get state() { return st; },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    refresh, set, renderSettings,
  };
})();
