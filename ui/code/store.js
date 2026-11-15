/* ==========================================================================
   Algorithm — the bridge to the Python side.

   In NeuroNet (Code -> IDE) every call is answered by NeuroNet's Api as
   code_<name> (neuronet.py, CODE_IDE_CALLS), so the name gets that prefix
   here -- the one change to this file.

   Every call goes through here so the interface never touches pywebview
   directly. Two reasons: the app has to be openable in a plain browser for
   development and testing, and a failed bridge call should surface as a
   message rather than an unhandled rejection.
   ========================================================================== */
window.AL = window.AL || {};

AL.Store = (() => {
  "use strict";

  let resolveReady;
  const ready = new Promise((r) => { resolveReady = r; });

  if (window.pywebview && window.pywebview.api) resolveReady();
  else window.addEventListener("pywebviewready", () => resolveReady());

  const isDesktop = () => !!(window.pywebview && window.pywebview.api);

  /**
   * Call a Python method. Anything that goes wrong — a missing bridge, a
   * thrown exception, a rejected promise — comes back as {error} so callers
   * have exactly one shape to handle.
   */
  async function call(name, ...args) {
    if (!isDesktop()) {
      return { error: `The IDE needs NeuroNet's window for this (${name}).` };
    }
    try {
      const fn = window.pywebview.api["code_" + name];
      if (typeof fn !== "function") return { error: `NeuroNet has no code_${name}.` };
      const result = await fn(...args);
      return result === undefined || result === null ? {} : result;
    } catch (err) {
      const message = (err && err.message) || String(err);
      return { error: message };
    }
  }

  return { ready, isDesktop, call };
})();
