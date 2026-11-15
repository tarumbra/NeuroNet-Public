/* ==========================================================================
   Settings → Screensaver (and Settings → Appearance's glowing window borders)
   ==========================================================================
   This page was Settings → Desktop widgets; the desktop widgets went on
   3 Nov 2026 (Cam: "remove the widget functionality completely"), and the
   screensaver switch that lived here stayed. The bar widgets are untouched.
   ========================================================================== */
(function () {
  "use strict";
  const SS = window.SS = window.SS || {};

  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  const call = (name, args, what) => SS.Store.call(name, args || [], what || "Screensaver");

  let host = null;

  async function render(el) {
    host = el;
    const saver = await call("screensaver_get", [], "Looking at the screensaver");
    if (!host) return;
    const using = (saver && saver.using) || "omarchy";
    host.innerHTML = `<div class="dw">
      <div class="label">Screensaver</div>
      <div class="sec-row dw-saver">
        <span class="sec-name">Omarchy's screensaver, with NeuroNet's name or Omarchy's</span>
        <span class="dw-saver-pick">
          <button class="btn ${using === "neuronet" ? "btn-primary" : "btn-quiet"}" data-saver="neuronet"
                  aria-pressed="${using === "neuronet"}">NeuroNet</button>
          <button class="btn ${using === "omarchy" ? "btn-primary" : "btn-quiet"}" data-saver="omarchy"
                  aria-pressed="${using === "omarchy"}">Omarchy</button>
          <button class="btn btn-quiet" data-saver-preview title="Any key or the mouse ends it">Preview</button>
        </span>
      </div>
    </div>`;
    /* Cam (2026-10-02): "a screen saver the same one as omarchy but replace
       omarchy with the Neuronet logo. Still keep the old one as well so i can
       change if i want to." (screensaver.py) */
    host.querySelectorAll("[data-saver]").forEach((b) => b.addEventListener("click", async () => {
      const r = await call("screensaver_set", [b.dataset.saver], "Changing the screensaver");
      if (r && r.error) { SS.shared.toast(r.error, "error"); return; }
      render(host);
    }));
    const pv = host.querySelector("[data-saver-preview]");
    if (pv) pv.addEventListener("click", () => call("screensaver_preview", [], "Starting the screensaver"));
  }

  SS.DesktopWidgets = {render};

  /* ---- Settings → Appearance → Glowing window borders (window_glow.py)

     Cam (2026-10-02): "I like how the neuronet theme has a light up border
     around the windows, are you able to provide a toggle switch that then
     overrides each themes windows border behavious to do the same in the
     respective themes". One switch; every theme on the computer, each with
     the two colours its border glows in. A theme added after 2026-10-02
     gets colours picked from its name (marked "new"). */
  async function renderGlow(el) {
    if (!el) return;
    const g = await call("window_glow_get", [], "Looking at the window borders");
    if (!g || !Array.isArray(g.themes)) { el.innerHTML = ""; return; }
    el.innerHTML = `<div class="glow">
      <div class="label">The desktop: glowing window borders</div>
      <div class="sec-row ${g.on ? "" : "is-off"}">
        <span class="sec-name">The NeuroNet theme's lit-up border, in every Omarchy theme
          <span class="dw-note">— the focused window glows in the theme's own colours</span></span>
        <button class="toggle ${g.on ? "on" : ""}" data-glow="${g.on ? 1 : 0}" aria-pressed="${g.on}"
                aria-label="Glowing window borders in every theme"></button>
      </div>
      <div class="glow-grid">${g.themes.map((t) => `
        <div class="glow-th ${t.name === g.current ? "is-now" : ""}" title="${esc(t.supported ? t.name
          : t.name + " — added since NeuroNet learned the themes: colours picked for it")}">
          <span class="glow-sw" style="background:linear-gradient(45deg, ${esc(t.colours[0])}, ${esc(t.colours[1])})"></span>
          <span class="glow-name">${esc(t.name)}${t.supported ? "" : " <i>new</i>"}${t.name === g.current ? " · now" : ""}</span>
        </div>`).join("")}</div>
      <p class="stamp">Off, every theme has its own border again. A theme you add
        later glows too, in colours picked for it.</p>
    </div>`;
    el.querySelector("[data-glow]").addEventListener("click", async (e) => {
      const on = e.currentTarget.dataset.glow !== "1";
      const r = await call("window_glow_set", [on], "Changing the window borders");
      if (r && r.error) { SS.shared.toast(r.error, "error"); return; }
      renderGlow(el);
    });
  }
  SS.WindowGlow = {render: renderGlow};
})();
