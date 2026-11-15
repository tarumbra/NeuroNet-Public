/* Print an audit report's HTML to PDF with page numbers (2026-10-18). Starts its own headless Chromium on a private
   profile, prints over the DevTools protocol (Node's built-in WebSocket), and closes only that Chromium.
   node tools/audit/pdf.js in.html out.pdf "Footer title" */
const {spawn} = require("child_process"), fs = require("fs"), os = require("os"), path = require("path");
const [, , inp, out, title = ""] = process.argv;
const prof = fs.mkdtempSync(path.join(process.env.AUDIT_TMP || os.tmpdir(), "audit-chrome-"));
const chrome = spawn("chromium", ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", `--user-data-dir=${prof}`,
  "--remote-debugging-port=0", "--allow-file-access-from-files", "about:blank"], {stdio: "ignore"});
const done = (code) => { try { chrome.kill("SIGTERM"); } catch (e) {} setTimeout(() => { fs.rmSync(prof, {recursive: true, force: true}); process.exit(code); }, 400); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  let port = 0;
  for (let i = 0; i < 100 && !port; i++) { await wait(100); try { port = +fs.readFileSync(path.join(prof, "DevToolsActivePort"), "utf8").split("\n")[0]; } catch (e) {} }
  if (!port) { console.error("Chromium didn't start"); return done(1); }
  const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const ws = new WebSocket(tabs.find((t) => t.type === "page").webSocketDebuggerUrl);
  let id = 0; const pend = new Map(), events = [];
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } else events.push(d); };
  await new Promise((r) => { ws.onopen = r; });
  const call = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({id: i, method, params})); });
  await call("Page.enable");
  await call("Page.navigate", {url: "file://" + path.resolve(inp)});
  for (let i = 0; i < 200 && !events.some((e) => e.method === "Page.loadEventFired"); i++) await wait(50);
  await wait(600);                                                          // (fonts and images settle)
  const foot = `<div style="width:100%;font:9px 'Noto Sans',sans-serif;color:#7a5a3a;padding:0 14mm;display:flex;justify-content:space-between">
    <span>${title.replace(/</g, "&lt;")}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`;
  const r = await call("Page.printToPDF", {printBackground: true, preferCSSPageSize: true, displayHeaderFooter: true,
    headerTemplate: "<span></span>", footerTemplate: foot, marginTop: 0.55, marginBottom: 0.6, marginLeft: 0.55, marginRight: 0.55});
  if (!r.result) { console.error(JSON.stringify(r.error)); return done(1); }
  fs.writeFileSync(out, Buffer.from(r.result.data, "base64"));
  console.log("wrote", out, Math.round(fs.statSync(out).size / 1024) + " KB");
  ws.close(); done(0);
})().catch((e) => { console.error(e); done(1); });
