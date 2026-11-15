// The NeuroNet performance audit (3 Nov 2026): memory, leaks, idle work and redraw, section by section, on the SAMPLE NeuroNet
// only (tools/audit/nn_sandbox.sh with AUDIT_SCRIPT=nn_perf.mjs). For every view: how long it takes to open, its DOM nodes,
// event listeners and JS heap, the endless animations running in it, and what it costs sitting still for three seconds
// (style recalcs, layouts, script and CPU time). Then leak rounds -- every view, again and again, garbage collected in
// between -- and a minute idle on the dashboard. The sandbox's own processes' memory (never the real NeuroNet's) is read
// from /proc at each checkpoint. Refuses unless the app holds the sample household ("Nana June").
//     node tools/audit/nn_perf.mjs <port> <out dir>        (AUDIT_APP=<the sandbox's app folder>)
import fs from "fs";
import path from "path";
const [, , port = "9241", OUT] = process.argv;
fs.mkdirSync(OUT, {recursive: true});
const APP = process.env.AUDIT_APP || "";
const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const ws = new WebSocket(list.find((p) => p.type === "page").webSocketDebuggerUrl);
let n = 0; const wait = {}, events = [];
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (wait[m.id]) { wait[m.id](m); delete wait[m.id]; } else if (m.method) events.push(m); };
const call = (method, params = {}) => new Promise((r) => { const id = ++n; wait[id] = r; ws.send(JSON.stringify({id, method, params})); });
await new Promise((r) => { ws.onopen = r; });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const js = async (expr) => { const r = await call("Runtime.evaluate", {expression: expr, awaitPromise: true, returnByValue: true}); return r.result && r.result.result ? r.result.result.value : undefined; };
const sample = await js(`SS.Store.call("kc_get_data", []).then((d) => (d.contacts || []).some((c) => c.name === "Nana June"))`);
if (!sample) { console.error("nn_perf: refusing -- not the sample NeuroNet"); process.exit(1); }
await call("Emulation.setDeviceMetricsOverride", {width: 1600, height: 900, deviceScaleFactor: 1, mobile: false});
await call("Performance.enable"); await call("LayerTree.enable").catch(() => {});
const metrics = async () => Object.fromEntries(((await call("Performance.getMetrics")).result.metrics || []).map((m) => [m.name, m.value]));

// the sandbox's processes: its python3 (cwd = the sandbox's app folder) and every process under it
const kids = () => { const all = {}; for (const p of fs.readdirSync("/proc").filter((x) => /^\d+$/.test(x))) { try { const st = fs.readFileSync(`/proc/${p}/stat`, "utf8"); const pp = +st.slice(st.lastIndexOf(")") + 2).split(" ")[1]; (all[pp] = all[pp] || []).push(+p); } catch (e) { /* gone */ } } return all; };
function procs() {
  if (!APP) return [];
  let root = null;
  for (const p of fs.readdirSync("/proc").filter((x) => /^\d+$/.test(x))) { try { if (fs.readlinkSync(`/proc/${p}/cwd`) === APP && fs.readFileSync(`/proc/${p}/comm`, "utf8").trim() === "python3") root = +p; } catch (e) { /* not ours */ } }
  if (!root) return [];
  const tree = kids(), out = [], walk = (p) => { out.push(p); (tree[p] || []).forEach(walk); }; walk(root);
  return out.map((p) => { try { const st = fs.readFileSync(`/proc/${p}/status`, "utf8"), cmd = fs.readFileSync(`/proc/${p}/cmdline`, "utf8").replace(/\0/g, " ");
    const rss = +(st.match(/VmRSS:\s+(\d+)/) || [0, 0])[1] / 1024; const type = /--type=renderer/.test(cmd) ? "renderer" : /--type=gpu/.test(cmd) ? "gpu" : /QtWebEngine/.test(cmd) ? "helper" : /python3/.test(cmd) ? "python" : "other";
    return {pid: p, type, mb: Math.round(rss)}; } catch (e) { return null; } }).filter(Boolean);
}
const byType = (ps) => ps.reduce((a, p) => { a[p.type] = (a[p.type] || 0) + p.mb; return a; }, {});
const gcPoint = async (label) => {
  await call("HeapProfiler.collectGarbage"); await sleep(300);
  const dom = (await call("Memory.getDOMCounters")).result, heap = (await call("Runtime.getHeapUsage")).result, ps = procs();
  return {label, nodes: dom.nodes, listeners: dom.jsEventListeners, docs: dom.documents, heapMB: +(heap.usedSize / 1048576).toFixed(1), procs: byType(ps), totalMB: ps.reduce((a, p) => a + p.mb, 0)};
};
const ANIMS = `(() => { const a = document.getAnimations().filter((x) => x.playState === "running"); return {running: a.length,
  infinite: a.filter((x) => x.effect && x.effect.getTiming().iterations === Infinity).length,
  names: [...new Set(a.filter((x) => x.effect && x.effect.getTiming().iterations === Infinity).map((x) => (x.animationName || x.constructor.name) + "@" + ((x.effect.target && (x.effect.target.className || x.effect.target.tagName)) + "").slice(0, 40)))].slice(0, 6) }; })()`;

