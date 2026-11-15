// does a desktop widget's request leak (3 Nov 2026)? On the SAMPLE NeuroNet only: org.neuronet.App.Do is called over the
// SANDBOX's own private bus (read from its /proc environ -- never the real session) as the widgets call it, thousands of
// times; the sandbox's processes' memory, JS heap and DOM are counted between batches.
import fs from "fs";
import {execFileSync} from "child_process";
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
let root = null; for (const p of fs.readdirSync("/proc").filter((x) => /^\d+$/.test(x))) { try { if (fs.readlinkSync(`/proc/${p}/cwd`) === APP && fs.readFileSync(`/proc/${p}/comm`, "utf8").trim() === "python3") root = +p; } catch (e) {} }
const bus = (fs.readFileSync(`/proc/${root}/environ`, "utf8").split("\0").find((x) => x.startsWith("DBUS_SESSION_BUS_ADDRESS=unix:path=/tmp/")) || "").split("=").slice(1).join("=");
if (!bus) { console.error("no sandbox bus -- refusing"); process.exit(1); }
const kids = () => { const all = {}; for (const p of fs.readdirSync("/proc").filter((x) => /^\d+$/.test(x))) { try { const st = fs.readFileSync(`/proc/${p}/stat`, "utf8"); const pp = +st.slice(st.lastIndexOf(")") + 2).split(" ")[1]; (all[pp] = all[pp] || []).push(+p); } catch (e) {} } return all; };
const mem = () => { const t = kids(), o = {python: 0, renderer: 0, other: 0}; const walk = (p) => { try { const cmd = fs.readFileSync(`/proc/${p}/cmdline`, "utf8"), r = +(fs.readFileSync(`/proc/${p}/status`, "utf8").match(/VmRSS:\s+(\d+)/) || [0, 0])[1] / 1024;
  o[/--type=renderer/.test(cmd) ? "renderer" : p === root ? "python" : "other"] += Math.round(r); } catch (e) {} (t[p] || []).forEach(walk); }; walk(root); return o; };
const pt = async (label) => { await call("HeapProfiler.collectGarbage"); await sleep(200); const d = (await call("Memory.getDOMCounters")).result, h = (await call("Runtime.getHeapUsage")).result; console.log(label.padEnd(24), JSON.stringify(mem()), "heap", (h.usedSize / 1048576).toFixed(1), "nodes", d.nodes, "listeners", d.jsEventListeners); };
const Do = (action, payload) => { try { execFileSync("gdbus", ["call", "--address", bus, "--dest", "org.neuronet.App", "--object-path", "/org/neuronet/App", "--method", "org.neuronet.App.Do", action, payload], {timeout: 8000, stdio: "pipe"}); } catch (e) { /* answered or timed out */ } };
await js(`SS.openSection("home"); 1`); await sleep(1500);
await pt("start");
for (let b = 1; b <= 5; b++) { for (let i = 0; i < 300; i++) Do("nothing.here", "{}"); await pt(`after ${b * 300} Do calls`); }
await sleep(20000); await pt("20 s later");
console.log("dbus done"); ws.close();
