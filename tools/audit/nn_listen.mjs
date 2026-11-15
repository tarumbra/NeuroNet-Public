// Where do the leaked listeners come from (3 Nov 2026)? On the SAMPLE NeuroNet only (nn_sandbox.sh, AUDIT_SCRIPT=nn_listen.mjs):
// for each suspect view, the listeners on window, document and every element in the page are listed before and after four
// visits, and the ones that were added and never taken away are printed with the file and line of their handler.
//     node tools/audit/nn_listen.mjs <port> <out dir>       (AUDIT_VIEWS=a,b,c to choose the views)
import fs from "fs";
import path from "path";
const [, , port = "9241", OUT] = process.argv;
fs.mkdirSync(OUT, {recursive: true});
const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const ws = new WebSocket(list.find((p) => p.type === "page").webSocketDebuggerUrl);
let n = 0; const wait = {}, scripts = {};
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (wait[m.id]) { wait[m.id](m); delete wait[m.id]; } else if (m.method === "Debugger.scriptParsed") scripts[m.params.scriptId] = m.params.url; };
const call = (method, params = {}) => new Promise((r) => { const id = ++n; wait[id] = r; ws.send(JSON.stringify({id, method, params})); });
await new Promise((r) => { ws.onopen = r; });
await call("Debugger.enable"); await call("DOM.enable");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const js = async (expr) => { const r = await call("Runtime.evaluate", {expression: expr, awaitPromise: true, returnByValue: true}); return r.result && r.result.result ? r.result.result.value : undefined; };
const sample = await js(`SS.Store.call("kc_get_data", []).then((d) => (d.contacts || []).some((c) => c.name === "Nana June"))`);
if (!sample) { console.error("nn_listen: refusing -- not the sample NeuroNet"); process.exit(1); }
const objOf = async (expr) => (await call("Runtime.evaluate", {expression: expr})).result.result.objectId;
async function listeners() {
  const out = {};
  const add = (where, ls) => (ls || []).forEach((l) => { const k = `${where} ${l.type} ${(scripts[l.scriptId] || "?").split("/ui/").pop()}:${l.lineNumber + 1}`; out[k] = (out[k] || 0) + 1; });
  for (const [w, e] of [["window", "window"], ["document", "document"]]) add(w, (await call("DOMDebugger.getEventListeners", {objectId: await objOf(e)})).result.listeners);
  // every element in the page (depth -1 walks the whole tree)
  const all = await objOf(`Array.from(document.querySelectorAll("*"))`);
  const props = (await call("Runtime.getProperties", {objectId: all, ownProperties: true})).result.result.filter((p) => /^\d+$/.test(p.name));
  for (const p of props) { const ls = (await call("DOMDebugger.getEventListeners", {objectId: p.value.objectId})).result.listeners; if (ls && ls.length) add("element", ls); }
  return out;
}
const go = async (k) => { await js(`try { SS.openSection(${JSON.stringify(k)}); } catch (e) {} 1`); await sleep(300); };
const VIEWS = (process.env.AUDIT_VIEWS || "music:library,photos,settings:stats,div:iching,training:sessions,home:dashboard,games:home,div:runes,games:wordsearch,games:pegs,games:wordguess").split(",");
const out = {};
for (const v of VIEWS) { await go(v); await go("home"); }          // (warm: the first visit's caches aren't a leak)
for (const v of VIEWS) {
  await call("HeapProfiler.collectGarbage"); const a = await listeners();
  for (let i = 0; i < 4; i++) { await go(v); await go("home"); }
  await call("HeapProfiler.collectGarbage"); const b = await listeners();
  const grew = Object.keys(b).map((k) => [k, b[k] - (a[k] || 0)]).filter((x) => x[1] > 0).sort((x, y) => y[1] - x[1]);
  out[v] = grew; console.log("==", v); grew.slice(0, 10).forEach((g) => console.log("   +" + g[1], g[0]));
}
fs.writeFileSync(path.join(OUT, "nnlisten.json"), JSON.stringify(out, null, 1));
console.log("listen done");
ws.close();
