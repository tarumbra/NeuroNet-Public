// What keeps a leaked page alive (3 Nov 2026)? On the SAMPLE NeuroNet only: a view is visited a few times, a heap snapshot is
// taken, and for the detached elements the chain of what refers to them is walked back towards the window -- printed as the
// most common paths, so the code holding the old page shows by name.   AUDIT_VIEW=music:library
const [, , port = "9241"] = process.argv;
const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const ws = new WebSocket(list.find((p) => p.type === "page").webSocketDebuggerUrl);
let n = 0; const wait = {}; let chunks = [];
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (wait[m.id]) { wait[m.id](m); delete wait[m.id]; } else if (m.method === "HeapProfiler.addHeapSnapshotChunk") chunks.push(m.params.chunk); };
const call = (method, params = {}) => new Promise((r) => { const id = ++n; wait[id] = r; ws.send(JSON.stringify({id, method, params})); });
await new Promise((r) => { ws.onopen = r; });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const js = async (expr) => { const r = await call("Runtime.evaluate", {expression: expr, awaitPromise: true, returnByValue: true}); return r.result && r.result.result ? r.result.result.value : undefined; };
if (!(await js(`SS.Store.call("kc_get_data", []).then((d) => (d.contacts || []).some((c) => c.name === "Nana June"))`))) { console.error("refusing"); process.exit(1); }
const V = process.env.AUDIT_VIEW || "music:library";
for (let i = 0; i < 5; i++) { await js(`SS.openSection(${JSON.stringify(V)}); 1`); await sleep(400); await js(`SS.openSection("home"); 1`); await sleep(300); }
await call("HeapProfiler.collectGarbage"); await sleep(300);
await call("HeapProfiler.takeHeapSnapshot", {reportProgress: false});
const snap = JSON.parse(chunks.join("")); chunks = [];
const M = snap.snapshot.meta, NF = M.node_fields.length, EF = M.edge_fields.length, S = snap.strings;
const nType = M.node_types[0], eType = M.edge_types[0];
const iName = M.node_fields.indexOf("name"), iEdges = M.node_fields.indexOf("edge_count"), iType = M.node_fields.indexOf("type");
const eT = M.edge_fields.indexOf("type"), eN = M.edge_fields.indexOf("name_or_index"), eTo = M.edge_fields.indexOf("to_node");
const N = snap.nodes, E = snap.edges, count = N.length / NF;
const rev = Array.from({length: count}, () => []);
for (let i = 0, e = 0; i < count; i++) {
  const ec = N[i * NF + iEdges];
  for (let k = 0; k < ec; k++, e += EF) {
    const t = eType[E[e + eT]]; if (t === "weak" || t === "shortcut") continue;
    const to = E[e + eTo] / NF; const nm = t === "element" || t === "hidden" ? "[" + E[e + eN] + "]" : S[E[e + eN]];
    rev[to].push([i, nm, t]);
  }
}
const nameOf = (i) => S[N[i * NF + iName]], typeOf = (i) => nType[N[i * NF + iType]];
const iDet = M.node_fields.indexOf("detachedness");          // (newer Chromium: 2 = detached; older: a "Detached " name)
const isDet = (i) => (iDet >= 0 && N[i * NF + iDet] === 2) || /^Detached /.test(nameOf(i));
const detached = []; for (let i = 0; i < count; i++) if (isDet(i)) detached.push(i);
console.log("detached nodes:", detached.length);
// for a sample of detached nodes, the first retainer path that leaves the detached tree (BFS back to a non-DOM owner)
const paths = {};
for (const start of detached.filter((_, j) => j % Math.max(1, Math.floor(detached.length / 60)) === 0)) {
  const seen = new Set([start]), q = [[start, []]]; let found = null;
  while (q.length && !found) {
    const [i, path] = q.shift(); if (path.length > 9) continue;
    for (const [from, nm, t] of rev[i]) {
      if (seen.has(from)) continue; seen.add(from);
      const fname = nameOf(from), ft = typeOf(from);
      const p2 = [`${fname.slice(0, 40)}(${ft}).${nm}`].concat(path);
      if (isDet(from) || ft === "hidden" || /^system \/ /.test(fname)) { q.push([from, p2]); continue; }
      if (ft === "closure" || ft === "object" || /Window|global/.test(fname)) { found = p2.slice(0, 5).join(" <- "); break; }
      q.push([from, p2]);
    }
  }
  if (found) paths[found] = (paths[found] || 0) + 1;
}
Object.entries(paths).sort((a, b) => b[1] - a[1]).slice(0, 8).forEach(([p, c]) => console.log(String(c).padStart(3), p));
console.log("retain done"); ws.close();
