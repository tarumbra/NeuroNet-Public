#!/usr/bin/env node
/* The How to Play book's photos and its PDF (2026-10-20, Cam: "a detailed stylized guide of the game and all the features
   including photos (also store as a pdf within the ebook section of scribe").

     node tools/make_guide.js            photos (ui/pet/art/guide/<shot>.webp + manifest.js) and the PDF
     node tools/make_guide.js --pdf      just the PDF, from the photos already there

   The words are HOW_TO_PLAY in ui/pet/content/40-zzz-zk-the-how-to-play-book.json -- the game's book reads the same chapters.
   The photos are the real game in headless Chromium, with the browser tests' stand-in bridge (test/browser/stub.js) and saves
   made here with the real rules: nothing reads or writes neuronet_data. The PDF lands in ui/pet/guide/; NeuroPets puts it on
   Scribe's Ebooks shelf (neuropets.py guide_to_scribe). Run it before a release when the guide or the game's look has changed. */
const fs = require("fs"), os = require("os"), path = require("path"), vm = require("vm"), cp = require("child_process");
const APP = path.join(__dirname, ".."), PET = path.join(APP, "ui", "pet"), BROWSER = path.join(APP, "test", "browser");
const SHOTS = path.join(PET, "art", "guide"), OUT = path.join(PET, "guide", "NeuroPets - How to Play.pdf");
const chrome = ["chromium", "chromium-browser", "google-chrome-stable", "google-chrome"].map((c) => { try { return cp.execFileSync("which", [c], {encoding: "utf8", stdio: ["ignore", "pipe", "ignore"]}).trim(); } catch (e) { return ""; } }).find(Boolean);
if (!chrome) { console.error("make_guide: needs Chromium"); process.exit(1); }
const ctx = {window: {}, console};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(PET, "petcore.js"), "utf8"), ctx);
const C = ctx.window.PetCore || ctx.PetCore;
const G = C.HOW_TO_PLAY, N = Date.now(), H = 3600e3, T = N - 2 * H;   // (a short while ago: a happy, fed pet in the photos)

/** A player some way in: a class, a hatched pet, a full-ish bag, the tutorial and its lesson behind them. */
function save(cls) {
  let s = C.act(C.advance(C.empty(), T), "player", {name: "Ash"}, T).state; s.story = {on: false};
  s = C.act(s, "hatch", {egg: "starter", roll: 0.3}, T).state;
  s = C.act(s, "class", {cls}, T).state;
  s.tutorial = {done: true, step: 0}; s.classTut = {on: null, done: {[cls]: T}, gifted: {}};
  ["attack", "ranged", "magic", "defence", "hitpoints"].forEach((k) => { s.player.skills[k] = C.XP[26]; });
  Object.assign(s.player.skills, {foraging: C.XP[18], fishing: C.XP[14], mining: C.XP[16], lumbering: C.XP[15], cooking: C.XP[20], crafting: C.XP[17], smithing: C.XP[12], fletching: C.XP[13], farming: C.XP[9]});
  s.coins = 4200; s.player.skills.construction = C.XP[30];
  Object.assign(s.bag, {cookedsalmon: 12, shrimps: 20, bronzeknife: 1, chisel: 1, flint: 14, arrowshaft: 30, feather: 40, oak: 25, copper: 18, tin: 16,
    ropesnare: 6, twinenet: 3, howtoplay: 1, cloth: 4, herb: 9, bronzehelm: 1, leatherquiver: 1, bronzearrow: 120, shortbow: 1, steelsword: 1});
  if (cls === "hunter") { s.player.gear.weapon = "shortbow"; s.player.gear.quiver = "leatherquiver"; s.player.gear.ammo = "bronzearrow"; s.player.gear.helmet = "bronzehelm"; }
  if (cls === "arcane") { Object.assign(s.bag, {oakwand: 1, airrune: 300, mindrune: 300, waterrune: 300, earthrune: 200}); s.player.gear.weapon = "oakwand"; s.player.loadout = ["windstrike", "waterstrike"]; }
  s.player.quick = ["cookedsalmon", "ropesnare"];
  if (cls === "hunter") { s.player.combat.special = "aimed"; s.player.spec = 80; }
  s.player.hp = C.playerView(s, T).maxHp;
  return C.advance(s, N);
}
// each photo: the save, and what to do before it's taken (in the page: t has go/click/sleep, like the browser tests)
const PHOTOS = {
  "map":        {cls: "hunter", run: `async (t) => { SS.Pet.mapHome(); await t.go("pet:world"); await t.click('[data-kittab="bag"]'); }`},
  "region":     {cls: "hunter", run: `async (t) => { SS.Pet.toRegion("farmyard"); await t.go("pet:world"); await t.click('[data-kittab="bag"]'); }`},
  "kit-bag":    {cls: "hunter", run: `async (t) => { await t.go("pet:estate"); await t.click('[data-kittab="bag"]'); }`},
  "bench":      {cls: "hunter", run: `async (t) => { await t.go("shop:crafting"); await t.click('[data-kittab="gear"]'); }`},
  "estate":     {cls: "hunter", run: `async (t) => { await t.go("pet:estate"); await t.click('[data-kittab="gear"]'); }`},
  "pet":        {cls: "hunter", run: `async (t) => { await t.go("pet:home"); await t.click('[data-kittab="bag"]'); }`},
  "fight":      {cls: "hunter", run: `async (t) => { await SS.Pet.act("hunt", {ground: "pasture", roll: 0.5}); await t.go("pet:hunt");
                                  for (let i = 0; i < 20 && !SS.Pet._test.current().s.player.battle; i++) await t.sleep(300); await t.click('[data-kittab="combat"]'); await t.sleep(2600); }`},
  "guild":      {cls: "hunter", run: `async (t) => { await t.go("pet:guild"); await t.click('[data-kittab="combat"]'); }`},
  "village":    {cls: "hunter", run: `async (t) => { await t.go("pet:village"); await t.click('[data-kittab="bag"]'); }`},
  "kit-magic":  {cls: "arcane", run: `async (t) => { await t.go("pet:library"); await t.click('[data-kittab="magic"]'); }`},
  "kit-skills": {cls: "hunter", run: `async (t) => { await t.go("pet:estate"); await t.click('[data-kittab="skills"]'); const b = document.querySelector('[data-kskill="foraging"]'); if (b) b.focus(); }`},
};

