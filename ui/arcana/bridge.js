/* NeuroArcana inside NeuroNet (Cam, 1 Nov 2026): the page's one bridge, AAStore.call(name, args), goes to pywebview's
   neuroarcana.py instead of Electron's preload; the card art lives in arcana-art/. Loaded only by neuroarcana.html. */
(function () {
  "use strict";
  window.AA_ART_BASE = "arcana-art/";
  const ready = new Promise((res) => {
    if (window.pywebview && window.pywebview.api && window.pywebview.api.call) return res();
    window.addEventListener("pywebviewready", () => res(), { once: true });
  });
  window.AAStore = { call: (name, args) => ready.then(() => window.pywebview.api.call(String(name), Array.isArray(args) ? args : [])) };
})();
