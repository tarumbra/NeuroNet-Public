/* ==========================================================================
   The Kitchen can print and export again
   ==========================================================================
   Cam: "Printing a recipe does not work for some reason would you please
   look into this for me"

   WHAT WAS WRONG, and it is the reason this file leads with the check it
   does. Nothing rendered badly and no printer misbehaved: THE FUNCTION WAS
   NEVER WRITTEN. When KinCrux's Kitchen was merged in, a shim was added to
   carry its calls to this host, and five of those forwards pointed at names
   that did not exist on SS.Store:

       printRecipe  printShoppingList  printBook  exportBook  pdfAvailable

   Pressing Print threw "SS.Store.printRecipe is not a function" inside an
   async click handler with nothing catching it. No toast, no message, a
   button that did nothing -- which is why it reached Cam as "does not work
   for some reason" rather than as an error.

   SO THE FIRST CHECK IS THAT EVERY SHIMMED NAME EXISTS, walked from the
   shim itself rather than from a list written out here. A list would have
   to be remembered; walking CP.Store means the next call added to the shim
   is covered the day it is added, and a sixth dead forward cannot be
   introduced the same silent way.

   AND THEN IT PRESSES THE BUTTONS. "The function exists" is a weaker claim
   than "the button produces a document", and the gap between them is where
   this bug lived -- the shim existed too.
   ========================================================================== */
"use strict";
const path = require("path");

const APP = process.argv[2] || path.join(__dirname, "..");
const UI = path.join(APP, "ui");

let chromium;
try {
  ({chromium} = require("playwright"));
} catch (e) {
  try {
    ({chromium} = require(require("child_process")
      .execSync("npm root -g").toString().trim() + "/playwright"));
  } catch (e2) {
    console.log("test_cookery_print: Playwright isn't installed. "
      + "(npm install -g playwright)");
    process.exit(0);
  }
}

let pass = 0, fail = 0;
const out = [];
const ok = (name, cond, detail) => {
  if (cond) { pass++; out.push("  ok    " + name); }
  else { fail++; out.push("  FAIL  " + name + (detail ? "\n          " + detail : "")); }
};

