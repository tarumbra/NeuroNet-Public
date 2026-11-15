// does a view grow while nobody touches it (3 Nov 2026)? SAMPLE NeuroNet only: open AUDIT_VIEW, sit still, sample the
// sandbox's renderer, JS heap, DOM and the page's work (script / layout / style) every 30 s.
import fs from "fs";
const [, , port = "9241"] = process.argv;
const APP = process.env.AUDIT_APP || "", V = process.env.AUDIT_VIEW || "home", MIN = +(process.env.AUDIT_MIN || 5);
const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const ws = new WebSocket(list.find((p) => p.type === "page").webSocketDebuggerUrl);
let n = 0; const wait = {};
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (wait[m.id]) { wait[m.id](m); delete wait[m.id]; } };
const call = (method, params = {}) => new Promise((r) => { const id = ++n; wait[id] = r; ws.send(JSON.stringify({id, method, params})); });
await new Promise((r) => { ws.onopen = r; });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const js = async (expr) => { const r = await call("Runtime.evaluate", {expression: expr, awaitPromise: true, returnByValue: true}); return r.result && r.result.result ? r.result.result.value : undefined; };
if (!(await js(`SS.Store.call("kc_get_data", []).then((d) => (d.contacts || []).some((c) => c.name === "Nana June"))`))) { console.error("refusing"); process.exit(1); }
await call("Performance.enable");
let root = null; for (const p of fs.readdirSync("/proc").filter((x) => /^\d+$/.test(x))) { try { if (fs.readlinkSync(`/proc/${p}/cwd`) === APP && fs.readFileSync(`/proc/${p}/comm`, "utf8").trim() === "python3") root = +p; } catch (e) {} }
const kids = () => { const all = {}; for (const p of fs.readdirSync("/proc").filter((x) => /^\d+$/.test(x))) { try { const st = fs.readFileSync(`/proc/${p}/stat`, "utf8"); const pp = +st.slice(st.lastIndexOf(")") + 2).split(" ")[1]; (all[pp] = all[pp] || []).push(+p); } catch (e) {} } return all; };
const rend = () => { const t = kids(); let r = 0; const walk = (p) => { try { if (/--type=renderer/.test(fs.readFileSync(`/proc/${p}/cmdline`, "utf8"))) r += +(fs.readFileSync(`/proc/${p}/status`, "utf8").match(/VmRSS:\s+(\d+)/) || [0, 0])[1] / 1024; } catch (e) {} (t[p] || []).forEach(walk); }; walk(root); return Math.round(r); };
// AUDIT_NOCLOCK=1: the top bar's clock (chords.js paintClock) is left unpainted, to see what it costs
if (process.env.AUDIT_NOCLOCK) await js(`(() => { const r = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = (f) => (f && f.name === "paintClock" ? 0 : r(f)); return 1; })()`);
// AUDIT_UNFOCUS=1: the page is told it isn't the window in front (as a NeuroNet tucked away is)
if (process.env.AUDIT_UNFOCUS) await js(`(() => { document.hasFocus = () => false; return 1; })()`);
// AUDIT_FMT=2: the same with the formatters made once and reused
if (process.env.AUDIT_FMT === "2") await js(`(() => { const a = new Intl.DateTimeFormat(undefined, {weekday: "short", hour: "numeric", minute: "2-digit", second: "2-digit"}), b = new Intl.DateTimeFormat(undefined, {hour: "numeric", minute: "2-digit", second: "2-digit"});
  setInterval(() => { const d = new Date(); window.__f = [a.format(d), b.format(d)].join(); }, 1000); return 1; })()`);
// AUDIT_FMT=1: just the clock's date formatting, once a second, nothing written to the page
if (process.env.AUDIT_FMT === "1") await js(`(() => { setInterval(() => { const d = new Date(); window.__f = [d.toLocaleString(undefined, {weekday: "short", hour: "numeric", minute: "2-digit", second: "2-digit"}), d.toLocaleString(undefined, {hour: "numeric", minute: "2-digit", second: "2-digit"})].join(); }, 1000); return 1; })()`);
await js(`SS.openSection(${JSON.stringify(V)}); 1`); await sleep(3000);
const m0 = Object.fromEntries((await call("Performance.getMetrics")).result.metrics.map((m) => [m.name, m.value]));
for (let k = 0; k <= MIN * 2; k++) {
  const m = Object.fromEntries((await call("Performance.getMetrics")).result.metrics.map((x) => [x.name, x.value])), d = (await call("Memory.getDOMCounters")).result;
  console.log(`${V} ${String(k * 30).padStart(4)} s  renderer ${rend()} MB  heap ${(m.JSHeapUsedSize / 1048576).toFixed(1)}  nodes ${d.nodes}  script ${Math.round((m.ScriptDuration - m0.ScriptDuration) * 1000)} ms  layouts ${m.LayoutCount - m0.LayoutCount}  styles ${m.RecalcStyleCount - m0.RecalcStyleCount}`);
  if (k < MIN * 2) await sleep(30000);
}
console.log("idleview done"); ws.close();
