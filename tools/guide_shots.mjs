// The Neuro Guide's screenshots, taken from a running SAMPLE NeuroNet.
//
// Cam: the manual's pictures come "from sample data" -- never hers. So this
// drives a throwaway NeuroNet filled by tools/make_sample_data.py, started
// with QTWEBENGINE_REMOTE_DEBUGGING=127.0.0.1:<port>, and writes one JPEG per
// Guide page into ui/guide/shots/ (the names guide.js's SHOTS table uses).
//
//     node tools/guide_shots.mjs [port=9239] [out=ui/guide/shots]
//
// It refuses unless the app it's talking to has the sample household in it
// (the "Nana June" contact), so it can't photograph a real NeuroNet.
// system/guide-shots.sh does the whole thing: sandbox, sample data, launch.
import fs from "fs";
import path from "path";

const [, here, port = "9239", outArg] = process.argv;
const OUT = outArg || path.join(path.dirname(here), "..", "ui", "guide", "shots");
const W = 1400, H = 880;

const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const ws = new WebSocket(list.find((p) => p.type === "page").webSocketDebuggerUrl);
let n = 0; const wait = {};
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (wait[m.id]) { wait[m.id](m); delete wait[m.id]; } };
const call = (method, params = {}) => new Promise((r) => { const id = ++n; wait[id] = r; ws.send(JSON.stringify({id, method, params})); });
await new Promise((r) => { ws.onopen = r; });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const js = async (expr) => (await call("Runtime.evaluate", {expression: expr, awaitPromise: true, returnByValue: true})).result.result.value;

// the deepest element whose text starts with `text`, clicked where a click
// lands -- tried for a few seconds, since some pages fill in after opening
const click = async (text) => {
  for (let i = 0; i < 20; i++) { if (await clickOnce(text)) return true; await sleep(300); }
  console.error("guide_shots: nothing to click called " + text);
  return false;
};
const clickOnce = (text) => js(`(() => { const e = [...document.querySelectorAll("body *")]
  .filter((x) => x.textContent.trim().startsWith(${JSON.stringify(text)})).pop();
  if (!e) return false; (e.closest("button,a,li,[role=button]") || e).click(); return true; })()`);

const sample = await js(`SS.Store.call("kc_get_data", []).then((d) => (d.contacts || []).some((c) => c.name === "Nana June"))`);
if (!sample) { console.error("guide_shots: refusing -- that NeuroNet doesn't hold the sample data"); process.exit(1); }

await call("Emulation.setDeviceMetricsOverride", {width: W, height: H, deviceScaleFactor: 1, mobile: false});
fs.mkdirSync(OUT, {recursive: true});

// name -> [view to open, what to do there first]
const SHOTS = {
  home: ["home"],
  photos: ["photos"],
  music: ["music"],
  training: ["training:sessions", () => click("Full body A")],
  notes: ["notes:vault", () => click("Seedlings")],
  creative: ["paper:make"],
  kitchen: ["cookery"],
  money: ["money"],
  puzzles: ["games:sudoku", () => click("Medium")],
  divination: ["div:runes"],
  mind: ["mind:journal"],
  stuff: ["stuff:shelf"],
  // the project open, its guide beside it, and a run in the terminal --
  // all inside the IDE's shadow root, where click() can't see
  code: ["code:ide", () => js(`(async () => { const R = SS.Code.root, w = (ms) => new Promise((r) => setTimeout(r, ms));
    const hit = (t) => { const e = [...R.querySelectorAll("#railBody *")].reverse().find((x) => x.textContent.trim() === t); if (e) e.click(); return !!e; };
    for (let i = 0; i < 20 && !hit("Garden Planner"); i++) await w(300);
    await w(800); hit("planner.py"); await w(800);
    R.getElementById("toggleSplit").click(); await w(500); hit("Python loops.md"); await w(800);
    R.getElementById("termRun").click(); await w(800);
    const box = R.getElementById("runCmd");
    if (box) { box.value = "python3 planner.py"; R.getElementById("runGo").click(); }
    await w(2500);
    R.getElementById("railFoot").textContent = "~/NeuroNet/neuronet_data/code/projects";   // not this sandbox's folder
    return true; })()`)],
  settings: ["settings:appearance"],
  // the data folder shown as the installer's default, not this sandbox's
  transfer: ["settings:transfer", () => js(`(() => { const w = document.createTreeWalker(document.querySelector("main"), NodeFilter.SHOW_TEXT);
    const dir = ${JSON.stringify(process.env.NEURONET_SAMPLE_DATA || "")};
    for (let t; (t = w.nextNode());) if (dir && t.nodeValue.includes(dir)) t.nodeValue = t.nodeValue.split(dir).join("~/NeuroNet/neuronet_data");
    return true; })()`)],
};

// SHOTS_ONLY=code,stuff retakes just those (the welcome too only if named)
const ONLY = (process.env.SHOTS_ONLY || "").split(",").filter(Boolean);
for (const [name, [view, prep]] of Object.entries(SHOTS)) {
  if (ONLY.length && !ONLY.includes(name)) continue;
  await js(`SS.openSection(${JSON.stringify(view)}); 1`);
  await sleep(1500);
  if (prep) { await prep(); await sleep(1500); }
  const m = await call("Page.captureScreenshot", {format: "jpeg", quality: 82});
  fs.writeFileSync(path.join(OUT, name + ".jpg"), Buffer.from(m.result.data, "base64"));
  console.log("shot", name);
}

// the first-boot welcome, over the dashboard as a new computer shows it
if (ONLY.length && !ONLY.includes("welcome")) { ws.close(); process.exit(0); }
await js(`SS.openSection("home"); 1`);
await sleep(1500);
await js(`SS.Welcome.show(); 1`);
await sleep(1000);
const m = await call("Page.captureScreenshot", {format: "jpeg", quality: 82});
fs.writeFileSync(path.join(OUT, "welcome.jpg"), Buffer.from(m.result.data, "base64"));
await js(`SS.Welcome.close(); 1`);
console.log("shot welcome");
ws.close();
