// Which container keeps growing (3 Nov 2026)? On the SAMPLE NeuroNet only: for each view, every element with an id (or the
// path to it) is counted before and after four visits; the ones that grew are printed. AUDIT_VIEWS=a,b,c
import fs from "fs";
const [, , port = "9241", OUT] = process.argv;
const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const ws = new WebSocket(list.find((p) => p.type === "page").webSocketDebuggerUrl);
let n = 0; const wait = {};
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (wait[m.id]) { wait[m.id](m); delete wait[m.id]; } };
const call = (method, params = {}) => new Promise((r) => { const id = ++n; wait[id] = r; ws.send(JSON.stringify({id, method, params})); });
await new Promise((r) => { ws.onopen = r; });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const js = async (expr) => { const r = await call("Runtime.evaluate", {expression: expr, awaitPromise: true, returnByValue: true}); return r.result && r.result.result ? r.result.result.value : undefined; };
if (!(await js(`SS.Store.call("kc_get_data", []).then((d) => (d.contacts || []).some((c) => c.name === "Nana June"))`))) { console.error("refusing"); process.exit(1); }
const COUNT = `(() => { const o = {}; const name = (e) => e.tagName.toLowerCase() + (e.id ? "#" + e.id : (typeof e.className === "string" && e.className.trim() ? "." + e.className.trim().split(/\\s+/)[0] : ""));
  const walk = (e, p, d) => { const k = p + " > " + name(e); if (d <= 5) o[k] = e.getElementsByTagName("*").length; [...e.children].forEach((c) => walk(c, d < 5 ? k : p, d + 1)); };
  walk(document.body, "", 0); return o; })()`;
const go = async (k) => { await js(`try { SS.openSection(${JSON.stringify(k)}); } catch (e) {} 1`); await sleep(300); };
const VIEWS = (process.env.AUDIT_VIEWS || "music:library,div:iching,games:home,div:runes").split(",");
for (const v of VIEWS) { await go(v); await go("home"); }
for (const v of VIEWS) {
  const a = await js(COUNT); for (let i = 0; i < 4; i++) { await go(v); await go("home"); } const b = await js(COUNT);
  const grew = Object.keys(b).map((k) => [k, b[k] - (a[k] || 0)]).filter((x) => x[1] > 0).sort((x, y) => x[0].length - y[0].length);
  // the deepest containers that grew (their parents grew by the same)
  const deep = grew.filter(([k, d]) => !grew.some(([k2, d2]) => k2 !== k && k2.startsWith(k + " > ") && d2 === d));
  console.log("==", v); deep.slice(0, 6).forEach((g) => console.log("   +" + g[1], g[0].slice(-160)));
}
console.log("where done"); ws.close();
