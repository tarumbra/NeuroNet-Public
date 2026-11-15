/* ==========================================================================
   Notes — Amnesia's shell, mounted inside KinCrux.
   ==========================================================================
   Same shape as the training bridge, and for the same reasons. Amnesia's
   markup sits in index.html from load, hidden; opening Notes shows it
   and boots it once.

   It loads AFTER app.js and graph.js, not before. Amnesia's app.js owns
   the CC namespace and starts it with `const CC = {}`, so anything that
   assigns onto CC before it is wiped. Its own index.html put graph.js
   after app.js for exactly that reason, and this file has to be after
   both -- it reads CC.Shell, which app.js defines at its very end.
   ========================================================================== */
(function () {
  "use strict";

  const PREFIX = "notes:";

  /* Amnesia is one view with its own internal modes (edit, split, read)
     and its own tree, so the host offers one entry rather than trying to
     mirror a tree that changes every time Cam makes a folder. */
  const VIEWS = ["vault"];

  let mounted = false;

  function shell() { return document.getElementById("cx-shell"); }
  function hostPane() { return document.getElementById("cp-main"); }

  async function mount(host, view) {
    void view;
    const sh = shell();
    if (!sh) { host.textContent = "The notes vault isn't in this build."; return; }

    host.innerHTML = "";
    sh.hidden = false;
    host.style.display = "none";

    if (mounted && window.CC && window.CC.Shell && window.CC.Shell.refresh) window.CC.Shell.refresh();   // back to Notes: what's on disk now (2026-10-12)
    if (!mounted) {
      if (!window.CC || !window.CC.Shell) {
        sh.hidden = true;
        host.style.display = "";
        host.textContent = "The notes module didn't load.";
        return;
      }
      try {
        await window.CC.Shell.boot();
        window.CC.Shell.booted = true;
        mounted = true;
      } catch (e) {
        sh.hidden = true;
        host.style.display = "";
        host.textContent = "The notes vault couldn't open: "
          + ((e && e.message) || e);
      }
    }
  }

  function unmount() {
    const sh = shell();
    if (sh) sh.hidden = true;
    const pane = hostPane();
    if (pane) pane.style.display = "";
  }

  window.CP = window.CP || {};
  window.CP.Notes = {
    mount,
    unmount,
    PREFIX,
    VIEWS: VIEWS.map((v) => PREFIX + v),
    _test: {isMounted: () => mounted},
  };
})();
