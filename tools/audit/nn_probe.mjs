// a one-off look inside a view after repeated visits, on the SAMPLE NeuroNet only (AUDIT_VIEW, AUDIT_EXPR)
const [, , port = "9241"] = process.argv;
const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const ws = new WebSocket(list.find((p) => p.type === "page").webSocketDebuggerUrl);
let n = 0; const wait = {};
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (wait[m.id]) { wait[m.id](m); delete wait[m.id]; } };
const call = (method, params = {}) => new Promise((r) => { const id = ++n; wait[id] = r; ws.send(JSON.stringify({id, method, params})); });
await new Promise((r) => { ws.onopen = r; });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const js = async (expr) => { const r = await call("Runtime.evaluate", {expression: expr, awaitPromise: true, returnByValue: true}); return r.result && r.result.result ? r.result.result.value : r; };
if (!(await js(`SS.Store.call("kc_get_data", []).then((d) => (d.contacts || []).some((c) => c.name === "Nana June"))`))) { console.error("refusing"); process.exit(1); }
const V = process.env.AUDIT_VIEW, E = process.env.AUDIT_EXPR;
for (let i = 0; i < 4; i++) { await js(`SS.openSection(${JSON.stringify(V)}); 1`); await sleep(400); console.log("in  ", i, JSON.stringify(await js(E))); await js(`SS.openSection("home"); 1`); await sleep(400); console.log("home", i, JSON.stringify(await js(E))); }
ws.close();
