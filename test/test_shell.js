/* ==========================================================================
   NeuroNet's shell and photo library.
   ==========================================================================
   Stage 1 is the foundation the other three stages get built on, so what
   is checked here is mostly about what must STAY true once Chords,
   Cranium and Celestrial are dropped in beside it.

   THE ROUTER MUST NOT DEPEND ON A MODULE EXISTING. NeuroNet should
   still be a photo library if the games file fails to load. Every module
   is reached through a guard, and a missing one must not take the app
   down -- which is a thing you can only find out by booting without it,
   so that is what this does.

   AND THE PHOTO LIBRARY IS NOT NEW CODE. It came across from KinCrux,
   where it had real bugs found and fixed in it: the picker that starts
   empty, the rename that carries references, the empty folder that
   shadowed the real library. The point of these checks is that the move
   did not quietly undo any of that.
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

const PHOTOS = [
  {id: "p1", storedName: "ham.jpg", originalName: "ham.jpg",
   caption: "Dad And His Ham", tags: ["Family"], notes: "", takenDate: "2026-09-21",
   created: "2026-09-21", albumIds: [], folderId: "", rating: 0, kind: ""},
  {id: "p2", storedName: "fool.jpg", originalName: "fool.jpg",
   caption: "The Fool", tags: ["Tarot"], notes: "", takenDate: "",
   created: "2026-09-01", albumIds: ["al1"], folderId: "", rating: 5, kind: "card"},
  {id: "p3", storedName: "sleeve.jpg", originalName: "sleeve.jpg",
   caption: "Science And Faith", tags: [], notes: "", takenDate: "",
   created: "2026-08-01", albumIds: [], folderId: "f1", rating: 0, kind: "cover"},
];
const LIB = {
  photos: PHOTOS, albums: [{id: "al1", name: "Rider-Waite"}],
  folders: [{id: "f1", name: "Sleeves", parentId: ""}],
  photoTagList: ["Family", "Tarot"],
};

function declaredScripts() {
  const html = fs.readFileSync(path.join(UI, "index.html"), "utf8");
  return [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
}

async function boot() {
  const calls = [];
  const store = {data: JSON.parse(JSON.stringify(LIB)), prefs: {}};
  const known = {
    library_info: async () => ({root: "/d/neuronet_data", found: true, photoFiles: 3}),
    photo_get_data: async () => JSON.parse(JSON.stringify(store.data)),
    photo_save_data: async (d) => { store.data = d; return {ok: true}; },
    get_prefs: async () => store.prefs,
    set_prefs: async (p) => { Object.assign(store.prefs, p); return {ok: true}; },
    read_taken_dates: async () => ({dates: {}}),
    photo_details: async () => ({bytes: 1, width: 10, height: 10}),
    photo_thumb: async () => ({dataUrl: "data:image/jpeg;base64,T"}),
    photo_frame: async () => ({dataUrl: "data:image/jpeg;base64,F"}),
    photo_full: async () => ({dataUrl: "data:image/jpeg;base64,D"}),
    /* The real backend returns a LIST here. This suite now OPENS every
       section (the two-menu checks), so Chords mounts and calls .map on it. */
    chords_list: async () => [],
    cranium_get_data: async () => ({stats: {}, saved: {}, wordLists: [],
      wordGuessList: [], slideImages: [], books: []}),
    photo_rename: async (stored, name) => ({storedName: name + ".jpg",
                                            originalName: name + ".jpg"}),
  };
  const api = new Proxy({}, {
    get: (t, n) => {
      if (typeof n !== "string") return undefined;
      return async (...args) => {
        calls.push(n);
        return known[n] ? known[n](...args) : {};
      };
    },
  });

  const dom = new JSDOM(fs.readFileSync(path.join(UI, "index.html"), "utf8"),
    {runScripts: "outside-only", url: "file://" + UI + "/index.html"});
  const w = dom.window;
  w.pywebview = {api};
  w.matchMedia = w.matchMedia
    || (() => ({matches: false, addListener() {}, removeListener() {}}));
  w.scrollTo = () => {};
  w.requestAnimationFrame = w.requestAnimationFrame || ((fn) => setTimeout(fn, 0));
  w.cancelAnimationFrame = w.cancelAnimationFrame || ((id) => clearTimeout(id));
  /* jsdom gaps, not app gaps -- Chromium runs these fine. */
  w.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  w.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
  w.HTMLMediaElement.prototype.pause = function () {};
  w.HTMLMediaElement.prototype.load = function () {};
  w.HTMLCanvasElement.prototype.getContext = () => ({
    clearRect() {}, fillRect() {}, beginPath() {}, arc() {}, moveTo() {},
    lineTo() {}, stroke() {}, fill() {}, save() {}, restore() {},
    translate() {}, scale() {}, createLinearGradient: () => ({addColorStop() {}}),
    setTransform() {}, closePath() {},
  });
  for (const src of declaredScripts()) {
    w.eval(fs.readFileSync(path.join(UI, src), "utf8"));
  }
  await new Promise((r) => setTimeout(r, 200));
  return {w, calls, store};
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms || 60));

