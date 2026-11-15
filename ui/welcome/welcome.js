/* ==========================================================================
   The first-boot welcome
   ==========================================================================
   NeuroNet System plan, Stage 3 (2026-09-29). Cam: on a new computer NeuroNet
   should "pop up a window when you boot ... that will ask for an import of a
   data file ... Then it imports once and it is good to go", and "Start fresh"
   for someone who isn't Cam (the ISO goes to family and friends).

   Shown over the app while NeuroNet has no data on this computer and the
   welcome hasn't been answered (neuronet.py's welcome_wanted; at login
   neuronet-quick asks the same, and opens NeuroNet in view). Three answers:

     Bring my NeuroNet across   Settings -> Export & import, and its import
                                started there -- one way imports are done
     Start fresh                answered: it won't show again
     Later                      closed for now; it comes back next time
   ========================================================================== */
(function () {
  "use strict";
  const SS = window.SS = window.SS || {};
  const call = (name, args, what) => SS.Store.call(name, args || [], what || "Welcome");

  let veil = null;

  function close() {
    if (veil) { veil.remove(); veil = null; }
  }

  function show() {
    close();
    veil = document.createElement("div");
    veil.className = "wel-veil";
    veil.innerHTML = `
      <div class="wel-card" role="dialog" aria-labelledby="wel-title">
        <div class="wel-mark" aria-hidden="true"></div>
        <h1 id="wel-title">Welcome to <span class="wel-brand">NeuroNet</span></h1>
        <p class="wel-lead">Is this a new computer for a NeuroNet you already have?
          Bring it all across in one go from an export made on the other computer —
          photos, notes, journal, training, money, cards, and how the desktop was set up.</p>
        <p class="stamp">Make the export on the other computer in
          <b>Settings → Export &amp; import</b>, then send the file here (LocalSend, or a stick).
          Music and films stay behind — copy them across on their own.</p>
        <div class="wel-actions">
          <button class="btn btn-primary" id="wel-across">Bring my NeuroNet across…</button>
          <button class="btn" id="wel-fresh">Start fresh</button>
          <button class="btn btn-quiet" id="wel-later">Later</button>
        </div>
        <p class="stamp wel-fine">You can import at any time from Settings → Export &amp; import.</p>
      </div>`;
    document.body.appendChild(veil);

    veil.querySelector("#wel-across").onclick = () => {
      close();
      SS.go("settings:transfer");
      /* the page draws itself, then its import begins -- the file picker */
      setTimeout(() => SS.Transfer && SS.Transfer.startImport && SS.Transfer.startImport(), 350);
    };
    veil.querySelector("#wel-fresh").onclick = async () => {
      await call("welcome_done", ["fresh"], "");
      close();
      SS.shared.toast("A fresh NeuroNet — it's all yours to fill.", "good");
    };
    veil.querySelector("#wel-later").onclick = close;
    setTimeout(() => { const b = veil && veil.querySelector("#wel-across"); if (b) b.focus(); }, 50);
  }

  /** At boot: show the welcome if this computer wants it. Resolves true when
      it's showing (so boot can hold back its "no library" warning). */
  async function maybeShow() {
    let st = null;
    try { st = await call("welcome_state", [], ""); } catch (e) { st = null; }
    if (st && st.show) { show(); return true; }
    return false;
  }

  SS.Welcome = {maybeShow, show, close};
})();
