/* ==========================================================================
   Enter answers the box on top (ui/app.js enterAnswersBox)
   ==========================================================================
   Cam (2026-10-02): "When pressing delete on a fleeting note in the vault
   mmain section, i want the ability to be able to press enter and have it
   confirm. At the moment it just actions the enter button press in the
   background part of the app and not the confirmation box, this is the same
   in tools where i add media and other things etc."

   The real Fleeting page is opened, Delete pressed, and Enter sent to the
   button that still has the focus behind the box -- what Cam does. Then the
   other kinds of box: a module's own confirm (Vault), openDlg with fields
   (Add to Media), a field that uses Enter itself, a text area, Training's
   sheet.
   ========================================================================== */
"use strict";
const fs = require("fs");
const path = require("path");
const {JSDOM} = require("jsdom");

const APP = process.argv[2] || path.join(__dirname, "..");
const UI = path.join(APP, "ui");

let pass = 0, fail = 0;
const out = [];
const ok = (name, cond, detail) => {
  if (cond) { pass++; out.push("  ok    " + name); }
  else { fail++; out.push("  FAIL  " + name + (detail ? "\n          " + detail : "")); }
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms || 60));

async function run() {
  let fleeting = [{n: 1, text: "one", written: 1790000000}, {n: 2, text: "two", written: 1790000100}];
  const deleted = [];
  const known = {
    library_info: async () => ({root: "/d", found: true, photoFiles: 0}),
    photo_get_data: async () => ({photos: [], albums: [], folders: [], photoTagList: []}),
    get_prefs: async () => ({}), set_prefs: async () => ({ok: true}),
    fleeting_list: async () => JSON.parse(JSON.stringify(fleeting)),
    fleeting_delete: async (n) => {
      deleted.push(n);
      fleeting = fleeting.filter((x) => x.n !== n).map((x, i) => ({...x, n: i + 1}));
      return {ok: true};
    },
  };
  const api = new Proxy({}, {get: (t, n) => (typeof n === "string"
    ? async (...a) => (known[n] ? known[n](...a) : {}) : undefined)});
  const html = fs.readFileSync(path.join(UI, "index.html"), "utf8");
  const dom = new JSDOM(html, {runScripts: "outside-only", pretendToBeVisual: true,
                               url: "file://" + UI + "/index.html"});
  const w = dom.window;
  w.pywebview = {api};
  w.matchMedia = w.matchMedia || (() => ({matches: false, addListener() {}, removeListener() {}}));
  w.scrollTo = () => {};
  w.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  w.HTMLCanvasElement.prototype.getContext = () => null;
  // the veils' stylesheet: shown only while open (as shared.css does)
  const css = w.document.createElement("style");
  css.textContent = "#confirm-veil,#modal-veil,#cx-confirm-veil{display:none}"
    + "#confirm-veil.open,#modal-veil.open,#cx-confirm-veil.open{display:flex}";
  w.document.head.appendChild(css);
  for (const src of [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1])) {
    try { w.eval(fs.readFileSync(path.join(UI, src), "utf8")); } catch (e) { /* ignore */ }
  }
  await wait(700);
  const doc = w.document;
  const enter = (el, opts) => {
    const e = new w.KeyboardEvent("keydown", Object.assign({key: "Enter", bubbles: true, cancelable: true}, opts));
    (el || doc.body).dispatchEvent(e);
    return e;
  };
  const open = (sel) => !!doc.querySelector(sel);

  /* ---- Cam's case: Vault -> Fleeting -> Delete, then Enter --------------- */
  w.SS.go("fleeting:list");
  await wait(400);
  const del = doc.querySelector('[data-del="1"]');
  ok("the Fleeting page is up, with Delete on each note", !!del);
  if (!del) return;
  let behind = 0;
  doc.addEventListener("keydown", (e) => { if (e.key === "Enter") behind++; });
  del.focus();
  del.click();
  await wait(30);
  ok("Delete asks first", open("#confirm-veil.open .modal"));
  enter(doc.activeElement);            // the focus is still on Delete, behind the box
  await wait(200);
  ok("Enter confirms it: note 1 deleted", deleted.length === 1 && deleted[0] === 1, JSON.stringify(deleted));
  ok("  the box is gone", !open("#confirm-veil.open"));
  ok("  and the page behind never got the Enter (no second Delete box)", behind === 0, "behind=" + behind);

  /* ---- a module's own confirm (Vault's CC.confirm style), focus on its Cancel */
  const veil = doc.createElement("div");
  veil.id = "cx-confirm-veil";
  doc.body.appendChild(veil);
  let answer = null;
  const ask = () => {
    veil.innerHTML = `<div class="modal" role="alertdialog"><h3>Sure?</h3>
      <div class="row"><button class="btn btn-quiet" data-act="no">Cancel</button>
      <button class="btn btn-danger" data-act="yes">Delete</button></div></div>`;
    veil.querySelector("[data-act=no]").onclick = () => { answer = false; veil.classList.remove("open"); };
    veil.querySelector("[data-act=yes]").onclick = () => { answer = true; veil.classList.remove("open"); };
    veil.classList.add("open");
  };
  ask(); enter(doc.body);
  ok("another module's confirm: Enter presses its yes", answer === true);
  ask(); answer = null; veil.querySelector("[data-act=no]").focus(); enter(doc.activeElement);
  ok("  but with Cancel focused, Enter is Cancel", answer === false);
  veil.remove();

  /* ---- openDlg with fields (Add to Media and friends) -------------------- */
  const sh = w.SS.shared;
  let saved = 0, own = 0;
  const d = sh.openDlg("Add to Media", `<input class="input" id="t1"><input class="input" id="t2">
     <textarea id="ta"></textarea>`);
  d.btn("Cancel", "btn-quiet", () => d.close());
  d.btn("Save", "btn-primary", () => { saved++; });
  const t2 = d.body.querySelector("#t2");
  t2.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); own++; } });
  enter(d.body.querySelector("#t1"));
  ok("a field in a box: Enter is Save", saved === 1, "saved=" + saved);
  enter(t2);
  ok("  a field with its own Enter (add a type, a tag) keeps it", own === 1 && saved === 1, `own=${own} saved=${saved}`);
  const e3 = enter(d.body.querySelector("#ta"));
  ok("  a text area keeps Enter for a new line", saved === 1 && !e3.defaultPrevented);
  enter(d.body.querySelector("#t1"), {shiftKey: true});
  ok("  Shift+Enter isn't taken", saved === 1);
  d.close();
  behind = 0;
  enter(doc.body);
  ok("no box up: Enter goes to the page as before", behind === 1);

  /* ---- Training's sheet ------------------------------------------------------ */
  const host = doc.getElementById("sheetHost");
  if (host) {
    let confirmed = 0;
    doc.getElementById("sheetBody").innerHTML = `<div class="sheet-row">
      <button class="secondary-btn">Cancel</button><button class="primary-btn">Delete session</button></div>`;
    doc.querySelector("#sheetBody .primary-btn").onclick = () => { confirmed++; };
    // Training on screen (its shell is hidden while another page is)
    const hid = [];
    for (let el = host.parentElement; el; el = el.parentElement) if (el.hidden) { hid.push(el); el.hidden = false; }
    host.hidden = false;
    enter(doc.body);
    ok("Training's confirm sheet: Enter confirms", confirmed === 1);
    host.hidden = true;
    enter(doc.body);
    ok("  and once it's closed, Enter leaves it alone", confirmed === 1);
    hid.forEach((el) => { el.hidden = true; });
  } else {
    ok("Training's sheet is in the page", false);
  }
}

run().catch((e) => { fail++; out.push("  FAIL  threw: " + (e.stack || e.message)); })
  .then(() => {
    console.log("\ntest_enter_confirms.js");
    console.log(out.join("\n"));
    console.log(`\n  ${pass} passed, ${fail} failed\n`);
    process.exit(fail ? 1 : 0);
  });
