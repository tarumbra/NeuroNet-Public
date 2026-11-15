// Training, opened (2026-10-19 audit): a session and a circuit opened on the SAMPLE NeuroNet, screenshotted, with the
// viewer's text structure (what's shown, at what size and colour) saved for the before/after mock-ups.
//     node tools/audit/training_shots.mjs <port> <out dir>
import fs from "fs";
import path from "path";
const [, , port = "9241", OUT] = process.argv;
fs.mkdirSync(OUT, {recursive: true});
const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const ws = new WebSocket(list.find((p) => p.type === "page").webSocketDebuggerUrl);
let n = 0; const wait = {};
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (wait[m.id]) { wait[m.id](m); delete wait[m.id]; } };
const call = (method, params = {}) => new Promise((r) => { const id = ++n; wait[id] = r; ws.send(JSON.stringify({id, method, params})); });
await new Promise((r) => { ws.onopen = r; });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const js = async (expr) => { const r = await call("Runtime.evaluate", {expression: expr, awaitPromise: true, returnByValue: true}); return r.result && r.result.result ? r.result.result.value : undefined; };
const sample = await js(`SS.Store.call("kc_get_data", []).then((d) => (d.contacts || []).some((c) => c.name === "Nana June"))`);
if (!sample) { console.error("training_shots: refusing -- not the sample NeuroNet"); process.exit(1); }
await call("Emulation.setDeviceMetricsOverride", {width: 1400, height: 880, deviceScaleFactor: 1, mobile: false});
const click = (text) => js(`(() => { const e = [...document.querySelectorAll("body *")].filter((x) => x.offsetParent && x.textContent.trim().startsWith(${JSON.stringify(text)})).pop();
  if (!e) return false; (e.closest("button,a,li,[role=button]") || e).click(); return true; })()`);
const STRUCT = `(() => { const out = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let t; (t = w.nextNode());) { const s = t.nodeValue.trim(); const e = t.parentElement; if (!s || !e) continue; const r = e.getBoundingClientRect();
    if (r.left < 880 || r.width === 0 || r.top > 880) continue; const c = getComputedStyle(e);
    out.push({text: s.slice(0, 80), size: parseFloat(c.fontSize), weight: c.fontWeight, color: c.color, x: Math.round(r.left), y: Math.round(r.top)}); } return out; })()`;
const data = {};
for (const [name, view, item] of [["session", "training:sessions", "Full body A"], ["circuit", "training:circuits", "Ten-minute finisher"], ["exercise", "training:library", "Goblet Squat"]]) {
  await js(`SS.openSection(${JSON.stringify(view)}); 1`); await sleep(1400);
  for (let i = 0; i < 10 && !(await click(item)); i++) await sleep(300);
  await sleep(1500);
  const m = await call("Page.captureScreenshot", {format: "png"});
  fs.writeFileSync(path.join(OUT, `training-${name}.png`), Buffer.from(m.result.data, "base64"));
  data[name] = await js(STRUCT);
  // the whole viewer, scrolled: its full height
  data[name + "Height"] = await js(`(() => { const v = [...document.querySelectorAll("*")].filter((e) => e.getBoundingClientRect().left > 880 && e.scrollHeight > e.clientHeight + 40 && getComputedStyle(e).overflowY !== "visible")[0]; return v ? v.scrollHeight : 0; })()`);
  console.log("shot", name, (data[name] || []).length, "texts");
}
fs.writeFileSync(path.join(OUT, "training.json"), JSON.stringify(data, null, 1));
ws.close();
