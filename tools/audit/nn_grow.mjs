// leak or cache (3 Nov 2026)? On the SAMPLE NeuroNet only: each view is visited 4 times, then 8 more; a cache stops growing,
// a leak keeps going. Nodes and listeners after garbage collection. AUDIT_VIEWS=a,b,c
const [, , port = "9241"] = process.argv;
const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const ws = new WebSocket(list.find((p) => p.type === "page").webSocketDebuggerUrl);
let n = 0; const wait = {};
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (wait[m.id]) { wait[m.id](m); delete wait[m.id]; } };
const call = (method, params = {}) => new Promise((r) => { const id = ++n; wait[id] = r; ws.send(JSON.stringify({id, method, params})); });
await new Promise((r) => { ws.onopen = r; });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const js = async (expr) => { const r = await call("Runtime.evaluate", {expression: expr, awaitPromise: true, returnByValue: true}); return r.result && r.result.result ? r.result.result.value : undefined; };
if (!(await js(`SS.Store.call("kc_get_data", []).then((d) => (d.contacts || []).some((c) => c.name === "Nana June"))`))) { console.error("refusing"); process.exit(1); }
const pt = async () => { await call("HeapProfiler.collectGarbage"); await sleep(150); const d = (await call("Memory.getDOMCounters")).result; return [d.nodes, d.jsEventListeners]; };
const go = async (k) => { await js(`try { SS.openSection(${JSON.stringify(k)}); } catch (e) {} 1`); await sleep(300); };
for (const v of (process.env.AUDIT_VIEWS || "").split(",")) {
  await go(v); await go("home");
  const a = await pt(); for (let i = 0; i < 4; i++) { await go(v); await go("home"); } const b = await pt(); for (let i = 0; i < 8; i++) { await go(v); await go("home"); } const c = await pt();
  console.log(v.padEnd(20), "4 visits: nodes +" + (b[0] - a[0]) + " listeners +" + (b[1] - a[1]), " | 8 more: nodes +" + (c[0] - b[0]) + " listeners +" + (c[1] - b[1]));
}
console.log("grow done"); ws.close();
