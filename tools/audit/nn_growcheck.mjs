// The growth check the test suite runs (test/test_memory_growth.py, 3 Nov 2026). On the SAMPLE NeuroNet only (nn_sandbox.sh,
// AUDIT_SCRIPT=nn_growcheck.mjs): the views that leaked before the audit are each visited once to warm, 4 times, then 8 more;
// a cache stops growing, a leak keeps going, so only the last 8 count. Then a minute still on the dashboard, the sandbox's
// own processes' memory read from /proc (the clock's leak was outside the JS heap). Writes growcheck.json.
import fs from "fs";
import path from "path";
const [, , port = "9241", OUT] = process.argv;
fs.mkdirSync(OUT, {recursive: true});
const APP = process.env.AUDIT_APP || "";
const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const ws = new WebSocket(list.find((p) => p.type === "page").webSocketDebuggerUrl);
let n = 0; const wait = {};
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (wait[m.id]) { wait[m.id](m); delete wait[m.id]; } };
const call = (method, params = {}) => new Promise((r) => { const id = ++n; wait[id] = r; ws.send(JSON.stringify({id, method, params})); });
await new Promise((r) => { ws.onopen = r; });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const js = async (expr) => { const r = await call("Runtime.evaluate", {expression: expr, awaitPromise: true, returnByValue: true}); return r.result && r.result.result ? r.result.result.value : undefined; };
if (!(await js(`SS.Store.call("kc_get_data", []).then((d) => (d.contacts || []).some((c) => c.name === "Nana June"))`))) { console.error("nn_growcheck: refusing -- not the sample NeuroNet"); process.exit(1); }
await call("Emulation.setDeviceMetricsOverride", {width: 1600, height: 900, deviceScaleFactor: 1, mobile: false});
const pt = async () => { await call("HeapProfiler.collectGarbage"); await sleep(200); const d = (await call("Memory.getDOMCounters")).result; return {nodes: d.nodes, listeners: d.jsEventListeners}; };
const go = async (k) => { await js(`try { SS.openSection(${JSON.stringify(k)}); } catch (e) {} 1`); await sleep(280); };
// the sandbox's processes: its python3 (cwd = its app folder) and everything under it
function mb() {
  if (!APP) return 0;
  const pids = fs.readdirSync("/proc").filter((x) => /^\d+$/.test(x)), kids = {};
  let root = null;
  for (const p of pids) {
    try { const st = fs.readFileSync(`/proc/${p}/stat`, "utf8"); const pp = +st.slice(st.lastIndexOf(")") + 2).split(" ")[1]; (kids[pp] = kids[pp] || []).push(+p);
      if (fs.readlinkSync(`/proc/${p}/cwd`) === APP && fs.readFileSync(`/proc/${p}/comm`, "utf8").trim() === "python3") root = +p; } catch (e) { /* not ours, or gone */ }
  }
  if (!root) return 0;
  let kb = 0; const walk = (p) => { try { kb += +(fs.readFileSync(`/proc/${p}/status`, "utf8").match(/VmRSS:\s+(\d+)/) || [0, 0])[1]; } catch (e) { /* gone */ } (kids[p] || []).forEach(walk); };
  walk(root); return Math.round(kb / 1024);
}
const VIEWS = (process.env.AUDIT_VIEWS || "music:library,photos,training:sessions,div:iching,settings:stats,home:dashboard,notes:vault,games:home,div:runes,settings:widgets").split(",");
const out = {views: [], idle: null};
for (const v of VIEWS) {
  await go(v); await go("home");
  const a = await pt(); for (let i = 0; i < 4; i++) { await go(v); await go("home"); }
  const b = await pt(); for (let i = 0; i < 8; i++) { await go(v); await go("home"); }
  const c = await pt();
  const r = {view: v, first4: {nodes: b.nodes - a.nodes, listeners: b.listeners - a.listeners}, next8: {nodes: c.nodes - b.nodes, listeners: c.listeners - b.listeners}};
  out.views.push(r); console.log(v.padEnd(20), JSON.stringify(r.next8));
}
await go("home"); await sleep(5000);
const m0 = mb(); await sleep(60000); await call("HeapProfiler.collectGarbage"); await sleep(500); const m1 = mb();
out.idle = {startMB: m0, endMB: m1, grewMB: m1 - m0};
console.log("a minute on the dashboard:", JSON.stringify(out.idle));
fs.writeFileSync(path.join(OUT, "growcheck.json"), JSON.stringify(out, null, 1));
console.log("growcheck done"); ws.close();
