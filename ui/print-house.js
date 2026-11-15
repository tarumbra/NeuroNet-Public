/* ==========================================================================
   SS.PrintHouse -- the house style every printout shares (2026-10-05)
   ==========================================================================
   Cam, after the Training refresh: "That is amazing, it looks clean and
   professional. I would like all printouts from Neuronet to be handled in
   this way please."

   The stylesheet itself is NOT here. It lives in print_header.py beside the
   letterhead (HOUSE_CSS) and is asked for across the bridge, once, so the
   Python builders (Training, the PDFs) and the JavaScript ones (recipes,
   Stuff, Money, notebooks, puzzles, stats) can never drift apart. This file
   only fetches it and builds the shared pieces with its class names:

     titleBlock(kicker, title, chips, sub)  what it is, its name, its facts
     section(text)                          a section heading
     panel(label, html)                     a quiet boxed note
     foot(left)                             the line at the end, with the date

   A page puts SS.PrintHouse.css FIRST in its <style>, then its own rules,
   so a module keeps only what is truly its own.
   ========================================================================== */
window.SS = window.SS || {};
SS.PrintHouse = (() => {
  "use strict";
  let css = "";
  let loading = null;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g,
    (c) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));

  /** Fetches the house stylesheet once; "" when it can't be had (the page still prints). */
  function load() {
    if (css) return Promise.resolve(css);
    if (loading) return loading;
    loading = (async () => {
      try {
        const api = window.pywebview && window.pywebview.api;
        if (api && typeof api.print_house_css === "function") {
          const r = await api.print_house_css();
          if (typeof r === "string") css = r;
        }
      } catch (e) { /* printed without it */ }
      loading = null;
      return css;
    })();
    return loading;
  }

  function titleBlock(kicker, title, chips, sub) {
    const c = (chips || []).filter((x) => x && String(x[1] == null ? "" : x[1]).trim())
      .map(([k, v]) => `<span class="nn-chip"><b>${esc(k)}</b> ${esc(v)}</span>`).join("");
    return `<div class="nn-title-block"><div class="nn-kicker">${esc(kicker)}</div>`
      + `<div class="nn-title">${esc(title)}</div>`
      + (sub ? `<div class="nn-sub">${esc(sub)}</div>` : "")
      + (c ? `<div class="nn-chips">${c}</div>` : "") + "</div>";
  }
  const section = (text, extra) => `<h2>${esc(text)}${extra || ""}</h2>`;
  const panel = (label, html) =>
    `<div class="nn-panel">${label ? `<div class="nn-panel-label">${esc(label)}</div>` : ""}${html}</div>`;
  function foot(left, right) {
    const date = new Date().toLocaleDateString("en-GB", {day: "2-digit", month: "short", year: "numeric"});
    return `<div class="nn-foot"><span>${esc(left)}</span><span>${esc(right || "NeuroNet")} · printed ${esc(date)}</span></div>`;
  }

  // fetched as soon as the bridge is up, so a page built without awaiting load()
  // (Money's) still has it by the time anyone prints
  window.addEventListener("pywebviewready", () => { load(); });
  setTimeout(() => { if (window.pywebview && window.pywebview.api) load(); }, 0);

  return {
    load, titleBlock, section, panel, foot, esc,
    get css() { return css; },
  };
})();