function photo(id, p, root) {
  const dir = path.join(root, id), png = path.join(root, id + ".png");
  fs.mkdirSync(dir);
  fs.readdirSync(PET).filter((f) => f !== "index.html").forEach((f) => fs.symlinkSync(path.join(PET, f), path.join(dir, f)));
  ["stub.js", "checks.js"].forEach((f) => fs.copyFileSync(path.join(BROWSER, f), path.join(dir, f)));
  fs.writeFileSync(path.join(dir, "state.json"), JSON.stringify(save(p.cls)));
  fs.writeFileSync(path.join(dir, "scenario.js"), "window.__SCENARIO = " + p.run + ";\n");
  fs.writeFileSync(path.join(dir, "index.html"), fs.readFileSync(path.join(PET, "index.html"), "utf8")
    .replace('<script src="game.js"></script>', '<script src="stub.js"></script><script src="game.js"></script><script src="checks.js"></script><script src="scenario.js"></script>'));
  try { cp.execFileSync(chrome, ["--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars", "--allow-file-access-from-files", "--user-data-dir=" + path.join(dir, "profile"),
    "--window-size=1500,940", "--virtual-time-budget=25000", "--screenshot=" + png, "file://" + path.join(dir, "index.html")], {stdio: "ignore", timeout: 180000}); } catch (e) { /* the picture is what counts */ }
  if (!fs.existsSync(png)) { console.log("  " + id + ": no picture"); return false; }
  cp.execFileSync("magick", [png, "-resize", "1200x", "-quality", "82", path.join(SHOTS, id + ".webp")]);
  console.log("  " + id);
  return true;
}

