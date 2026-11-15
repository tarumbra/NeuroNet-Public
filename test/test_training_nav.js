/* ==========================================================================
   Training's pill tabs are gone, and nothing went with them
   ==========================================================================
   Cam: "Type tags in Training are no longer needs for me have sub sections
   provided for each Circuit, Sessions, Guides etc. See the image. It is
   the pill tags i want removed."

   Training arrived carrying a whole navigation system of its own inside
   this one: six sections, sixteen tabs drawn as a chip row across the top
   of the page, and its own show/hide switches. The row read "Sessions ·
   Circuits · Exercises · Guides · Document library" while NeuroNet's
   subsection menu said the same words a few inches to its right.

   THE DANGER IN DELETING IT, which is what this file is really for.
   Sixteen tabs, and the subsection menu only listed ten. Seven
   destinations were reachable ONLY by clicking a pill:

       Questionnaires, Equipment, Document library, Lesson plans,
       Groups, Appearance, Backup

   Delete the row on its own and all seven become unreachable -- Backup
   included, which is where Cam's training data gets written out. Nothing
   would look broken. The pages would still exist, still route, still
   work; there would simply be no way left to ask for one.

   So the rule this file holds is not "the pills are gone". It is EVERY
   DESTINATION STILL HAS A WAY IN, checked by reading Training's own tab
   list and NeuroNet's own subsection list and comparing them -- not a
   copy of either written out here, which would keep passing while the
   real lists drifted apart.

   The second rule is about the migration. Training's switches are gone,
   so what Cam had hidden there is copied across once. That copy may only
   decide the seven NEW entries. The two lists disagreed about the other
   ten: Training's defaults hid its "plan" group, so Calendar and
   Programs were missing from its pills while sitting in Cam's subsection
   menu the whole time. A wholesale copy takes Training's side of that
   argument and removes two entries he uses -- which is exactly what the
   first version of this change did, and the menu came back with eleven
   rows instead of thirteen. A migration decides what a new setting starts
   as; it does not overrule one the person already had.
   ========================================================================== */
"use strict";
const fs = require("fs");
const path = require("path");

const APP = process.argv[2] || path.join(__dirname, "..");
const UI = path.join(APP, "ui");
const read = (f) => fs.readFileSync(path.join(UI, f), "utf8");

let pass = 0, fail = 0;
const out = [];
const ok = (name, cond, detail) => {
  if (cond) { pass++; out.push("  ok    " + name); }
  else { fail++; out.push("  FAIL  " + name + (detail ? "\n          " + detail : "")); }
};

const shellSrc = read("app.js");
const trainSrc = read("training/app.js");

/* ---- the two real lists, read from the two real files ---------------- */