const views = await js(`(() => { const out = []; (window.SS && SS.sections ? SS.sections() : SECTIONS).forEach((s) => { out.push({key: s.key, name: s.name, section: s.name});
  (s.children || []).forEach((c) => out.push({key: c.key, name: c.name, section: s.name})); }); return out; })()`) || [];
const out = {views: [], gc: [], idle: [], start: await gcPoint("start")};
console.log("views:", views.length, "start", out.start.totalMB, "MB");
for (const v of views) {
  const t = await js(`new Promise((res) => { const a = performance.now(); try { SS.openSection(${JSON.stringify(v.key)}); } catch (e) { return res(-1); } requestAnimationFrame(() => requestAnimationFrame(() => res(performance.now() - a))); })`);
  await sleep(1300);
  events.length = 0;
  const a = await metrics(); await sleep(3000); const b = await metrics();
  const paints = events.filter((e) => e.method === "LayerTree.layerPainted"), area = paints.reduce((s, e) => s + (e.params.clip ? e.params.clip.width * e.params.clip.height : 0), 0);
  const anim = await js(ANIMS) || {};
  const dom = (await call("Memory.getDOMCounters")).result;
  const d = (k) => +(b[k] - a[k]).toFixed(4);
  out.views.push({...v, openMs: Math.round(t * 10) / 10, nodes: dom.nodes, listeners: dom.jsEventListeners, heapMB: +(b.JSHeapUsedSize / 1048576).toFixed(1),
    idle: {styles: d("RecalcStyleCount"), layouts: d("LayoutCount"), scriptMs: Math.round(d("ScriptDuration") * 1e4) / 10, taskMs: Math.round(d("TaskDuration") * 1e4) / 10, paints: paints.length, paintMpx: +(area / 1e6).toFixed(1)},
    anim, mb: procs().reduce((s, p) => s + p.mb, 0)});
  const last = out.views[out.views.length - 1];
  console.log(v.key.padEnd(22), String(last.openMs).padStart(7), "ms", String(last.nodes).padStart(6), "nodes", "idle styles", last.idle.styles, "task", last.idle.taskMs, "ms", "inf", anim.infinite, last.mb, "MB");
}
// leaks: every view, four rounds, garbage collected between
out.gc.push(await gcPoint("before rounds"));
for (let round = 1; round <= 4; round++) {
  for (const v of views) { await js(`try { SS.openSection(${JSON.stringify(v.key)}); } catch (e) {} 1`); await sleep(220); }
  await js(`SS.openSection("home"); 1`); await sleep(600);
  out.gc.push(await gcPoint("after round " + round));
  console.log("round", round, JSON.stringify(out.gc[out.gc.length - 1]));
}
// a minute still on the dashboard
await js(`SS.openSection("home"); 1`); await sleep(1500);
const i0 = await metrics();
for (let k = 0; k < 6; k++) { await sleep(10000); const m = await metrics(); out.idle.push({s: (k + 1) * 10, styles: m.RecalcStyleCount - i0.RecalcStyleCount, layouts: m.LayoutCount - i0.LayoutCount, taskMs: Math.round((m.TaskDuration - i0.TaskDuration) * 1000), heapMB: +(m.JSHeapUsedSize / 1048576).toFixed(1), mb: procs().reduce((s, p) => s + p.mb, 0)}); }
out.end = await gcPoint("end");
fs.writeFileSync(path.join(OUT, "nnperf.json"), JSON.stringify(out, null, 1));
console.log("end", JSON.stringify(out.end));
ws.close();
