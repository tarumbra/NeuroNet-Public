/* The browser suite's page side (2026-10-13, audit SE-11): waits for the game to start, runs the scenario
   (window.__SCENARIO, from scenario.js), then writes what passed into <pre id="__results"> for run.js to read. */
(async function () {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = [];
  const ok = (name, cond, detail) => out.push({name, ok: !!cond, detail: detail === undefined ? "" : String(detail)});
  for (let i = 0; i < 100 && !(window.SS && SS.go && SS.Pet); i++) await sleep(50);
  await sleep(600);
  const t = {
    ok, sleep,
    go: async (k) => { SS.go(k); await sleep(500); },
    $: (q) => document.querySelector(q),
    $$: (q) => [...document.querySelectorAll(q)],
    click: async (q) => { const e = document.querySelector(q); if (!e) throw new Error("nothing matches " + q); e.dispatchEvent(new MouseEvent("click", {bubbles: true})); await sleep(400); },   // (an SVG shape has no .click())
    saved: () => window.__saved(),
    errors: () => window.__errors.slice(),
  };
  try { await window.__SCENARIO(t); } catch (e) { ok("the scenario ran to the end", false, e && e.stack || e); }
  const pre = document.createElement("pre");
  pre.id = "__results";
  pre.textContent = JSON.stringify(out);
  document.body.appendChild(pre);
})();
