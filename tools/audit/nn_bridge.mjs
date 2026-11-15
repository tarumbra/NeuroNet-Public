// does talking to NeuroNet leak (3 Nov 2026)? On the SAMPLE NeuroNet only: thousands of bridge round trips and the desktop
// widgets' requests (SS.boardDo), the sandbox's own processes' memory, the JS heap and DOM counted between batches.
import fs from "fs";
const [, , port = "9241"] = process.argv;
const APP = process.env.AUDIT_APP || "";
const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const ws = new WebSocket(list.find((p) => p.type === "page").webSocketDebuggerUrl);
let n = 0; const wait = {};
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (wait[m.id]) { wait[m.id](m); delete wait[m.id]; } };
const call = (method, params = {}) => new Promise((r) => { const id = ++n; wait[id] = r; ws.send(JSON.stringify({id, method, params})); });
await new Promise((r) => { ws.onopen = r; });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const js = async (expr) => { const r = await call("Runtime.evaluate", {expression: expr, awaitPromise: true, returnByValue: true}); return r.result && r.result.result ? r.result.result.value : undefined; };
if (!(await js(`SS.Store.call("kc_get_data", []).then((d) => (d.contacts || []).some((c) => c.name === "Nana June"))`))) { console.error("refusing"); process.exit(1); }
const kids = () => { const all = {}; for (const p of fs.readdirSync("/proc").filter((x) => /^\d+$/.test(x))) { try { const st = fs.readFileSync(`/proc/${p}/stat`, "utf8"); const pp = +st.slice(st.lastIndexOf(")") + 2).split(" ")[1]; (all[pp] = all[pp] || []).push(+p); } catch (e) {} } return all; };
const mem = () => { let root = null; for (const p of fs.readdirSync("/proc").filter((x) => /^\d+$/.test(x))) { try { if (fs.readlinkSync(`/proc/${p}/cwd`) === APP && fs.readFileSync(`/proc/${p}/comm`, "utf8").trim() === "python3") root = +p; } catch (e) {} }
  const t = kids(), o = {python: 0, renderer: 0, other: 0}; const walk = (p) => { try { const cmd = fs.readFileSync(`/proc/${p}/cmdline`, "utf8"), r = +(fs.readFileSync(`/proc/${p}/status`, "utf8").match(/VmRSS:\s+(\d+)/) || [0, 0])[1] / 1024;
    o[/--type=renderer/.test(cmd) ? "renderer" : /python3/.test(cmd) && p === root ? "python" : "other"] += Math.round(r); } catch (e) {} (t[p] || []).forEach(walk); }; if (root) walk(root); return o; };
const pt = async (label) => { await call("HeapProfiler.collectGarbage"); await sleep(200); const d = (await call("Memory.getDOMCounters")).result, h = (await call("Runtime.getHeapUsage")).result; console.log(label.padEnd(26), JSON.stringify(mem()), "heap", (h.usedSize / 1048576).toFixed(1), "nodes", d.nodes, "listeners", d.jsEventListeners); };
await js(`SS.openSection("home"); 1`); await sleep(1500);
await pt("start");
for (let b = 1; b <= 4; b++) { await js(`(async () => { for (let i = 0; i < 500; i++) await SS.Store.call("ping", []); return 1; })()`); await pt(`after ${b * 500} pings`); }
for (let b = 1; b <= 3; b++) { await js(`(async () => { for (let i = 0; i < 100; i++) { await SS.boardDo("t" + i, "nothing.here", "{}"); } return 1; })()`); await pt(`after ${b * 100} music.viz`); }
await sleep(20000); await pt("20 s later");
console.log("bridge done"); ws.close();
