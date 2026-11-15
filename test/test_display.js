/* ==========================================================================
   This computer's display: layout and brightness (2026-10-06).
   ==========================================================================
   Cam: "a setting for my laptop where i can change the UI ... it gets quite
   cluttered ... Also the laptop setting will need to do something about the
   brightness as it is very dark on my laptop". Kept on this computer only.
   ========================================================================== */
"use strict";
const fs = require("fs");
const path = require("path");
const {JSDOM} = require("jsdom");

const APP = process.argv[2] || path.join(__dirname, "..");
const UI = path.join(APP, "ui");
let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log("  ok    " + name); }
  else { fail++; console.log("  FAIL  " + name + (detail ? "\n          " + detail : "")); }
};

function page(width, stored) {
  const dom = new JSDOM(`<!doctype html><html><head><style>:root{--bg:#1b1b1b;--panel:#222;--elevated:#2a2a2a;--hover:#333;--active:#3a3a3a;--line:#333;--line-strong:#444;--ink:#e6e6e6;--text:#cccccc;--muted:#888888;--faint:#666666}</style></head><body></body></html>`,
    {runScripts: "outside-only", pretendToBeVisual: true, url: "http://localhost/"});
  const w = dom.window;
  Object.defineProperty(w, "innerWidth", {value: width, configurable: true});
  if (stored) w.localStorage.setItem("nn:display", JSON.stringify(stored));
  w.eval(fs.readFileSync(path.join(UI, "display.js"), "utf8"));
  return w;
}

console.log("\nThis computer's display\n");
let w = page(1366);
ok("a laptop-sized window is compact by itself (Auto)", w.document.documentElement.getAttribute("data-density") === "compact" && w.NNDisplay.compact());
w = page(3440);
ok("the ultrawide stays roomy", !w.document.documentElement.hasAttribute("data-density"));
w = page(3440, {layout: "compact"});
ok("Compact can be chosen anywhere", w.NNDisplay.compact());
w = page(1366, {layout: "roomy"});
ok("  and Roomy keeps a small window roomy", !w.NNDisplay.compact());
let changed = 0;
w.NNDisplay.onChange(() => changed++);
w.NNDisplay.set({layout: "compact"});
ok("a change is kept on this computer (the page's own storage), and said",
  JSON.parse(w.localStorage.getItem("nn:display")).layout === "compact" && changed === 1 && w.NNDisplay.compact());

w = page(3440, {brightness: 0});
const css = () => (w.document.getElementById("nn-brightness") || {}).textContent || "";
ok("Normal brightness changes nothing", css() === "");
w.NNDisplay.set({brightness: 1});
const one = css();
ok("Brighter lifts a dark theme's backgrounds and makes its text lighter",
  /--bg: rgb\(\d+/.test(one) && /--text: rgb\(/.test(one) && /!important/.test(one), one.slice(0, 160));
const bgOf = (s) => Number((s.match(/--bg: rgb\((\d+)/) || [])[1]);
w.NNDisplay.set({brightness: 2});
ok("  Brightest more so", bgOf(css()) > bgOf(one) && bgOf(one) > 0x1b, [bgOf(one), bgOf(css())]);
w.NNDisplay.set({brightness: 0});
ok("  and back to Normal takes it all off", css() === "");

const P = w.NNDisplay._test.parse;
ok("colours are read as the themes write them", P("#1b1b1b").join() === "27,27,27,1" && P("#abc").join() === "170,187,204,1"
  && P("rgba(180, 97, 61, 0.14)").join() === "180,97,61,0.14");

const app = fs.readFileSync(path.join(UI, "app.js"), "utf8");
const html = fs.readFileSync(path.join(UI, "index.html"), "utf8");
ok("it loads before app.js, so the page never draws first and changes after",
  html.indexOf('src="display.js"') > 0 && html.indexOf('src="display.js"') < html.indexOf('src="app.js"'));
ok("compact shows the menu as icons; its button opens it for now without changing the saved choice",
  app.includes("function navShownCollapsed() { return isCompact() ? !navOpenInCompact : navCollapsed; }")
  && app.includes("if (isCompact()) { navOpenInCompact = !navOpenInCompact; paintNavCollapsed(); return; }"));
ok("UI scale is this computer's own once set here", app.includes('localStorage.getItem("ss:uiScale")'));
ok("Settings -> Text & scale has This computer: Layout and Brightness",
  app.includes('data-disp="${name}"') && /seg\("brightness", 2, "Brightest"/.test(app));
const shared = fs.readFileSync(path.join(UI, "shared.css"), "utf8");
ok("compact styles: less padding, Training's tags on one row",
  shared.includes('html[data-density="compact"] #ss-main') && shared.includes('.chips.is-filter { max-height: 34px; }'));

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