const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function pdf() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "np-guide-")), file = path.join(tmp, "guide.html");
  const have = (k) => k && fs.existsSync(path.join(SHOTS, k + ".webp"));
  // (JPEG copies for the PDF: Chromium keeps a JPEG as it is, but re-packs a WebP losslessly -- 10 MB instead of ~1.5)
  const jpg = (k) => { const f = path.join(tmp, k + ".jpg"); if (!fs.existsSync(f)) cp.execFileSync("magick", [path.join(SHOTS, k + ".webp"), "-quality", "80", f]); return f; };
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>NeuroPets - ${esc(G.title)}</title><style>
    @page { size: A4; margin: 16mm 16mm 18mm; }
    body { margin: 0; font-family: Georgia, "DejaVu Serif", serif; color: #3b2213; background: #f6e8c8; font-size: 11.5pt; line-height: 1.55; }
    .cover { height: 250mm; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; page-break-after: always;
      border: 6px double #8a5434; border-radius: 10px; background: radial-gradient(circle at 50% 40%, #fbf1d9, #ecd7a8); }
    .cover img { width: 120px; } .cover h1 { font-size: 44pt; margin: 18px 0 4px; color: #5a2e14; letter-spacing: .02em; } .cover p { font-style: italic; font-size: 14pt; margin: 0; color: #6f4a2b; }
    .cover .from { margin-top: 30px; font-size: 11pt; font-style: normal; }
    h2 { font-size: 22pt; color: #5a2e14; border-bottom: 2px solid #c9a25a; padding-bottom: 4px; margin: 0 0 10px; }
    .toc { page-break-after: always; } .toc ol { columns: 2; column-gap: 30px; font-size: 13pt; } .toc li { margin: 4px 0; }
    .ch { page-break-before: always; } .ch:first-of-type { page-break-before: auto; }
    .ch img { width: 100%; border: 3px solid #8a5434; border-radius: 6px; margin: 4px 0 10px; }
    .tips { padding: 8px 14px; border-left: 4px solid #c9a25a; background: rgba(201,162,90,.22); border-radius: 6px; page-break-inside: avoid; }
    .tips ul { margin: 4px 0 0; padding-left: 18px; } .foot { margin-top: 18px; text-align: center; font-style: italic; color: #6f4a2b; }
  </style></head><body>
    <section class="cover"><img src="file://${path.join(PET, "logo-full.png")}" alt=""><h1>${esc(G.title)}</h1><p>${esc(G.subtitle)}</p><p class="from">NeuroPets · part of NeuroNet</p></section>
    <section class="toc"><h2>Contents</h2><ol>${G.chapters.map((c) => `<li>${esc(c.title)}</li>`).join("")}</ol>
      <p class="foot">The same guide is in the game: Amunet's How to Play book, in your bag.</p></section>
    ${G.chapters.map((c) => `<section class="ch"><h2>${esc(c.title)}</h2>${have(c.shot) ? `<img src="file://${jpg(c.shot)}" alt="">` : ""}
      ${c.paras.map((p) => `<p>${esc(p)}</p>`).join("")}
      ${c.tips && c.tips.length ? `<div class="tips"><b>Good to know</b><ul>${c.tips.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div>` : ""}</section>`).join("")}
  </body></html>`;
  fs.writeFileSync(file, html);
  fs.mkdirSync(path.dirname(OUT), {recursive: true});
  cp.execFileSync(chrome, ["--headless=new", "--no-sandbox", "--disable-gpu", "--allow-file-access-from-files", "--user-data-dir=" + path.join(tmp, "profile"),
    "--no-pdf-header-footer", "--print-to-pdf=" + OUT, "file://" + file], {stdio: "ignore", timeout: 120000});
  fs.rmSync(tmp, {recursive: true, force: true});
  console.log("PDF: " + path.relative(APP, OUT) + " (" + Math.round(fs.statSync(OUT).size / 1024) + " KB)");
}

if (!process.argv.includes("--pdf")) {
  fs.mkdirSync(SHOTS, {recursive: true});
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "np-photos-"));
  console.log("Photos:");
  try { Object.keys(PHOTOS).forEach((id) => photo(id, PHOTOS[id], root)); } finally { fs.rmSync(root, {recursive: true, force: true}); }
  const made = fs.readdirSync(SHOTS).filter((f) => f.endsWith(".webp")).map((f) => f.slice(0, -5)).sort();
  fs.writeFileSync(path.join(SHOTS, "manifest.js"), "// made by tools/make_guide.js -- the How to Play book's photos\nwindow.GUIDE_SHOTS = " + JSON.stringify(Object.fromEntries(made.map((k) => [k, 1]))) + ";\n");
}
pdf();
