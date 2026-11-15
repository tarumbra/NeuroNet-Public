// The NeuroNet audit's walk through every section (2026-10-19), on a SAMPLE NeuroNet only (tools/make_sample_data.py,
// started by tools/audit/nn_sandbox.sh). For each view: a screenshot, the DevTools performance metrics, the DOM size,
// and a UX probe -- the fonts, text sizes, colours and button styles in use, and text whose contrast is under 4.5:1.
// Refuses unless the app holds the sample household ("Nana June"), like guide_shots.mjs.
//     node tools/audit/nn_audit.mjs <port> <out dir>
import fs from "fs";
import path from "path";
const [, , port = "9241", OUT] = process.argv;
fs.mkdirSync(path.join(OUT, "shots"), {recursive: true});
const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const ws = new WebSocket(list.find((p) => p.type === "page").webSocketDebuggerUrl);
let n = 0; const wait = {};
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (wait[m.id]) { wait[m.id](m); delete wait[m.id]; } };
const call = (method, params = {}) => new Promise((r) => { const id = ++n; wait[id] = r; ws.send(JSON.stringify({id, method, params})); });
await new Promise((r) => { ws.onopen = r; });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const js = async (expr) => { const r = await call("Runtime.evaluate", {expression: expr, awaitPromise: true, returnByValue: true}); return r.result && r.result.result ? r.result.result.value : undefined; };
const sample = await js(`SS.Store.call("kc_get_data", []).then((d) => (d.contacts || []).some((c) => c.name === "Nana June"))`);
if (!sample) { console.error("nn_audit: refusing -- not the sample NeuroNet"); process.exit(1); }
await call("Emulation.setDeviceMetricsOverride", {width: 1400, height: 880, deviceScaleFactor: 1, mobile: false});
await call("Performance.enable");
const metrics = async () => Object.fromEntries(((await call("Performance.getMetrics")).result.metrics || []).map((m) => [m.name, m.value]));

// every section and its children, from the app's own list
const views = await js(`(() => { const out = []; (window.SS && SS.sections ? SS.sections() : SECTIONS).forEach((s) => { out.push({key: s.key, name: s.name, section: s.name});
  (s.children || []).forEach((c) => out.push({key: c.key, name: c.name, section: s.name})); }); return out; })()`) || [];
const PROBE = `(() => {
  const main = document.body;   // (tools mount in their own roots; the probe counts only what is visible on screen)
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight; };
  const rgb = (s) => (s.match(/[\\d.]+/g) || []).map(Number);
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
  const bgOf = (e) => { for (let x = e; x; x = x.parentElement) { const c = rgb(getComputedStyle(x).backgroundColor); if (c.length >= 3 && (c.length < 4 || c[3] > .5)) return c; } return [255, 255, 255]; };
  const fonts = {}, sizes = {}, colors = {}, low = [];
  let texts = 0;
  const w = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
  for (let t; (t = w.nextNode());) {
    if (!t.nodeValue.trim()) continue; const e = t.parentElement; if (!e || !vis(e)) continue;
    const cs = getComputedStyle(e); if (cs.visibility === "hidden" || +cs.opacity === 0) continue;
    texts++;
    const fam = cs.fontFamily.split(",")[0].replace(/["']/g, "").trim(); fonts[fam] = (fonts[fam] || 0) + 1;
    const sz = Math.round(parseFloat(cs.fontSize)); sizes[sz] = (sizes[sz] || 0) + 1;
    colors[cs.color] = (colors[cs.color] || 0) + 1;
    const fg = rgb(cs.color), bg = bgOf(e), a = lum(fg.slice(0, 3)), b = lum(bg.slice(0, 3));
    const ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    const big = sz >= 24 || (sz >= 19 && +cs.fontWeight >= 700);
    if (ratio < (big ? 3 : 4.5)) low.push({text: t.nodeValue.trim().slice(0, 40), ratio: Math.round(ratio * 100) / 100, size: sz});
  }
  const btns = {}; let nb = 0;
  main.querySelectorAll("button, .btn, [role=button]").forEach((b) => { if (!vis(b)) return; nb++; const c = getComputedStyle(b);
    const k = [c.backgroundColor, c.borderRadius, c.fontSize, c.paddingTop + " " + c.paddingLeft, c.borderTopWidth].join(" | "); btns[k] = (btns[k] || 0) + 1; });
  const inputs = main.querySelectorAll("input, select, textarea").length;
  const heads = [...main.querySelectorAll("h1,h2,h3,h4")].filter(vis).map((h) => h.tagName + " " + Math.round(parseFloat(getComputedStyle(h).fontSize)));
  const lineLen = [...main.querySelectorAll("p, li")].filter(vis).map((p) => p.textContent.length).sort((a, b) => b - a)[0] || 0;
  return {texts, fonts, sizes, colors: Object.keys(colors).length, low: low.slice(0, 30), lowCount: low.length, buttons: nb, buttonStyles: Object.keys(btns).length,
    btnTop: Object.entries(btns).sort((a, b) => b[1] - a[1]).slice(0, 6), inputs, heads: [...new Set(heads)], dom: document.getElementsByTagName("*").length,
    mainDom: main.getElementsByTagName("*").length, scrollH: main.scrollHeight, imgs: main.querySelectorAll("img").length, longestText: lineLen };
})()`;
const out = {views: [], boot: await metrics()};
for (const v of views) {
  const before = await metrics();
  const t = await js(`new Promise((res) => { const a = performance.now(); try { SS.openSection(${JSON.stringify(v.key)}); } catch (e) { return res(-1); } requestAnimationFrame(() => requestAnimationFrame(() => res(performance.now() - a))); })`);
  await sleep(1400);
  const after = await metrics();
  const probe = await js(PROBE) || {};
  const shot = await call("Page.captureScreenshot", {format: "jpeg", quality: 78});
  const file = v.key.replace(/[^a-z0-9]+/gi, "_") + ".jpg";
  fs.writeFileSync(path.join(OUT, "shots", file), Buffer.from(shot.result.data, "base64"));
  out.views.push({...v, file, openMs: Math.round(t * 10) / 10, settledScriptMs: Math.round((after.ScriptDuration - before.ScriptDuration) * 1e4) / 10,
    layoutMs: Math.round((after.LayoutDuration - before.LayoutDuration) * 1e4) / 10, heapMB: Math.round(after.JSHeapUsedSize / 1048576 * 10) / 10, ...probe});
  console.log(v.key, Math.round(t), "ms", probe.mainDom, "el", probe.lowCount, "low");
}
// idle: 20 seconds on the dashboard
await js(`SS.openSection("home"); 1`); await sleep(1500);
const a = await metrics(); await sleep(20000); const b = await metrics();
out.idle20s = {scriptMs: Math.round((b.ScriptDuration - a.ScriptDuration) * 1e4) / 10, layoutMs: Math.round((b.LayoutDuration - a.LayoutDuration) * 1e4) / 10, heapMB: Math.round(b.JSHeapUsedSize / 1048576 * 10) / 10};
out.end = b;
fs.writeFileSync(path.join(OUT, "nn.json"), JSON.stringify(out, null, 1));
ws.close();
