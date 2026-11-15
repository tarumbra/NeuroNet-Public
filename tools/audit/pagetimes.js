/* NeuroPets in a real headless Chromium on a TEST save (2026-10-18): visits each page and records how long it takes to
   draw, script and layout time, DOM size and the JS heap -- Performance.getMetrics over the DevTools protocol. Nothing
   real is touched: the page gets a stub bridge that serves the given save and drops every write.
   node tools/audit/pagetimes.js <app> <save.json> <out.json> */
const {spawn} = require("child_process"), fs = require("fs"), os = require("os"), path = require("path");
const [, , APP, SAVE, OUT] = process.argv;
const UI = path.join(APP, "ui", "pet");
const tmp = fs.mkdtempSync(path.join(process.env.AUDIT_TMP || os.tmpdir(), "audit-pages-"));
const save = fs.readFileSync(SAVE, "utf8"), SETTINGS = process.env.AUDIT_SETTINGS || "{}";
const stub = `<script>window.__audit = {calls: 0};
window.SS = {Store: {async call(name, a) { window.__audit.calls++;
  if (name === "hello") return {sandbox: !!JSON.parse(${JSON.stringify(SETTINGS)}).sandbox, version: "audit"};
  if (name === "pet_load") return JSON.parse(${JSON.stringify(save)});
  if (name === "pet_sandbox") return {kind: "max"};
  if (name === "pet_settings") return JSON.parse(${JSON.stringify(SETTINGS)});
  return {ok: true}; }}};</script>`;
let html = fs.readFileSync(path.join(UI, "index.html"), "utf8")
  .replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, "")
  .replace(/<head>/, `<head><base href="file://${UI}/">` + stub);
fs.writeFileSync(path.join(tmp, "np.html"), html);
const prof = path.join(tmp, "profile");
const chrome = spawn("chromium", ["--headless=new", "--no-first-run", `--user-data-dir=${prof}`, "--remote-debugging-port=0",
  "--allow-file-access-from-files", "--window-size=1500,1000", "about:blank"], {stdio: "ignore"});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const done = (c) => { try { chrome.kill("SIGTERM"); } catch (e) {} setTimeout(() => { fs.rmSync(tmp, {recursive: true, force: true}); process.exit(c); }, 500); };
