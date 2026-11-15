/* ==========================================================================
   Settings → Data folder
   ==========================================================================
   Cam (NeuroNet System decisions, 2026-09-29): the data lives in the home
   folder by default, with "a Settings option to migrate data to another
   drive".

   The work is data_move.py's -- copy to a new folder on the other drive,
   catch up, check every file, switch paths.json, keep the old folder
   renamed -- and it explains why each step is there. This is the page: where
   the data is now, a drive picked and checked BEFORE anything is copied
   (room, format, whether it must stay plugged in), then the move itself
   behind a covering screen -- NeuroNet isn't to be used while its data is
   half in two places -- and a restart into the new folder.

   Also the screen NeuroNet opens on when its data is on a drive that isn't
   plugged in (showMissing, from app.js at start): it says where the data is
   and waits, rather than opening on an empty library.
   ========================================================================== */
(function () {
  "use strict";
  const SS = window.SS = window.SS || {};

  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  const call = (name, args, what) => SS.Store.call(name, args || [], what || "Data folder");
  const toast = (m, k) => SS.shared.toast(m, k);

  function size(b) {
    b = Number(b) || 0;
    if (b >= 1e12) return (b / 1e12).toFixed(1) + " TB";
    if (b >= 1e9) return (b / 1e9).toFixed(1) + " GB";
    if (b >= 1e6) return Math.round(b / 1e6) + " MB";
    if (b >= 1e3) return Math.round(b / 1e3) + " KB";
    return b ? b + " bytes" : "empty";
  }
  const PHASES = {
    checking: "Getting ready", copying: "Copying", "catching up": "Copying what changed meanwhile",
    "checking the copy": "Checking every file", switching: "Switching over",
  };

  let host = null;

  async function render(el) {
    host = el;
    el.innerHTML = `<div class="df">
      <section class="df-card">
        <h3 class="df-h">Where your data is</h3>
        <div id="df-now"><p class="stamp">Looking…</p></div>
      </section>
      <section class="df-card">
        <h3 class="df-h">Move it to another drive</h3>
        <p class="stamp">For a bigger drive, or to keep your photos and music off the system drive.
          Everything is <b>copied</b> to a new <b>NeuroNet-data</b> folder on the drive you pick,
          checked file by file, and only then does NeuroNet switch to it and restart. The old folder
          is kept, renamed, until you delete it yourself.</p>
        <div class="df-row"><button class="btn btn-primary" id="df-pick">Choose the drive…</button></div>
        <div id="df-plan"></div>
      </section>
    </div>`;
    el.querySelector("#df-pick").onclick = pick;
    const info = await call("data_folder_info", [], "Looking at your data");
    const now = host && host.querySelector("#df-now");
    if (!now || !info) return;
    now.innerHTML = `<div class="vw-detail-grid">
        <div class="df-wide"><span>Folder</span><b class="df-path">${esc(info.path)}</b></div>
        <div><span>Holds</span><b>${Number(info.files).toLocaleString()} files · ${size(info.bytes)}</b></div>
        <div><span>Room left on that drive</span><b>${size(info.free)}</b></div>
      </div>`;
  }

  async function pick() {
    const plan = await call("data_move_pick", [], "Choosing a drive");
    if (!plan || plan.cancelled) return;
    showPlan(plan);
  }

  function showPlan(p) {
    const box = host && host.querySelector("#df-plan");
    if (!box) return;
    const blocked = (p.problems || []).length > 0;
    box.innerHTML = `<div class="df-plan">
      <div class="vw-detail-grid">
        <div class="df-wide"><span>To</span><b class="df-path">${esc(p.target || p.chosen)}</b></div>
        <div><span>Needs</span><b>${size(p.need)}</b></div>
        <div><span>That drive has</span><b>${size(p.free)} free</b></div>
      </div>
      ${(p.problems || []).map((m) => `<p class="df-bad">${esc(m)}</p>`).join("")}
      ${(p.warnings || []).map((m) => `<p class="df-warn">${esc(m)}</p>`).join("")}
      <div class="df-row">
        ${blocked ? "" : `<button class="btn btn-primary" id="df-go">Move ${size(p.need)} there</button>`}
        <button class="btn btn-quiet" id="df-again">Choose another</button>
      </div>
      ${blocked ? "" : `<p class="stamp">NeuroNet can't be used while it copies. A big library
        takes a while — roughly a minute for every few gigabytes on a USB drive.</p>`}
    </div>`;
    box.querySelector("#df-again").onclick = pick;
    const go = box.querySelector("#df-go");
    if (go) go.onclick = () => start(p.chosen);
  }

  /* ---- the move, behind a covering screen ---------------------------------- */
  let veil = null;
  function cover(html) {
    if (!veil) {
      veil = document.createElement("div");
      veil.className = "df-veil";
      document.body.appendChild(veil);
    }
    veil.innerHTML = `<div class="df-box" role="dialog" aria-live="polite">${html}</div>`;
    return veil;
  }
  function uncover() { if (veil) { veil.remove(); veil = null; } }

  async function start(chosen) {
    const r = await call("data_move_start", [chosen], "Starting the move");
    if (!r || r.error) { toast((r && r.error) || "It didn't start.", "error"); return; }
    cover(`<h2>Moving your data</h2><p class="stamp">Getting ready…</p>`);
    const tick = async () => {
      const st = await call("data_move_status", [], "");
      if (!st) return;
      if (st.state === "running") {
        const pct = Math.round((st.fraction || 0) * 100);
        const copying = st.phase === "copying";
        cover(`<h2>Moving your data</h2>
          <div class="df-bar"><span style="width:${copying ? pct : 100}%"></span></div>
          <p class="stamp">${esc(PHASES[st.phase] || st.phase || "Working")}${
            copying && st.total ? ` — ${size(st.done)} of ${size(st.total)} · ${pct}%` : "…"}</p>
          ${copying ? `<button class="btn btn-quiet" id="df-cancel">Cancel</button>` : ""}`);
        const c = veil.querySelector("#df-cancel");
        if (c) c.onclick = () => { c.disabled = true; c.textContent = "Cancelling…"; call("data_move_cancel", [], ""); };
        return;
      }
      clearInterval(timer);
      const res = st.result || {};
      if (st.state !== "done") {
        cover(`<h2>${res.cancelled ? "Cancelled" : "The move didn't finish"}</h2>
          <p>${esc(res.error || "Something went wrong.")}</p>
          <div class="df-row"><button class="btn btn-primary" id="df-close">Close</button></div>`);
        veil.querySelector("#df-close").onclick = () => { uncover(); render(host); };
        return;
      }
      cover(`<h2>Moved</h2>
        <p>Your data is now in <b class="df-path">${esc(res.target)}</b>.</p>
        ${res.old ? `<p class="stamp">The old folder is kept as <b class="df-path">${esc(res.old)}</b> —
          delete it yourself once you're happy everything is there.</p>` : ""}
        ${res.note ? `<p class="df-warn">${esc(res.note)}</p>` : ""}
        <p class="stamp">NeuroNet is restarting to use it…</p>`);
      setTimeout(() => call("app_restart", [], "Restarting"), 4000);
    };
    const timer = setInterval(tick, 700);
    tick();
  }

  /* ---- at start: the data is on a drive that isn't here --------------------- */
  function showMissing(path) {
    cover(`<h2>NeuroNet's data isn't here</h2>
      <p>It's kept on another drive, in <b class="df-path">${esc(path)}</b>, and that drive
        isn't connected.</p>
      <p class="stamp">Plug it in, then press Try again. Nothing has been changed.</p>
      <div class="df-row"><button class="btn btn-primary" id="df-retry">Try again</button></div>`);
    veil.querySelector("#df-retry").onclick = () => call("app_restart", [], "Restarting");
  }

  SS.DataFolder = {render, showMissing, _test: {size, showPlan: (el, p) => { host = el; showPlan(p); }}};
})();
