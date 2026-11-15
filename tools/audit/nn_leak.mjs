// Which view leaks (3 Nov 2026)? On the SAMPLE NeuroNet only (nn_sandbox.sh with AUDIT_SCRIPT=nn_leak.mjs): every view is
// opened and left four times, garbage collected before and after, and what it leaves behind is counted -- DOM nodes in
// memory (attached or not), nodes still in the page, event listeners, and which of the body's own children grew.
//     node tools/audit/nn_leak.mjs <port> <out dir>
import fs from "fs";
import path from "path";
const [, , port = "9241", OUT] = process.argv;
fs.mkdirSync(OUT, {recursive: true});
const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const ws = new WebSocket(list.find((p) => p.type === "page").webSocketDebuggerUrl);
let n = 0; const wait = {};
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (wait[m.id]) { wait[m.id](m); delete wait[m.id]; } };
const call = (method, params = {}) => new Promise((r) => { const id = ++n; wait[id] = r; ws.send(JSON.stringify({id, method, params})); });
await new Promise((r) => { ws.onopen = r; });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const js = async (expr) => { const r = await call("Runtime.evaluate", {expression: expr, awaitPromise: true, returnByValue: true}); return r.result && r.result.result ? r.result.result.value : undefined; };
const sample = await js(`SS.Store.call("kc_get_data", []).then((d) => (d.contacts || []).some((c) => c.name === "Nana June"))`);
if (!sample) { console.error("nn_leak: refusing -- not the sample NeuroNet"); process.exit(1); }
await call("Emulation.setDeviceMetricsOverride", {width: 1600, height: 900, deviceScaleFactor: 1, mobile: false});
const BODY = `(() => { const o = {}; [...document.body.children].forEach((c, i) => { const k = c.tagName.toLowerCase() + (c.id ? "#" + c.id : "") + (c.className && typeof c.className === "string" ? "." + c.className.trim().split(/\\s+/).slice(0, 2).join(".") : "");
  o[k] = (o[k] || 0) + c.getElementsByTagName("*").length + 1; }); return { live: document.getElementsByTagName("*").length, body: o }; })()`;
const point = async () => { await call("HeapProfiler.collectGarbage"); await sleep(150); const d = (await call("Memory.getDOMCounters")).result, b = await js(BODY); return {nodes: d.nodes, listeners: d.jsEventListeners, live: b.live, body: b.body}; };
const views = await js(`(() => { const out = []; (window.SS && SS.sections ? SS.sections() : SECTIONS).forEach((s) => { out.push({key: s.key, name: s.name, section: s.name});
  (s.children || []).forEach((c) => out.push({key: c.key, name: c.name, section: s.name})); }); return out; })()`) || [];
const go = async (k) => { await js(`try { SS.openSection(${JSON.stringify(k)}); } catch (e) {} 1`); await sleep(260); };
// warm every view once (first visits build their caches -- not a leak)
for (const v of views) await go(v.key);
await go("home"); await sleep(500);
const out = [];
for (const v of views) {
  if (v.key === "home") continue;
  const a = await point();
  for (let i = 0; i < 4; i++) { await go(v.key); await go("home"); }
  const b = await point();
  const grew = Object.keys(b.body).map((k) => [k, b.body[k] - (a.body[k] || 0)]).filter((x) => x[1] > 0).sort((x, y) => y[1] - x[1]).slice(0, 4);
  const r = {key: v.key, name: v.name, section: v.section, nodes: b.nodes - a.nodes, listeners: b.listeners - a.listeners, live: b.live - a.live, grew};
  out.push(r);
  if (r.nodes > 0 || r.listeners > 0) console.log(v.key.padEnd(24), "nodes +" + r.nodes, "listeners +" + r.listeners, "in page +" + r.live, JSON.stringify(grew));
}
fs.writeFileSync(path.join(OUT, "nnleak.json"), JSON.stringify(out, null, 1));
console.log("done", out.filter((r) => r.nodes > 0 || r.listeners > 0).length, "views leave something behind");
ws.close();