/** Training's own destinations: every tab of every one of its sections. */
function trainingTabs() {
  const i = trainSrc.indexOf("const SECTIONS = [");
  const j = trainSrc.indexOf("const sectionOf");
  if (i < 0 || j < 0) return null;
  return [...trainSrc.slice(i, j).matchAll(/\{ id: "(\w+)", label: "([^"]+)" \}/g)]
    .map((m) => ({id: m[1], label: m[2]}));
}

/** NeuroNet's Training subsections. */
function shellChildren() {
  const i = shellSrc.indexOf('{key: "training", name: "Training", children: [');
  if (i < 0) return null;
  const j = shellSrc.indexOf("]}", i);
  return [...shellSrc.slice(i, j).matchAll(/\{key: "training:(\w+)", name: "([^"]+)"\}/g)]
    .map((m) => ({id: m[1], name: m[2]}));
}

const tabs = trainingTabs();
const kids = shellChildren();

ok("Training's own tab list can still be read", tabs && tabs.length > 0);
ok("NeuroNet's Training subsections can still be read", kids && kids.length > 0);

if (tabs && kids) {
  const kidIds = new Set(kids.map((k) => k.id));
  /* THE RULE. Not "there are seventeen of them" -- that would need
     changing every time a view is added, and would pass while a view was
     renamed out of reach. Every destination Training has, the menu has. */
  const stranded = tabs.filter((t) => !kidIds.has(t.id));
  ok("every Training destination has a way in from the menu",
    stranded.length === 0,
    "no subsection reaches: " + stranded.map((t) => `${t.label} (${t.id})`).join(", "));

  /* The seven that used to be pill-only, named here because each one is
     a page Cam can otherwise no longer ask for. Backup first: it is the
     one whose loss costs data rather than convenience. */
  for (const id of ["backup", "settings", "documents", "questionnaires",
                    "equipment", "lessonPlans", "groups"]) {
    ok(`  ${id} is reachable`, kidIds.has(id));
  }

  ok("every menu entry goes somewhere Training can render",
    kids.every((k) => k.id === "lens" || tabs.some((t) => t.id === k.id)),
    kids.filter((k) => k.id !== "lens" && !tabs.some((t) => t.id === k.id))
      .map((k) => k.name).join(", "));

  /* Collapsed, the icon IS the entry, so a missing one is a blank row. */
  const sprite = read("index.html");
  const icons = shellSrc.slice(shellSrc.indexOf("const CHILD_ICONS"),
                               shellSrc.indexOf("const PHOTO_VIEWS"));
  const noIcon = kids.filter((k) => !icons.includes(`"training:${k.id}"`));
  ok("every Training subsection has an icon", noIcon.length === 0,
    noIcon.map((k) => k.name).join(", "));
  const iconNames = [...icons.matchAll(/"training:\w+": "(i-[a-z-]+)"/g)].map((m) => m[1]);
  const missing = iconNames.filter((n) => !sprite.includes(`id="${n}"`));
  ok("  and every one of those icons is really drawn", missing.length === 0,
    "named but not in the sprite, so the row would be blank: " + missing.join(", "));
}

/* ---- the pills themselves -------------------------------------------- */

ok("the pill row is not built any more",
  !/chips is-tabs/.test(trainSrc) && !/id="sectionTabs"/.test(trainSrc),
  "training/app.js still renders the chip tab row");
ok("nothing still tries to wire it up",
  !trainSrc.includes("#sectionTabs [data-tab]"));
ok("the heading names the page you are on, not the group it belongs to",
  trainSrc.includes("el.pageTitle.textContent = tab.label;"),
  "with the pills gone, a heading of \"Database\" is the only thing on "
  + "screen naming a page that is actually Exercises");

/* Training must not second-guess the menu. If isHidden() still answered
   from the old pref, boot() would bounce off a view it thought hidden --
   Cam clicks Equipment in the menu NeuroNet is showing him and lands
   somewhere else -- and the + button would stop offering the type. */
ok("Training no longer hides anything itself",
  /const isHidden = \(\) => false;/.test(trainSrc));
ok("its own section switches are gone, so there is one place to hide things",
  !trainSrc.includes('page.querySelector("#sectionToggles")'));

/* ---- the migration ---------------------------------------------------- */

const mig = shellSrc.slice(shellSrc.indexOf("async function migrateTrainingNav"),
                           shellSrc.indexOf("function sectionOn"));
ok("what Cam hid in Training is carried across", mig.length > 0);
ok("  it runs once and records that it has",
  mig.includes("prefs.trainingNavMigrated") && mig.includes("trainingNavMigrated: true"),
  "a migration that runs every launch would fight anyone who changes "
  + "the setting it once set");
ok("  a failed pref read never stops the app booting",
  /catch \(e\)/.test(mig));

const migratable = shellSrc.slice(shellSrc.indexOf("const TRAINING_MIGRATABLE"),
                                  shellSrc.indexOf("const TRAINING_MIGRATABLE") + 400);
ok("  it only decides the entries that had no setting before",
  mig.includes("TRAINING_MIGRATABLE.has(tab)"));
/* Read from the real list rather than restating it: these ten were in
   the menu before this change and must be untouchable by the copy. */
for (const id of ["sessions", "circuits", "library", "guides", "calendar",
                  "programs", "books", "athletes", "calculators"]) {
  ok(`  it cannot hide ${id}, which was already in the menu`,
    !new RegExp(`"${id}"`).test(migratable));
}

/* ---- and the same thing again, as behaviour ---------------------------

   Everything above reads source. That catches the SHAPE of the bug but
   not its outcome, and the outcome is the thing that went wrong: the
   menu came back with two fewer rows. So the app is booted with exactly
   the pref that caused it -- Training's "plan" group hidden, which is
   its default -- and the rendered menu is read off the page. */
async function booted(neurotrain) {
  let JSDOM;
  try { ({JSDOM} = require("jsdom")); }
  catch (e) {
    out.push("  --    (jsdom not installed; the source checks above still ran)");
    return;
  }
  const prefs = {};
  const trainingPrefs = {hiddenSections: ["plan", "programs", "lessonPlans",
                                          "questionnaires", "groups", "equipment"]};
  const known = {
    library_info: async () => ({root: "/d", found: true, photoFiles: 0}),
    photo_get_data: async () => ({photos: [], albums: [], folders: [], photoTagList: []}),
    photo_save_data: async () => ({ok: true}),
    get_prefs: async () => JSON.parse(JSON.stringify(prefs)),
    set_prefs: async (p) => { Object.assign(prefs, p || {}); return {ok: true}; },
    read_taken_dates: async () => ({dates: {}}),
    music_read_json: async () => ({tracks: {}, playlists: [], albums: []}),
    music_write_json: async () => ({ok: true}),
    chords_list: async () => [],
    cards_read_json: async () => ({tarotDecks: [], oracleDecks: [], lenormandDecks: [],
      tarotReadings: [], oracleReadings: [], lenormandReadings: [],
      meditation: [], journal: [], gratitude: []}),
    cranium_get_data: async () => ({stats: {}, saved: {}, wordLists: [],
      wordGuessList: [], slideImages: [], books: []}),
    cranium_get_prefs: async () => ({}),
    kc_available: async () => true,
    kc_get_data: async () => ({photos: [], albums: [], photoTagList: [], folders: [],
      events: [], contacts: [], recipes: [], menus: [], shoppingLists: [],
      books: [], tagList: []}),
    kc_save_data: async () => ({ok: true}),
    kc_get_money: async () => ({templates: [], oneoffs: [], payments: {}, goals: [],
      spendingLog: {periodStart: "", entries: []}, calc: {bills: [], income: []}}),
    kc_save_money: async () => ({ok: true}),
    kc_money_stamp: async () => 0,
    training_load: async () => ({exercises: {}, circuits: [], sessions: [], guides: [],
      questionnaires: [], calendars: [], athletes: [], equipment: [],
      circuitTypes: [], lessonPlans: []}),
    training_save: async () => ({ok: true}),
    training_stamp: async () => 0,
    training_get_prefs: async () => JSON.parse(JSON.stringify(trainingPrefs)),
    training_set_prefs: async () => ({ok: true}),
    training_formats: async () => ({docx: false, xlsx: false, pdf: false}),
    training_neurotrain: async () => ({installed: !!neurotrain}),
    notes_list_tree: async () => [],
    notes_read_all_notes: async () => ({notes: [], truncated: false}),
    notes_get_prefs: async () => ({}),
    boards_list: async () => [], cells_list: async () => [],
    notebooks_list: async () => [],
  };
  const api = new Proxy({}, {get: (t, n) => (typeof n === "string"
    ? async (...a) => (known[n] ? known[n](...a) : {}) : undefined)});
  const html = fs.readFileSync(path.join(UI, "index.html"), "utf8");
  const dom = new JSDOM(html, {runScripts: "outside-only",
                               url: "file://" + UI + "/index.html"});
  const w = dom.window;
  w.pywebview = {api};
  w.matchMedia = w.matchMedia
    || (() => ({matches: false, addListener() {}, removeListener() {}}));
  w.scrollTo = () => {};
  w.requestAnimationFrame = w.requestAnimationFrame || ((fn) => setTimeout(fn, 0));
  w.cancelAnimationFrame = w.cancelAnimationFrame || ((id) => clearTimeout(id));
  w.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  w.HTMLCanvasElement.prototype.getContext = () => ({
    clearRect() {}, fillRect() {}, beginPath() {}, arc() {}, moveTo() {},
    lineTo() {}, stroke() {}, fill() {}, save() {}, restore() {},
    translate() {}, scale() {}, createLinearGradient: () => ({addColorStop() {}}),
    setTransform() {}, closePath() {},
  });
  for (const src of [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1])) {
    try { w.eval(fs.readFileSync(path.join(UI, src), "utf8")); } catch (e) { /* ignore */ }
  }
  await new Promise((r) => setTimeout(r, 900));
  try { w.SS.go("training:sessions"); } catch (e) { /* ignore */ }
  await new Promise((r) => setTimeout(r, 500));

  const menu = [...w.document.querySelectorAll("#ss-subnav-body [data-view]")]
    .map((e) => e.dataset.view);
  ok("the menu renders Training's subsections" + (neurotrain ? " (NeuroTrain installed)" : ""), menu.length > 0,
    "found none; the checks below would pass vacuously");
  if (neurotrain) {
    /* Q19 q1 (10 Nov 2026): where NeuroTrain is installed, Sessions and
       Programs give way to one entry that opens it, and the rest stays. */
    ok("NeuroTrain installed: one NeuroTrain entry where Programs was, no Sessions or Programs",
      menu.includes("training:neurotrain") && !menu.includes("training:sessions") && !menu.includes("training:programs")
      && menu.indexOf("training:neurotrain") === menu.indexOf("training:calendar") + 1, menu.join(", "));
    ok("  guides, the calendar and Backup stay",
      ["training:guides", "training:calendar", "training:backup"].every((k) => menu.includes(k)), menu.join(", "));
    /* Q20 q1 (13 Nov 2026): the Calculators gave way too; NeuroTrain's page
       has a button straight to NeuroTrain's own. */
    ok("  no Calculators entry (NeuroTrain has them)", !menu.includes("training:calculators"), menu.join(", "));
    try { w.SS.go("training:neurotrain"); } catch (e) { /* ignore */ }
    await new Promise((r) => setTimeout(r, 400));
    ok("  its page opens NeuroTrain, and its Calculators", !!w.document.querySelector("#ntOpen") && !!w.document.querySelector("#ntCalc"), (w.document.querySelector("#cf-shell") || w.document.body).textContent.replace(/\s+/g, " ").slice(0, 300));
    return;
  }
  if (menu.length) {
    /* The exact regression: these two were in the menu before the change
       and Training's own defaults called them hidden. */
    ok("Calendar survives a Training pref that hid its group",
      menu.includes("training:calendar"), menu.join(", "));
    ok("Programs survives it too", menu.includes("training:programs"), menu.join(", "));
    ok("Backup is in the menu Cam can actually click",
      menu.includes("training:backup"), menu.join(", "));
    ok("what he really had hidden stays hidden",
      !menu.includes("training:questionnaires") && !menu.includes("training:groups"),
      menu.join(", "));
    ok("no pill row is on the page",
      !w.document.querySelector("#sectionTabs"));
  }
}

booted(false).then(() => booted(true)).catch((e) => { fail++; out.push("  FAIL  booting threw: " + e.message); })
  .then(() => {
console.log("\ntest_training_nav.js");
console.log(out.join("\n"));
if (tabs && kids) {
  console.log("\n  Training destinations: " + tabs.length
    + "   menu entries: " + kids.length);
}
console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
});