(async () => {
  let port = 0;
  for (let i = 0; i < 100 && !port; i++) { await wait(100); try { port = +fs.readFileSync(path.join(prof, "DevToolsActivePort"), "utf8").split("\n")[0]; } catch (e) {} }
  const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const ws = new WebSocket(tabs.find((t) => t.type === "page").webSocketDebuggerUrl);
  let id = 0; const pend = new Map(), logs = [];
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); }
    else if (d.method === "Runtime.exceptionThrown") logs.push(d.params.exceptionDetails.exception ? d.params.exceptionDetails.exception.description : d.params.exceptionDetails.text); };
  await new Promise((r) => { ws.onopen = r; });
  const call = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({id: i, method, params})); });
  const ev = async (expr) => ((await call("Runtime.evaluate", {expression: expr, returnByValue: true, awaitPromise: true})).result || {}).result;
  const metrics = async () => Object.fromEntries(((await call("Performance.getMetrics")).result.metrics || []).map((m) => [m.name, m.value]));
  await call("Runtime.enable"); await call("Performance.enable"); await call("Page.enable");
  const t0 = Date.now();
  await call("Page.navigate", {url: "file://" + path.join(tmp, "np.html")});
  for (let i = 0; i < 100; i++) { await wait(100); const r = await ev("!!document.querySelector('[data-go]')"); if (r && r.value) break; }
  const boot = Date.now() - t0;
  const pages = (await ev("[...new Set([...document.querySelectorAll('[data-go]')].map((b) => b.dataset.go))]")).value || [];
  const out = {bootMs: boot, start: await metrics(), pages: []};
  for (const pg of pages) {
    if (/^proto:/.test(pg)) continue;
    const before = await metrics();
    const r = await ev(`new Promise((res) => { const a = performance.now(); const b = document.querySelector('[data-go="${pg}"]'); if (!b) return res(-1);
      b.click(); requestAnimationFrame(() => requestAnimationFrame(() => res(performance.now() - a))); })`);
    await wait(250);
    const after = await metrics();
    const dom = (await ev("document.getElementsByTagName('*').length")).value;
    const imgs = (await ev("document.images.length")).value;
    if (process.env.AUDIT_SHOTS) { const sh = await call("Page.captureScreenshot", {format: "png"}); fs.writeFileSync(path.join(process.env.AUDIT_SHOTS, pg.replace(/[:]/g, "_") + ".png"), Buffer.from(sh.result.data, "base64")); }
    out.pages.push({page: pg, drawMs: Math.round((r && r.value) * 10) / 10, scriptMs: Math.round((after.ScriptDuration - before.ScriptDuration) * 1e4) / 10,
      layoutMs: Math.round((after.LayoutDuration - before.LayoutDuration) * 1e4) / 10, recalcMs: Math.round((after.RecalcStyleDuration - before.RecalcStyleDuration) * 1e4) / 10,
      layouts: after.LayoutCount - before.LayoutCount, dom, imgs, heapMB: Math.round(after.JSHeapUsedSize / 1048576 * 10) / 10});
  }
  out.imgHomes = (await ev(`(() => { const c = {}; document.querySelectorAll("img").forEach((i) => { let e = i, k = ""; while (e && e !== document.body) { if (e.id) { k = "#" + e.id; break; } e = e.parentElement; } k = k || "(body)"; c[k] = (c[k] || 0) + 1; }); return c; })()`)).value;
  out.domHomes = (await ev(`(() => { const c = {}; [...document.body.children].forEach((e) => { c[(e.id ? "#" + e.id : e.tagName.toLowerCase() + "." + (e.className || "").toString().split(" ")[0])] = e.getElementsByTagName("*").length; }); return c; })()`)).value;
  // idle: 15 seconds of the page's own ticking (on AUDIT_IDLE_PAGE, else the last page)
  if (process.env.AUDIT_IDLE_PAGE) { await ev(`document.querySelector('[data-go="${process.env.AUDIT_IDLE_PAGE}"]').click()`); await wait(800); }
  out.idlePage = process.env.AUDIT_IDLE_PAGE || (out.pages[out.pages.length - 1] || {}).page;
  if (process.env.AUDIT_MUTATIONS) await ev(`(() => { window.__mut = {}; new MutationObserver((ms) => ms.forEach((m) => { let e = m.target.nodeType === 1 ? m.target : m.target.parentElement, k = [];
    for (let i = 0; e && i < 4; i++, e = e.parentElement) k.push(e.tagName.toLowerCase() + (e.id ? "#" + e.id : "") + (e.classList[0] ? "." + e.classList[0] : ""));
    k = m.type + " " + k.join(" < "); window.__mut[k] = (window.__mut[k] || 0) + 1; })).observe(document.body, {subtree: true, childList: true, attributes: true, characterData: true}); return 1; })()`);
  const a = await metrics(); await wait(15000); const b = await metrics();
  out.idle15s = {scriptMs: Math.round((b.ScriptDuration - a.ScriptDuration) * 1e4) / 10, layoutMs: Math.round((b.LayoutDuration - a.LayoutDuration) * 1e4) / 10,
    tasks: b.TaskDuration - a.TaskDuration, heapMB: Math.round(b.JSHeapUsedSize / 1048576 * 10) / 10, heapTotalMB: Math.round(b.JSHeapTotalSize / 1048576 * 10) / 10};
  if (process.env.AUDIT_MUTATIONS) out.mutations = (await ev(`Object.entries(window.__mut).sort((a, b) => b[1] - a[1]).slice(0, 15)`)).value;
  out.end = b; out.errors = logs.slice(0, 20);
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  console.log("pages", out.pages.length, "boot", boot, "errors", logs.length);
  ws.close(); done(0);
})().catch((e) => { console.error(e); done(1); });