function stub() {
  const recipes = [
    {id: "r1", name: "Spaghetti Carbonara", tags: ["Pasta"], source: "Nonna",
     servings: "4", images: [], description: "The real one, no cream.",
     ingredients: ["200g spaghetti", "100g guanciale", "2 eggs", "", "50g pecorino"],
     steps: ["Boil the pasta.", "Render the guanciale.", "", "Combine off the heat."],
     notes: "Work fast off the heat."},
    {id: "r2", name: "Apple Crumble", tags: ["Sweet"], source: "", servings: "6",
     images: [], description: "", ingredients: ["6 apples", "Butter", "Flour"],
     steps: ["Stew the apples.", "Rub the crumble.", "Bake."], notes: ""},
  ];
  const books = [{id: "b1", name: "Sunday Cooking", logo: "chef",
                  notes: "The ones worth the washing up.",
                  recipeIds: ["r2", "r1"], created: "2026-01-01"}];
  const lists = [{id: "l1", title: "Weekly shop",
                  items: ["Milk", "Guanciale", "", "Pecorino", "Apples"]}];
  const api = {
    ping: async () => ({ok: true}),
    library_info: async () => ({root: "/d", found: true, photoFiles: 0}),
    photo_get_data: async () => ({photos: [], albums: [], folders: [], photoTagList: []}),
    get_prefs: async () => ({}), set_prefs: async () => ({ok: true}),
    read_taken_dates: async () => ({dates: {}}),
    music_read_json: async () => ({tracks: {}, playlists: [], albums: []}),
    chords_list: async () => [],
    cards_read_json: async () => ({tarotDecks: [], oracleDecks: [], lenormandDecks: [],
      tarotReadings: [], oracleReadings: [], lenormandReadings: [],
      meditation: [], journal: [], gratitude: []}),
    cranium_get_data: async () => ({stats: {}, saved: {}, wordLists: [],
      wordGuessList: [], slideImages: [], books: []}),
    cranium_get_prefs: async () => ({}), kc_available: async () => true,
    kc_get_data: async () => JSON.parse(JSON.stringify({
      photos: [], albums: [], photoTagList: [], folders: [], events: [],
      contacts: [], recipes, menus: [], shoppingLists: lists, books,
      tagList: ["Pasta", "Sweet"]})),
    kc_save_data: async () => ({ok: true}),
    kc_get_money: async () => ({templates: [], oneoffs: [], payments: {}, goals: [],
      spendingLog: {periodStart: "", entries: []}, calc: {bills: [], income: []}}),
    kc_money_stamp: async () => 0,
    training_load: async () => ({exercises: {}, circuits: [], sessions: [], guides: [],
      questionnaires: [], calendars: [], athletes: [], equipment: [],
      circuitTypes: [], lessonPlans: []}),
    training_get_prefs: async () => ({}), training_stamp: async () => 0,
    training_formats: async () => ({docx: false, xlsx: false, pdf: false}),
    notes_list_tree: async () => [],
    notes_read_all_notes: async () => ({notes: [], truncated: false}),
    notes_get_prefs: async () => ({}), boards_list: async () => [],
    cells_list: async () => [], notebooks_list: async () => [],
    effects_load: async () => ({items: [], types: []}),
    /* A marker, not a copy of the real letterhead: what it contains is a
       Python question and is settled in test_print_header.py. What this
       side owes is asking for it and putting it on the page. */
    print_header: async (title, opts) => {
      window.__headerAsks = (window.__headerAsks || []).concat([{title, opts}]);
      return '<div id="shared-letterhead"></div>';
    },
    open_print_document: async (h) => { window.__printed = h; return {ok: true}; },
    export_formats: async () => ({html: true, docx: true, pdf: false}),
    export_document: async (n, h, f) => {
      window.__exported = {name: n, html: h, fmt: f};
      return {ok: true, path: "/desktop/" + n + "." + f};
    },
  };
  window.pywebview = {api: new Proxy(api, {get: (t, n) => (n in t ? t[n]
    : (typeof n === "string" ? async () => ({}) : undefined))})};
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({viewport: {width: 1300, height: 900}});
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.addInitScript(stub);
  await page.goto("file://" + path.join(UI, "index.html"));
  await page.waitForTimeout(2400);

  /* ---- nothing the shim forwards to may be missing --------------------- */
  /* THE SHIMS, by their real names. The first version of this walked
     window.CP.Store, which is the TRAINING host and has no cookery
     forwards on it at all -- so it found nothing wrong and stayed green
     while printRecipe was missing, which is precisely the bug it was
     written to catch. The Kitchen's host is window.CK.shared.

     Checked here rather than listed: whatever forwards exist on these
     objects get walked, so a sixth dead one added later is caught the day
     it appears instead of when somebody remembers this file. */
  const walked = await page.evaluate(() => {
    const hosts = {"CK.shared.Store": window.CK && window.CK.shared
                     && window.CK.shared.Store,
                   "CP.Store": window.CP && window.CP.Store};
    const bad = [];
    let looked = 0;
    for (const [where, shim] of Object.entries(hosts)) {
      if (!shim) { bad.push(where + " is missing entirely"); continue; }
      for (const name of Object.keys(shim)) {
        let fn;
        try { fn = shim[name]; } catch (e) { continue; }
        if (typeof fn !== "function") continue;
        const m = String(fn).match(/SS\.Store\.(\w+)\s*\(/);
        if (!m) continue;
        looked += 1;
        if (typeof window.SS.Store[m[1]] !== "function") {
          bad.push(`${where}.${name} -> SS.Store.${m[1]}`);
        }
      }
    }
    return {bad, looked};
  });
  ok("the shims were actually walked", walked.looked >= 5,
    `only ${walked.looked} forwards found — if this is 0 the check below `
    + "proves nothing, which is how the original version of it passed");
  ok("every call the Kitchen shim forwards actually exists",
    walked.bad.length === 0,
    "these forward to nothing and throw the moment they are used: "
    + walked.bad.join(", "));

  for (const name of ["printRecipe", "printShoppingList", "printBook",
                      "exportBook", "pdfAvailable"]) {
    ok(`  SS.Store.${name}`,
      (await page.evaluate((n) => typeof window.SS.Store[n], name)) === "function");
  }

  /* ---- and the buttons produce documents ------------------------------- */
  await page.evaluate(() => window.SS.go("recipes"));
  await page.waitForTimeout(1400);
  await page.evaluate(() => {
    const e = [...document.querySelectorAll("*")]
      .find((x) => /Spaghetti Carbonara/.test(x.textContent) && !x.children.length);
    if (e) e.click();
  });
  await page.waitForTimeout(800);
  const hasBtn = await page.evaluate(() =>
    !!document.querySelector("#split-print-recipe"));
  ok("a recipe has a Print button", hasBtn);
  if (hasBtn) {
    await page.evaluate(() => { window.__printed = ""; });
    await page.evaluate(() => document.querySelector("#split-print-recipe").click());
    await page.waitForTimeout(700);
    const doc = await page.evaluate(() => window.__printed || "");
    ok("pressing it actually prints something", doc.length > 0,
      "this is the bug: the button existed, the shim existed, and the "
      + "function behind them did not");
    ok("  the recipe is on it", /Spaghetti Carbonara/.test(doc));
    ok("  with its ingredients", /200g spaghetti/.test(doc) && /pecorino/.test(doc));
    ok("  and its method in order",
      doc.indexOf("Boil the pasta") < doc.indexOf("Combine off the heat"));
    ok("  blank lines are not printed as empty bullets",
      !/<li>\s*<\/li>/.test(doc),
      "the editor keeps a trailing empty line for typing into");
    ok("  on the app's shared letterhead",
      doc.includes('<div id="shared-letterhead">'),
      "Cam asked for one header across the app that same morning");
    /* Cam: "for the print page same as the Cams Coach i would like the
       logo in the top right." Asked for by name here; that the header
       then draws it in the right corner is settled in
       test_print_header.py against the real builder. */
    const asks = await page.evaluate(() => window.__headerAsks || []);
    ok("  asking for the camscookery logo on the right",
      asks.length > 0 && asks[asks.length - 1].opts
      && asks[asks.length - 1].opts.logo === "camscookery.svg",
      JSON.stringify(asks[asks.length - 1] && asks[asks.length - 1].opts));
    ok("  with the name as text, not baked into the picture",
      asks[asks.length - 1].opts.name === "camscookery",
      "the wordmark drawn into his artwork is ~11px tall once the logo "
      + "fits a letterhead; as text it stays crisp and exports cleanly");
    ok("  and it is paper, not the dark theme",
      /background:\s*#fff/.test(doc) && /print-color-adjust:\s*exact/.test(doc));
    ok("  the name is not printed twice",
      (doc.match(/Spaghetti Carbonara/g) || []).length <= 2,
      "the letterhead already centres it; a heading right under it reads "
      + "as a mistake");
  }

  /* ---- the other three, which were just as dead ------------------------ */
  const built = await page.evaluate(async () => {
    const recipes = (window.SS._test && window.SS._test.data
      && window.SS._test.data.recipes) || [];
    const p = window.SS.CookeryPrint;
    const list = {title: "Weekly shop",
                  items: ["Milk", "Guanciale", "", "Pecorino"]};
    const book = {name: "Sunday Cooking", notes: "The good ones",
                  recipeIds: ["r2", "r1"], logoPath: "M6 12.5C3.8 12.5 2 10.7 2 8.5"};
    const all = [
      {id: "r1", name: "Spaghetti Carbonara", ingredients: ["200g spaghetti"],
       steps: ["Boil."], tags: [], notes: "", servings: "4"},
      {id: "r2", name: "Apple Crumble", ingredients: ["6 apples"],
       steps: ["Bake."], tags: [], notes: "", servings: "6"},
    ];
    return {
      list: await p.shoppingListHtml(list),
      book: await p.bookHtml(book, all),
      bookMissing: await p.bookHtml({name: "Gaps", recipeIds: ["r1", "gone"]}, all),
    };
  });
  ok("a shopping list prints", built.list.includes("Weekly shop")
    && /Guanciale/.test(built.list));
  ok("  with a box beside each line to tick in the shop",
    (built.list.match(/class="box"/g) || []).length === 3,
    "3 items after the blank one is dropped");
  ok("a recipe book prints", /Sunday Cooking/.test(built.book)
    && /Apple Crumble/.test(built.book) && /Spaghetti Carbonara/.test(built.book));
  ok("  in the order Cam put them in the book, not alphabetical",
    built.book.indexOf("Apple Crumble") < built.book.indexOf("Spaghetti Carbonara"),
    "a recipe book has a running order; re-sorting it would be a second "
    + "opinion about his own book");
  ok("  with a contents page", /Contents/.test(built.book));
  ok("  and each recipe keeps its own heading inside the book",
    /<h2>Apple Crumble<\/h2>/.test(built.book),
    "on its own a recipe takes its name from the letterhead, but in a book "
    + "it is a chapter");
  ok("a recipe deleted since it was filed is skipped, not printed blank",
    /Spaghetti Carbonara/.test(built.bookMissing)
    && !/undefined/.test(built.bookMissing));

  /* ---- the two things Cam could not see -------------------------------

     Cam: "the X which comes up when i open a recipe to close it, please
     make the colour match the themes, not just grey." And: "there is no
     indicator that i have selected a tag."

     One fault, twice: the Kitchen came over from KinCrux using class names
     this app's stylesheet does not define. .split-close had no rules at
     all, so it fell back to a browser-default button -- the grey X. A
     chosen tag was given .chip-accent, which also had no rules anywhere,
     so it looked identical to an unchosen one.

     Checked by READING THE PAINTED COLOUR in each theme, not by looking
     for a class name. A class that is applied and unstyled is exactly the
     bug, and a check for the class would have passed throughout. */
  await page.evaluate(() => window.SS.go("add-recipe"));
  await page.waitForTimeout(900);
  await page.evaluate(() => {
    const t = document.querySelectorAll("[data-tag]");
    if (t[0]) t[0].click();
  });
  await page.waitForTimeout(400);

  ok("a tag can be chosen at all",
    await page.evaluate(() => !!document.querySelector(".chip[data-picked='1']")));

  const themes = ["hearth", "professional", "greenblack", "aero", "win98",
                  "icecream", "contrast", "lightgreen", "plum"];
  const seen = [];
  for (const th of themes) {
    await page.evaluate((t) => window.CruxTheme.setTheme(t), th);
    await page.waitForTimeout(90);
    seen.push(Object.assign({theme: th}, await page.evaluate(() => {
      const cv = document.createElement("canvas"); cv.width = cv.height = 1;
      const cx = cv.getContext("2d", {willReadFrequently: true});
      const rgb = (c) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = "#000";
        cx.fillRect(0, 0, 1, 1); cx.fillStyle = c; cx.fillRect(0, 0, 1, 1);
        const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2]].join(); };
      const on = document.querySelector(".chip[data-picked='1']");
      const off = document.querySelector(".chip[data-picked='0']");
      return {
        sel: on ? rgb(getComputedStyle(on).backgroundColor) : null,
        off: off ? rgb(getComputedStyle(off).backgroundColor) : null,
        accent: rgb(getComputedStyle(document.documentElement)
          .getPropertyValue("--accent").trim()),
      };
    })));
  }
  ok("a chosen tag is filled in the theme's own colour, in every theme",
    seen.every((r) => r.sel && r.sel === r.accent),
    seen.filter((r) => r.sel !== r.accent).map((r) => `${r.theme}: ${r.sel}`).join("; "));
  ok("  and looks nothing like an unchosen one",
    seen.every((r) => r.sel !== r.off),
    "before this they were the same colour, because the class the Kitchen "
    + "applied to a chosen tag had no rules anywhere in the app");

  /* The X, in the same way: painted colour, not class names. */
  await page.evaluate((t) => window.CruxTheme.setTheme(t), "hearth");
  await page.evaluate(() => window.SS.go("recipes"));
  await page.waitForTimeout(1100);
  await page.evaluate(() => {
    const e = [...document.querySelectorAll("*")]
      .find((x) => /Spaghetti Carbonara/.test(x.textContent) && !x.children.length);
    if (e) e.click();
  });
  await page.waitForTimeout(800);
  ok("an open recipe has a close button",
    await page.evaluate(() => !!document.querySelector(".split-close")));
  const xs = await page.evaluate(() => {
    const cv = document.createElement("canvas"); cv.width = cv.height = 1;
    const cx = cv.getContext("2d", {willReadFrequently: true});
    const rgb = (c) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = "#000";
      cx.fillRect(0, 0, 1, 1); cx.fillStyle = c; cx.fillRect(0, 0, 1, 1);
      const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2]].join(); };
    const x = document.querySelector(".split-close");
    const cs = getComputedStyle(x);
    const root = getComputedStyle(document.documentElement);
    return {bg: rgb(cs.backgroundColor), border: rgb(cs.borderTopColor),
            colour: rgb(cs.color),
            elevated: rgb(root.getPropertyValue("--elevated").trim()),
            line: rgb(root.getPropertyValue("--line-strong").trim()),
            muted: rgb(root.getPropertyValue("--muted").trim())};
  });
  ok("the close button is painted from the theme, not left to the browser",
    xs.bg === xs.elevated && xs.border === xs.line && xs.colour === xs.muted,
    JSON.stringify(xs) + " — unstyled it falls back to a browser-default "
    + "button, which is the grey X Cam was looking at");

  ok("nothing threw", errs.length === 0, errs.slice(0, 3).join(" | "));

  console.log("\ntest_cookery_print.js");
  console.log(out.join("\n"));
  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