(async () => {
  const {w, calls, store} = await boot();
  const doc = w.document;

  /* ---- it is NeuroNet, not a renamed KinCrux -------------------- */
  ok("the app boots with its own namespace",
    typeof w.SS === "object" && w.SS !== null, typeof w.SS);
  /* This used to demand that window.CP not exist at all. Training moved
     here from KinCrux and reaches its host as CP, so NeuroNet now offers
     that name -- but the danger the check guarded against was two names
     holding DIFFERENT state, with half the modules talking to the wrong
     one. So the check is now exactly that: CP may exist only as an alias
     for NeuroNet's own objects, and carry nothing of its own except the
     modules that arrived from KinCrux -- Training (moved) and Notes
     (copied). Give CP any state of its own and this fails. */
  {
    const cp = w.CP;
    /* Cookery and Money joined Training and Notes with the merge. What still
       matters is that CP carries no STATE of its own: Store and shared must
       be the very same objects, or two halves of the app end up talking to
       different ones. */
    /* thumb joined them: a cached photo thumbnail. It is a forwarder to
       the host's own SS.Art, not a second cache -- which is the whole
       point of it being here, since a module that fetched its own would
       be exactly the divergence this check exists to catch. Checked
       below rather than merely allowed. */
    const own = cp ? Object.keys(cp).filter((k) =>
      !["Store", "shared", "Training", "Notes", "Cookery", "Money",
        "thumb"].includes(k)) : [];
    ok("  and CP carries no state of its own; Store and shared are aliases",
      !cp || (cp.Store === w.SS.Store && cp.shared === w.SS.shared && own.length === 0),
      cp ? "CP holds its own: " + own.join(", ") : "");

    /* CP.thumb must go through the host's one cache, not fetch its own.
       Asked, not assumed: fetch the same photo twice and the backend
       must be called once. */
    {
      const before = calls.filter((c) => c === "photo_thumb").length;
      await cp.thumb("shared-check.jpg");
      await cp.thumb("shared-check.jpg");
      const added = calls.filter((c) => c === "photo_thumb").length - before;
      ok("  and CP.thumb shares the host's cache rather than keeping one",
        added === 1, added + " backend calls for two asks");
    }
  }
  /* Cam, at the merge: "i now want the two apps merged together into one
     and for it to be called Meus Cerebro". Then, later: "I want the app to
     be called NeuroNet. Please rename everything."

     Those are two different asks and the second undid half of the first.
     At the merge only the name Cam SAW changed -- the file names, the data
     folder and the ids inside deliberately did not, so an update could be
     unzipped over the install without touching a thing. The NeuroNet
     rename changed the file names and the data folder as well, which is
     why neuronet.py now knows the old names and adopts a library found
     under them. See test_rename_migration.py.

     The old name is written out here rather than renamed along with
     everything else on purpose: it is a quote. A search-and-replace across
     the source put "NeuroNet" inside Cam's own sentence from the merge and
     left this paragraph claiming the data folder never changes, which by
     then it did. A comment that quietly rewrites what someone said, and
     then states the opposite of what the code does, is worse than no
     comment. */
  ok("the window is called NeuroNet", /NeuroNet/.test(doc.title), doc.title);
  /* The name in the menu used to be a span of text. It is Cam's own
     wordmark now -- "Please incorporate this as the icon in the top left
     of the App" -- so the name lives in the mark's accessible label
     instead, and that is what has to carry it. test_brand_mark.js covers
     the artwork itself; this line only insists the corner still says who
     the app is, by whatever means. */
  const brand = doc.querySelector(".ss-brand-mark");
  ok("  and the corner still names it", !!brand
    && /NeuroNet/.test(brand.getAttribute("aria-label") || ""),
    brand ? brand.getAttribute("aria-label") : "no .ss-brand-mark at all");

  /* ---- the photo library came across working --------------------- */
  ok("the library loads through the NAMESPACED backend call",
    calls.includes("photo_get_data") && !calls.includes("get_data"),
    calls.join(", "));
  /* The app opens on Home now -- Cam: "by default favorites is the Main
     Section that is open when i open the app", and the favourites live on
     Home. So the library is opened deliberately before counting its tiles. */
  w.SS._test._setView("all");
  w.SS._test.render();
  await wait(120);
  ok("every photo is listed",
    doc.querySelectorAll(".tile").length === 3,
    doc.querySelectorAll(".tile").length + " tiles");

  /* ---- two menus: sections on the left, subsections on the right ----
     Cam: "The UI will split into a 2 side navbar system. The left side
     containing all the main sections, the right navbar containing all the
     sub sections of that main section." So each section is now OPENED and
     its subsections looked for in the right menu -- which also proves every
     one of them is still reachable, not merely present in some markup. */
  const left = () => doc.getElementById("ss-nav").textContent;
  const right = () => doc.getElementById("ss-subnav-body").textContent;
  const crumb = () => doc.getElementById("ss-crumb").textContent;
  const openSection = async (key) => {
    doc.querySelector(`#ss-nav [data-section="${key}"]`).click();
    await wait();
  };

  ok("the left menu holds the main sections",
    ["Photos", "Training", "M&T", "Puzzles", "Divination", "Mindfulness", "Scribe", "Creative"]
      .every((n) => left().includes(n)), left());
  ok("and no subsections leak into it",
    !/Playlists|Circuits|Breathwork/.test(left()), left());

  await openSection("photos");
  ok("Photos opens its own menu: the library sections", /All photos/.test(right()), right());
  ok("  folders", /Sleeves/.test(right()), right());
  ok("  albums", /Rider-Waite/.test(right()), right());
  ok("  and tags", /Tarot/.test(right()), right());
  ok("  and the bottom bar says where we are", /Photos/.test(crumb()), crumb());

  for (const [key, label, item] of [["stuff", "M&T", "Playlists"],
                                    ["games", "Puzzles", "Puzzle Books"],
                                    ["divination", "Divination", "Tarot"],
                                    ["mind", "Mindfulness", "Breathwork"],
                                    ["training", "Training", "Circuits"],
                                    ["notes", "Scribe", "Notes"],
                                    ["creative", "Creative", "Paper creator"]]) {
    await openSection(key);
    ok(`${label} opens, and ${item} is in its menu`, right().includes(item), right().slice(0, 140));
    ok(`  bottom bar reads ${label} — …`, crumb().startsWith(label), crumb());
  }

  /* Training is NeuroNet's now -- Cam: "I want the training features to be
     moved from KinCrux to NeuroNet please". Notes is in both apps, each over
     its own vault. The rest of this list is still KinCrux's alone. */
  ok("and nothing else from KinCrux came with them",
    !/Recipes|Shopping|Overview|Contacts|Dashboard/.test(left() + right()),
    left() + right());

  await openSection("training");
  ok("coming back to a section returns to the screen it was left on",
    crumb().startsWith("Training"), crumb());

  /* ---- a module that is missing must not take the app down ------- */
  {
    ok("the games module IS loaded, so its views are real",
      !!w.SS.Games && w.SS.Games.VIEWS.includes("games:home"),
      "Games was the first module ported");
    ok("  and so are Music, Divination and Mindfulness",
      !!w.SS.Music && !!w.SS.Cards && !!w.SS.Mind, "");

    /* Cam: "when i click the side bar nothing changes it stays on the
       photo screen". It DID fall through to the photo library, which is
       the worst possible answer: he clicked Games, saw his photos, and
       reasonably concluded the whole app was broken. A screen that
       admits what it is beats a screen that silently shows something
       else. */
    /* Every sidebar entry has a module behind it now, which is the
       point -- so this uses an id that deliberately has none. */
    w.SS._test._setView("nothing:here");
    let threw = null;
    try { w.SS._test.render(); } catch (e) { threw = e; }
    await wait();
    ok("a view whose module isn't built does not throw", !threw,
      threw && threw.message);
    const main = doc.getElementById("ss-main").textContent;
    ok("  and SAYS it isn't built, rather than silently showing photos",
      /isn't built yet/i.test(main) && doc.querySelectorAll(".tile").length === 0,
      main.replace(/\s+/g, " ").slice(0, 80));

    w.SS._test._setView("all");
    w.SS._test.render();
    await wait();
    ok("  and the photo library is still there when you go back",
      doc.querySelectorAll(".tile").length === 3,
      doc.querySelectorAll(".tile").length + " tiles");
  }

  /* ---- the picker still starts empty ------------------------------ */
  {
    const promise = w.SS.shared.pickFromLibrary({title: "Pick deck art"});
    await wait(100);
    const grid = doc.getElementById("pick-grid");
    ok("the picker opens", !!grid, "no picker in the document");
    if (grid) {
      ok("  and starts EMPTY, not with a screenful of thumbnails",
        grid.querySelectorAll("[data-stored]").length === 0,
        grid.querySelectorAll("[data-stored]").length + " tiles preloaded");
      const input = doc.getElementById("pick-q");
      input.value = "fool";
      input.dispatchEvent(new w.Event("input", {bubbles: true}));
      await wait(120);
      ok("  searching finds the photo",
        grid.querySelectorAll("[data-stored]").length === 1,
        grid.querySelectorAll("[data-stored]").length + " results");
    }
    const veil = doc.getElementById("modal-veil");
    if (veil) veil.classList.remove("open");
    promise.catch(() => {});
  }

  /* ---- renaming still carries the reference ----------------------- */
  {
    const photo = w.SS._test.data.photos.find((p) => p.id === "p2");
    const before = photo.storedName;
    await w.SS.shared.renamePhotoEverywhere
      ? w.SS.shared.renamePhotoEverywhere(photo, "The Fool")
      : w.SS._test.renamePhotoEverywhere(photo, "The Fool");
    await wait(80);
    ok("renaming a photo moves the stored name on the record too",
      photo.storedName !== before && /The Fool/.test(photo.storedName),
      `${before} -> ${photo.storedName}`);
  }

  /* ---- settings ---------------------------------------------------- */
  {
    w.SS._test._setView("settings");
    w.SS._test.render();
    await wait(120);
    const main = doc.getElementById("ss-main").textContent;
    ok("Settings lists the sections that can be switched off",
      /M&T/.test(main) && /Puzzles/.test(main)
      && /Divination/.test(main) && /Mindfulness/.test(main),
      main.slice(0, 140));
    /* Kitchen and Money HAVE merged in now. They read KinCrux's own files
       where they sit; only the photo library is being combined. */
    ok("  and Kitchen and Money, which merged in",
      /Kitchen/.test(main) && /Money/.test(main), main.slice(0, 240));
    ok("  and does offer Training, which moved here",
      /Training/.test(main), main.slice(0, 200));
    ok("  and Notes, which is here as well as in KinCrux",
      /Notes/.test(main), main.slice(0, 200));
  }

  console.log("\nNeuroNet — the shell and the photo library\n");
  out.forEach((l) => console.log(l));
  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e.stack); process.exit(1); });
