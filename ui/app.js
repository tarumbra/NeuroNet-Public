/* ==========================================================================
   NeuroNet — the shell, and the photo library everything picks from.
   ==========================================================================
   MOVED FROM KINCRUX, NOT REWRITTEN. This is Capture's photo library,
   which KinCrux had already had real bugs found and fixed in: the empty
   data folder that shadowed the real library, the rename that has to
   carry every reference with it, the picker that starts empty rather
   than decoding a screenful of thumbnails Cam did not ask for. Writing
   a second photo library from scratch would have reintroduced all
   three, and Cam already knows how this one behaves.

   WHAT WAS TAKEN OUT is the other half of KinCrux: the calendar,
   contacts, dashboard, Kitchen, Money, Training and Notes. That is the
   "keep the bloat down" half of the request, and it was done by
   DELETING from a working file rather than extracting into a new one --
   the safer direction, because the app either still boots and passes or
   it does not.

   THE ROUTER MUST SURVIVE A MISSING MODULE. Music, Games and Cards are
   each reached through a guard, so NeuroNet is still a photo library
   if one of their files fails to load. Chords is deliberately not
   routed the same way: its audio has to keep playing across every one
   of these screens, so the player lives above the router entirely.
   ========================================================================== */
"use strict";

const SS = {};
window.SS = SS;
/* Which engine draws the page, for the stylesheet's scrollbars (shared.css):
   Chromium (--gui qt) is styled with ::-webkit-scrollbar, WebKitGTK with the
   standard properties, and the two can't both be set under Chromium. */
if (/Chrom(e|ium)\//.test(navigator.userAgent)) document.documentElement.dataset.engine = "chromium";

/* themes.js loads before this file and defines the real CruxTheme.
   If it is ever missing — a partial copy, a changed load order, a
   file that failed to fetch — this stands in for it so the app still
   starts in the default palette instead of dying on the first call
   in boot(). Each module is already guarded at its own call site
   the same way; this closes the matching gap for themes, which had
   seven unguarded calls and would white-screen the whole app.

   Deliberately a full no-op shim rather than a guard at each call
   site: the alternative is seven `CruxTheme && ...` checks that
   have to be remembered every time a theme call is added. */
if (!window.CruxTheme) {
  window.CruxTheme = {
    /* an honest mirror of themes.js's own surface — if that file
       grows a method, this needs the matching no-op */
    THEMES: {}, TEXT_SIZES: {}, theme: "hearth", textSize: "normal",
    setTheme: () => false, setTextSize: () => false,
    adoptFromPrefs() {}, swatchHtml: () => "", _missing: true,
  };
}

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escA = (s) => esc(s).replace(/"/g, "&quot;");
const ic = (name, cls) =>
  `<svg class="ic ${cls || ""}" viewBox="0 0 24 24"><use href="#${name}"/></svg>`;
const newId = () => "x" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* ------------------------------------------------------------- store --- */
SS.Store = (() => {
  let api = null;
  const ready = new Promise((resolve) => {
    if (window.pywebview && window.pywebview.api) { api = window.pywebview.api; resolve(); }
    else window.addEventListener("pywebviewready", () => {
      api = window.pywebview.api; resolve();
    }, {once: true});
    setTimeout(resolve, 700);
  });
  const desktop = () => api !== null;
  const nope = (what) => ({error: `${what} runs in the desktop app.`});

  /* The one way a MODULE reaches the backend. Modules must not close
     over `api` themselves — going through here means a missing method
     (newer UI, older Python: a half-updated folder) becomes a sentence
     the UI can show rather than an unreadable bridge error, and every
     module gets that for free.

     This mirrors crux/js/store.js's own call(). app.js still has its
     own Store rather than using the shared one; moving it is a later
     stage, and this is the seam that makes that move small. */
  async function call(name, args, whatFor) {
    await ready;
    if (!desktop()) return nope(whatFor || "That");
    if (typeof api[name] !== "function") {
      return {error: `${whatFor || "That"} needs a newer build \u2014 `
        + "the app files are out of step with each other."};
    }
    try {
      return await api[name].apply(api, args || []);
    } catch (e) {
      return {error: String((e && e.message) || e)};
    }
  }

  return {
    call,
    ready, desktop,
    async libraryInfo() { await ready; return desktop() ? api.library_info() : {root: "", found: false}; },
    async chooseLibrary() { await ready; return desktop() ? api.choose_library() : nope("Choosing a folder"); },
    async load() { await ready; return desktop() ? api.photo_get_data()
      : {photos: [], albums: [], photoTagList: [], folders: []}; },
    async save(d) { await ready; return desktop() ? api.photo_save_data(d) : {ok: true}; },
    async frame(n) { await ready; return desktop() ? api.photo_frame(n) : nope("Loading"); },
    async getPrefs() { await ready; return desktop() ? api.get_prefs() : {}; },
    async setPrefs(p) { await ready; return desktop() ? api.set_prefs(p) : {ok: true}; },
    async pickPhotos() { await ready; return desktop() ? api.photo_pick() : nope("Choosing files"); },
    async storePhoto(p) { await ready; return desktop() ? api.photo_store(p) : nope("Adding photos"); },
    /* Renames the FILE, not just the caption. Returns the new stored
       name; carrying the references is the caller's job -- see
       renamePhotoEverywhere below. */
    async renamePhoto(stored, name) {
      await ready;
      if (!desktop()) return nope("Renaming");
      if (typeof api.photo_rename !== "function") {
        return {error: "Renaming the file needs a newer build."};
      }
      return api.photo_rename(stored, name);
    },
    async storeDataUrl(u) { await ready; return desktop() ? api.photo_store_data_url(u) : nope("Adding photos"); },
    async thumb(n) { await ready; return desktop() ? api.photo_thumb(n) : nope("Loading"); },
    async full(n) { await ready; return desktop() ? api.photo_full(n) : nope("Loading"); },
    async del(n) { await ready; return desktop() ? api.photo_delete(n) : nope("Deleting"); },
    async rotate(n, dir) {
      await ready;
      if (!desktop()) return nope("Rotating");
      if (typeof api.photo_rotate !== "function") return {error: "Rotating needs a newer build."};
      return api.photo_rotate(n, dir);
    },
    async exportOne(n, o) { await ready; return desktop() ? api.photo_export(n, o) : nope("Exporting"); },
    async exportMany(items) { await ready; return desktop() ? api.photo_export_many(items) : nope("Exporting"); },
    async exportText(name, text) {
      await ready;
      if (!desktop()) return nope("Exporting");
      /* an older hearth.py won't have this method — say so plainly
         rather than throwing a bridge error at Cam */
      if (typeof api.export_text_file !== "function") {
        return {error: "This needs the newer hearth.py — update the app files."};
      }
      return api.export_text_file(name, text);
    },
    async details(n) { await ready; return desktop() ? api.photo_details(n) : {}; },
    /* cookery, merged in from Cheffo */
    /* ---- the Kitchen's printing and exporting -------------------------

       Cam: "Printing a recipe does not work for some reason."

       These five were REFERENCED by the shim that carries KinCrux's
       Kitchen calls into this app (CP.Store, below) and never written. A
       press of Print threw "SS.Store.printRecipe is not a function"
       inside an async handler with nothing catching it: no toast, no
       message, a button that did nothing at all. The recipe is the one
       Cam happened to try; the list, the book and the book export were
       equally dead.

       The documents themselves are built in cookery-print.js -- kept
       apart because one is the bridge and the other is a document
       builder, and they are read for different reasons. */
    async printRecipe(r) {
      await ready;
      if (!desktop()) return nope("Printing");
      return api.open_print_document(await SS.CookeryPrint.recipeHtml(r), "recipe");
    },
    async printShoppingList(l) {
      await ready;
      if (!desktop()) return nope("Printing");
      return api.open_print_document(await SS.CookeryPrint.shoppingListHtml(l), "shopping-list");
    },
    async printBook(b, recipes) {
      await ready;
      if (!desktop()) return nope("Printing");
      return api.open_print_document(await SS.CookeryPrint.bookHtml(b, recipes), "recipe-book");
    },
    async exportBook(b, recipes, fmt) {
      await ready;
      if (!desktop()) return nope("Exporting");
      const html = await SS.CookeryPrint.bookHtml(b, recipes);
      return api.export_document(b && b.name || "Recipe book", html, fmt || "html");
    },
    /* Whether a PDF can be written here. The Kitchen asks before offering
       it, so a machine without the library is told rather than shown a
       button that fails. */
    async pdfAvailable() {
      await ready;
      if (!desktop()) return false;
      const f = await api.export_formats();
      return !!(f && f.pdf);
    },
    async takenDates(names) {
      await ready;
      if (!desktop() || typeof api.read_taken_dates !== "function") return {dates: {}};
      return api.read_taken_dates(names);
    },
  };
})();


/* ==========================================================================
   THE COOKERY BRIDGE
   ==========================================================================
   Cam: "i would like to combine cheffo and merge into the hearth app."

   cookery.js is Cheffo's UI, ported whole. It cannot simply be loaded
   beside this file: both declare `esc`, `escA`, `openDlg`, `data`,
   `render` and more at the top level, and two `const` declarations of
   the same name in one page is a SyntaxError that stops the app dead.

   So cookery.js is wrapped in an IIFE — its own scope, its own copies of
   the small helpers — and everything it genuinely needs to SHARE comes
   through this one object. Sharing matters most for `data`: there is one
   library file and one in-memory copy of it, and a second `let data` in
   cookery.js would silently diverge from this one the moment either side
   reassigned. Hence the getter rather than a plain reference.
   ========================================================================== */
/* A module asking the host to change view. Coach Cam's CF.go expects
   this; without it its navigation would silently do nothing. Unknown
   views are ignored rather than blanking the page. */
/* ==========================================================================
   Quick access -- NeuroNet as a popup
   ==========================================================================
   Cam: "a plugin that can load my tools in Neuronet and make them appear as
   a popup that i can do some quick work or viewing, rather then having to
   open the whole app all the time."

   neuronet-quick (beside neuronet.py) floats this window over whatever Cam
   is doing and calls this over D-Bus (org.neuronet.App.Quick, mpris.py):
   open `section` on the page last used in it (firstViewOf), and turn the
   compact look on or off. Compact = the left menu hidden; the top bar (the
   music) and the right-hand menu stay, and a "whole NeuroNet" button
   appears. Nothing is rebuilt: it is the same app, the same page. */
/* (Music and Media left for NeuroStream, 19 Nov 2026: M&T is its Inventories now; Super+Alt+M opens NeuroStream) */
const QUICK_HALVES = {stuff: {prefix: "stuff:", first: "stuff:inventories"}};
const lastHalfView = {};

SS.quickMode = (section, compact) => {
  const on = !!compact;
  $("ss-app").classList.toggle("nn-quick", on);
  const full = $("ss-quick-full");
  if (full) full.hidden = !on;
  /* a page by name ("settings:widgets", from a desktop widget's menu) */
  /* Super+Alt+I opens M&T on the page last used there. */
  const half = QUICK_HALVES[section];
  if (half) {
    if (!view.startsWith(half.prefix)) SS.go(lastHalfView[section] || half.first);
    return;
  }
  if (section && section.includes(":")) {
    if (view !== section) SS.go(section);
  } else if (section && sectionOf(view) !== section) {
    const v = firstViewOf(section);
    if (v) SS.go(v);
  }
};

/* ==========================================================================
   Bar widgets -- the page does the work
   ==========================================================================
   (Was the desktop board's too, until the desktop widgets went, 3 Nov 2026.)
   A bar widget that SAVES (the music widget's ♥) comes here, over org.neuronet.App.Do (mpris.py), so
   the only thing ever writing NeuroNet's data is NeuroNet, with the same
   code its own dashboard uses. The answer goes back through
   Api.board_done, and the widget shows it ("Already In Database", ...). */
/* "Follow Omarchy" (crux/theme.js): the Omarchy theme's colours, asked for
   at start-up and again whenever the Omarchy theme-set hook
   (~/.config/omarchy/hooks/theme-set.d/neuronet-theme) says it changed. */
async function refreshOmarchyTheme() {
  const api = window.pywebview && window.pywebview.api;
  if (!api || !api.omarchy_theme || !CruxTheme.setOmarchy) return {error: "Not in the desktop app."};
  const t = await api.omarchy_theme();
  if (!t || t.error) return t || {error: "No answer."};
  CruxTheme.setOmarchy(t);
  if (sectionOf(view) === "settings") render();     // the swatch changed
  return {ok: true, name: t.name || ""};
}

/* The Omarchy menu's NeuroNet rows (neuronet-menu -> neuronet-open): go to
   the Vault or Recipes, wait for it to be ready, and open the one thing. */
/* For Find (find.js): every page there is, by section, in the sidebar's
   order -- and openItem below, which opens a note or a recipe. */
SS.pagesIndex = () => orderedSections().flatMap((sec) => {
  const kids = orderedChildren(sec);
  return (kids.length ? kids : [{key: firstViewOf(sec), name: sectionName(sec)}])
    .filter((c) => c.key)
    .map((c) => ({key: c.key, name: c.name, section: sectionName(sec), icon: c.icon || CHILD_ICONS[c.key] || SECTION_META[sec].icon}));
});
SS.openItem = (kind, p) => openItem(kind, p);

async function openItem(kind, p) {
  if (kind === "note" && scribeHandedOver("notes:vault", {path: p && p.path})) return {ok: true};
  const want = kind === "note" ? "notes:vault" : "recipes";
  if (view !== want) SS.go(want);
  const ready = kind === "note"
    ? () => window.CC && CC.Shell && CC.Shell.booted && CC.Shell.openNote
    : () => window.CP && CP.Cookery && CP.Cookery.openRecipe
        && document.getElementById("cc-split-pane");
  for (let i = 0; i < 60 && !ready(); i++) await new Promise((r) => setTimeout(r, 100));
  if (!ready()) return {error: kind === "note" ? "Notes didn't open." : "The Kitchen didn't open."};
  if (kind === "note") {
    if (!p.path) return {error: "Which note?"};
    await CC.Shell.openNote(String(p.path));
  } else {
    if (!p.id) return {error: "Which recipe?"};
    if (CP.Cookery.openRecipe(String(p.id)) === false) return {error: "That recipe isn't there any more."};
  }
  return {ok: true};
}

/* (dropFile and trainingFromDesktop -- the desktop Drop zone's and Training cards' -- went with the desktop widgets,
   3 Nov 2026.) */
async function boardAction(action, p) {
  p = p || {};
  switch (action) {
    case "theme.omarchy":
      return refreshOmarchyTheme();
    case "open.note":
    case "open.recipe":
      return openItem(action === "open.note" ? "note" : "recipe", p);
    case "open.collab": {
      /* neuronet-open collab <code> (8 Nov 2026): the pop-up when the team adds something to Collaboration --
         clicking it opens that document on the desk */
      const ref = String(p.ref || "");
      if (!/^(PT|Q|B|I|N|V|C)\d+$/.test(ref)) return {error: "Which document?"};
      if (scribeHandedOver("collab:board", {ref})) return {ok: true};
      if (!SS.Collab) return {error: "Collaboration isn't loaded."};
      SS.Collab.open(ref);
      if (view === "collab:board") render(); else SS.go("collab:board");   // (already on the desk: shown again, on it)
      return {ok: true};
    }
    case "open.book":
      /* neuronet-open book ... (the Omarchy menu): NeuroNet's reader;
         closing the book puts NeuroNet away again. */
      if (!SS.Reader) return {error: "The reader isn't loaded."};
      return SS.Reader.open(String(p.kind || ""), String(p.id || ""), {fromDesktop: true});
    case "photo.add": {
      /* neuronet-capture (Super+Alt+X): a screen capture into Photos, in the
         "Captures" folder, tagged Capture -- saved the way addPhotoFromDataUrl
         saves a board export, so the library in memory and on disk agree. */
      const path = String(p.path || "");
      if (!path) return {error: "No picture came with that."};
      return addToPhotos({path, folder: "Captures", tag: "Capture", caption: p.caption});
    }
    /* neuronet-snip (15 Nov 2026): a snip into Photos, NeuroNet Snips */
    case "snip.add": {
      const path = String(p.path || ""), n = +p.n;
      if (!path || !n) return {error: "No snip came with that."};
      const res = await addToPhotos({path, folder: SNIP_FOLDER, tag: "Snip", caption: String(p.name || `Snip ${n}`)});
      if (res && res.ok) {
        const ph = data.photos.find((x) => x.storedName === res.storedName);
        if (ph) { ph.snip = n; await save(); }
      }
      if (res && res.ok && p.ask) setTimeout(() => snipSaveAs(n), 0);     // from the Snip button: name it now
      return res;
    }
    case "snip.replace": {          // edited in omasnap and saved again: the newer picture, same snip
      const ph = snipPhoto(p.n);
      if (!ph) return {error: "That snip isn't in Photos."};
      const stored = await SS.Store.storePhoto(String(p.path || ""));
      if (!stored || stored.error) return stored || {error: "The picture couldn't be stored."};
      const old = ph.storedName;
      ph.storedName = stored.storedName; ph.originalName = stored.originalName;
      await nameFileAfterCaption(ph);
      await save();
      if (old && old !== ph.storedName) await SS.Store.del(old);
      if (sectionOf(view) === "photos") render();
      return {ok: true, storedName: ph.storedName};
    }
    case "snip.rename": {           // neuronet-snip name N "..." from a terminal
      const ph = snipPhoto(p.n);
      if (!ph) return {ok: true};
      const moved = await renamePhotoEverywhere(ph, String(p.name || ph.caption));
      if (moved && moved.error) return moved;
      await save();
      if (sectionOf(view) === "photos") render();
      return {ok: true};
    }
    case "snip.archive": {          // Claude has used it: NeuroNet Snips / Archive (or back)
      const ph = snipPhoto(p.n);
      if (!ph) return {ok: true};
      ph.folderId = snipFolder(p.archived !== false).id;
      await save();
      if (sectionOf(view) === "photos") render();
      return {ok: true};
    }
    case "open.snip": {             // the notification: its Save as, over Photos -> NeuroNet Snips
      const n = +p.n;
      if (!n) return {error: "Which snip?"};
      const ph = snipPhoto(n);
      SS.go(ph && ph.folderId ? "folder:" + ph.folderId : "folder:" + snipFolder(false).id);
      setTimeout(() => snipSaveAs(n), 120);
      return {ok: true};
    }
    /* album.play, playlist.play, music.favourite, music.playlist.add: the bar's music widget talks to
       NeuroStream now (19 Nov 2026), on its own bus name */
    default:
      return {error: "NeuroNet doesn't know how to do " + action + "."};
  }
}

SS.boardDo = async (token, action, payloadJSON) => {
  let res;
  try { res = await boardAction(action, JSON.parse(payloadJSON || "{}")); }
  catch (e) { res = {error: String((e && e.message) || e)}; }
  const api = window.pywebview && window.pywebview.api;
  if (api && api.board_done) api.board_done(token, JSON.stringify(res || {}));
  return res;
};

/* A section, on the page it opens on -- or a view as it is. For the Neuro
   Guide's "Open in NeuroNet" links (Stage 4, 2026-09-29). */
SS.openSection = (key) => {
  const v = String(key || "").includes(":") ? key : firstViewOf(key);
  if (v) SS.go(v);
  return !!v;
};

SS.go = (next) => {
  if (!next || next === view) return;
  if (scribeHandedOver(next)) return;
  view = next;
  selection.clear();
  SS.Store.setPrefs({view});
  render();
};

/* ==========================================================================
   Ctrl+P — print whatever is on screen
   ==========================================================================
   Cam: "implement a shortcut ctrl+p to be able to print sessions,
   circuits, recipes etc."

   Every module already knows how to print its own thing, and each does
   it differently: a recipe goes through print_recipe_document, a
   session through open_print_document with HTML the Training module
   renders itself, Money's months open a range dialog first. So this
   does NOT reimplement printing. It keeps a register of what is
   currently printable and calls back into the module that offered it.

   THE HAZARD IS A STALE OFFER. If Training registers "print this
   session" and you then navigate away, Ctrl+P must not print the
   session you are no longer looking at -- that is worse than doing
   nothing, because it is silent and wrong. Manual clearing on every
   teardown path would be one missed call away from exactly that.

   So an offer is ANCHORED TO AN ELEMENT. It is only honoured while that
   element is still in the document and still visible. Close the pane,
   navigate away, re-render the view, and the anchor stops matching and
   the offer dies on its own with nothing to remember. */
SS.Print = (() => {
  const offers = [];

  /* Deliberately NOT a getBoundingClientRect size check. A zero box is
     a fair proxy for "not on screen" in a real browser, but it is also
     what every element measures under jsdom, which lays nothing out --
     so a rect test would make this untestable outside a full browser,
     and untestable is how the last few bugs got in. It would also be
     wrong for a pane scrolled out of view, which is still the screen
     you are on. Reachability is the real question, so ask that. */
  const visible = (el) => {
    if (!el || !el.isConnected) return false;
    if (typeof el.closest === "function" && el.closest("[hidden]")) return false;
    const win = el.ownerDocument && el.ownerDocument.defaultView;
    for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
      if (node.hidden) return false;
      const style = win && win.getComputedStyle ? win.getComputedStyle(node) : null;
      if (style && (style.display === "none" || style.visibility === "hidden")) {
        return false;
      }
    }
    return true;
  };

  return {
    /** Offer a print action for as long as `el` is on screen.
        @param el   the pane or card the printable thing is shown in
        @param label what is being printed, for the toast
        @param run  does the printing; may be async */
    offer(el, label, run) {
      if (!el || typeof run !== "function") return;
      /* one offer per element, so a re-render replaces rather than
         stacks -- otherwise a long session accumulates dead entries */
      const at = offers.findIndex((o) => o.el === el);
      if (at >= 0) offers.splice(at, 1);
      offers.push({el, label, run});
      /* drop anything already detached while we are here */
      for (let i = offers.length - 2; i >= 0; i--) {
        if (!offers[i].el.isConnected) offers.splice(i, 1);
      }
    },

    /** Withdraw an offer early — used where a pane stays in the
        document but is emptied, as Training's split detail does. */
    withdraw(el) {
      const at = offers.findIndex((o) => o.el === el);
      if (at >= 0) offers.splice(at, 1);
    },

    /** The most recently offered thing that is still on screen. Newest
        first: if a recipe is open over a list, the recipe is what you
        are looking at and what Ctrl+P should print. */
    current() {
      for (let i = offers.length - 1; i >= 0; i--) {
        if (visible(offers[i].el)) return offers[i];
        if (!offers[i].el.isConnected) offers.splice(i, 1);
      }
      return null;
    },

    /* A module that renders its own Print button and nothing else gets
       Ctrl+P for free through this: a visible button that says Print is
       taken at its word. It is the fallback, never the first choice,
       because a registered offer carries the actual record while this
       only knows how to click something. */
    fallbackButton() {
      const buttons = document.querySelectorAll(
        "button, [role='button'], a[href='#']");
      let found = null;
      for (const b of buttons) {
        const text = (b.textContent || "").trim();
        const id = b.id || "";
        if (!/^print\b/i.test(text) && !/print/i.test(id)) continue;
        if (b.disabled || !visible(b)) continue;
        found = b;               /* last one wins, same newest-first idea */
      }
      return found;
    },

    /* The two halves of the app report a print differently: Training's
       printDocument answers true / false / a sentence, Cookery's
       answers {ok} or {error}. Rather than making every registration
       translate, both shapes are read here and turned into one message,
       so Ctrl+P sounds the same wherever it is pressed. A registered
       run() therefore does the printing and nothing else -- no toasts
       of its own, or the user gets two. */
    say(res) {
      if (res === true) return toast("Sent to the printer.", "good");
      if (res === false) return toast("Cancelled.", "warn");
      if (typeof res === "string" && res) return toast(res, "good");
      if (res && res.error) return toast(res.error, "error");
      return toast("Sent to the printer.", "good");
    },

    async run() {
      const offer = this.current();
      if (offer) {
        toast(`Printing ${offer.label}…`, "good");
        try {
          this.say(await offer.run());
        } catch (err) {
          toast("Couldn't print that.", "error");
        }
        return true;
      }
      /* The fallback clicks a button, so the module that owns it gives
         whatever feedback it normally gives -- nothing to translate. */
      const button = this.fallbackButton();
      if (button) { button.click(); return true; }
      return false;
    },

    _count: () => offers.length,
  };
})();

/* Capture phase, on window, so it fires before any module's own key
   handling and before WebKit opens its print dialog for a page that is
   the whole app rather than the thing you wanted on paper. */
window.addEventListener("keydown", (e) => {
  if (e.key !== "p" && e.key !== "P") return;
  if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
  e.preventDefault();
  e.stopPropagation();
  SS.Print.run().then((did) => {
    if (!did) toast("There's nothing to print on this screen.", "warn");
  });
}, true);

SS.shared = {
  get data() { return data; },
  save: () => save(),
  render: () => render(),
  /** Offer a Ctrl+P target for as long as `el` is on screen. */
  offerPrint: (el, label, run) => SS.Print.offer(el, label, run),
  withdrawPrint: (el) => SS.Print.withdraw(el),
  /** Navigate to one of the cookery views and repaint. */
  go(next) { view = next; SS.Store.setPrefs({view: next}); render(); },
  /* Cheffo calls its happy-path toast kind "ok"; Hearth's is "good".
     Translated here rather than by editing every call site. */
  toast: (msg, kind) => toast(msg, kind === "ok" ? "good" : kind),
  confirm: (opts) => confirmDlg(opts),
  openDlg: (title, body, wide) => openDlg(title, body, wide),
  promptText: (title, label, initial) => promptText(title, label, initial),
  /* KinCrux's own photo picker. Every module uses this rather than
     opening its own file dialog, so a photo enters KinCrux once and is
     then chosen from the library wherever it is needed. */
  pickFromLibrary: (opts) => pickFromLibrary(opts),
  addToPhotos: (o) => addToPhotos(o),
  thumb: (storedName) => thumbFor(storedName),
  /* For a picker drawn inside another dialog (Media's cover), where
     pickFromLibrary's own dialog would replace the form being filled in. */
  photoSearch: (q) => photoSearch(q),
  photosInFolder: (name) => {
    const f = data.folders.find((x) => x.name === name && !x.parentId);
    return f ? (data.photos || []).filter((p) => p.folderId === f.id).slice(-PICKER_LIMIT).reverse() : [];
  },
  photoName: (p) => nameOf(p),
  /** Press-and-sweep selection over a list or grid (see sweepSelect). */
  sweepSelect: (container, opts) => sweepSelect(container, opts),
  /** Put a picture the app made into the photo library, as a real photo.

      Cam: "when exporting a board, have the ability to save to the in built
      photos section. From there it should be able to be exported to PC."
      Once it is a library photo, the viewer's own Export button saves it out
      — no second way to do the same thing. */
  addPhotoFromDataUrl: async (dataUrl, caption, tags) => {
    const stored = await SS.Store.call("photo_store_data_url", [dataUrl], "Saving the picture");
    if (!stored || stored.error) return stored || {error: "That picture could not be saved."};
    const photo = blankPhoto({
      storedName: stored.storedName,
      originalName: stored.originalName,
      caption: caption || "",
      tags: [...(tags || [])],
    });
    data.photos.push(photo);
    await nameFileAfterCaption(photo);
    await save();
    /* Only redraw when Photos is what is on screen. render() re-mounts the
       open section, and a board exporting a page was thrown straight out of
       its editor back to the board list. Adding a photo in the background
       must never tear down what Cam is working in. */
    if (sectionOf(view) === "photos") render();
    return {ok: true, storedName: photo.storedName};
  },
  Store: {
    get ready() { return SS.Store.ready; },
    pickPhoto: () => SS.Store.pickPhotos(),
    storePhoto: (p) => SS.Store.storePhoto(p),
    getPhotoData: (n) => SS.Store.full(n),
    deletePhoto: (n) => SS.Store.del(n),
    getPrefs: () => SS.Store.getPrefs(),
    setPrefs: (p) => SS.Store.setPrefs(p),
    printRecipeDocument: (r) => SS.Store.printRecipe(r),
    printShoppingListDocument: (l) => SS.Store.printShoppingList(l),
    printBookDocument: (b, rs) => SS.Store.printBook(b, rs),
    exportBook: (b, rs, f) => SS.Store.exportBook(b, rs, f),
    pdfAvailable: () => SS.Store.pdfAvailable(),
  },
};

/* Training came from KinCrux, where the host is called CP rather than SS.
   It reaches the backend through window.CP.Store.call and the photo picker
   through window.CP.shared, in fourteen files.

   So NeuroNet offers those two names rather than having every training
   file rewritten. Rewriting would also have broken the rule the isolation
   test enforces -- that training touches only its own training_* backend
   methods -- because it would have meant editing the very code the test
   exists to keep honest. This adapter is two references and nothing else:
   the same store, the same shared helpers, under the name training expects.
   bridge.js then adds CP.Training to it. */
window.CP = window.CP || {};
window.CP.Store = SS.Store;
window.CP.shared = SS.shared;
/* A photo thumbnail, remembered. CP.Store.thumb is the raw call and has
   to stay raw -- SS.Art puts its own pending promise under the key
   before it runs a fetcher, so a fetcher that went back through the
   cache would await itself. This is the call-site version, and it is
   what the dashboard's widgets use: they draw the same photos the
   library has usually already fetched, so most of them cost nothing.
   Defined as a function rather than assigned here because thumbFor is
   declared much further down the file. */
window.CP.thumb = (storedName) => thumbFor(storedName);

/* ---- the Kitchen's own document ------------------------------------------

   Cam: "i now want the two apps merged together into one". cookery.js works
   on a shared `data` object the way it always has -- but that object is
   KinCrux's document (recipes, menus, shopping lists, books), not this app's
   photo library. So the Kitchen gets its own.

   The two stores stay separate on disk exactly as they are, which is why
   nothing had to be migrated for the merge. */
let kitchenDoc = null;
let kitchenLoaded = false;

async function loadKitchen() {
  if (kitchenLoaded) return kitchenDoc;
  const got = await SS.Store.call("kc_get_data", [], "The Kitchen");
  kitchenDoc = (got && !got.error) ? got : null;
  kitchenLoaded = true;
  return kitchenDoc;
}

/* A recipe book's printed document by id, for NeuroNet's reader (the desktop
   Bookshelf, 2026-10-02) -- the one the Kitchen's Print button opens. */
SS.KitchenBooks = {
  async document(id) {
    const doc = await loadKitchen();
    const b = doc && (doc.books || []).find((x) => x.id === id);
    if (!b || !SS.CookeryPrint) return null;
    return {title: b.name || "Recipe book", html: await SS.CookeryPrint.bookHtml(b, doc.recipes || []),
            printKind: "recipe-book"};
  },
};

async function saveKitchen() {
  if (!kitchenDoc) return;
  const res = await SS.Store.call("kc_save_data", [kitchenDoc], "Saving the Kitchen");
  if (res && res.error) toast(res.error, "error");
}

window.CK = {
  shared: {
    get data() { return kitchenDoc; },
    save: () => saveKitchen(),
    render: () => render(),
    go: (v) => SS.go(v),
    toast: (msg, kind) => toast(msg, kind === "ok" ? "good" : kind),
    confirm: (opts) => confirmDlg(opts),
    openDlg: (title, body, wide) => openDlg(title, body, wide),
    promptText: (title, label, initial) => promptText(title, label, initial),
    pickFromLibrary: (opts) => pickFromLibrary(opts),
    offerPrint: (el, label, run) => SS.Print.offer(el, label, run),
    withdrawPrint: (el) => SS.Print.withdraw(el),
    Store: SS.shared.Store,
  },
};

/* ------------------------------------------------------------- state --- */
let data = {photos: [], albums: [], photoTagList: [], folders: [],
            events: [], contacts: []};
let view = "all";            // all | album:<id> | folder:<id> | tag:<name> | starred | recent | untagged | settings
let query = "";
let selection = new Set();
let selecting = false;
let sortBy = "newest";
let tileSize = 172;
let libraryRoot = "";

const save = () => SS.Store.save(data);

/* ------------------------------------------------------------ toasts --- */
function toast(msg, kind) {
  const el = document.createElement("div");
  el.className = "toast" + (kind ? " toast-" + kind : "");
  el.textContent = msg;
  $("toasts").appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

/* `wide` and the exposed `row` both arrived with the cookery merge —
   Cheffo's dialogs use a wider sheet for the recipe builder and reach
   for the button row directly. Neither changes any existing caller. */
/** KinCrux's own photo picker.

    Cam: "when adding a photo to an exercise or recipe for example i want
    KinCruxs in built photo picker to appear, by default with no pre
    loaded images until i search."

    Two things follow from that sentence.

    NOTHING IS SHOWN UNTIL HE TYPES. Not "the most recent twenty" and not
    a spinner -- an empty state that says what to do. A library of a few
    thousand photos would otherwise decode a screenful of thumbnails
    every single time the dialog opens, for a picker where he already
    knows which photo he wants.

    AND IT SEARCHES THE LIBRARY, not the disk. Every photo KinCrux knows
    about is already in `data.photos`; the filesystem is not consulted at
    all, so typing is instant. That is also the point of the feature:
    photos come into KinCrux once, through the photo library, and every
    other module picks from what is there rather than opening its own
    file dialog and copying a second time.

    Resolves to {storedName, originalName, caption} or null if cancelled.
*/
const PICKER_LIMIT = 60;

function photoSearch(query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return [];
  const terms = q.split(/\s+/).filter(Boolean);
  const hay = (p) => [p.caption, p.originalName, p.notes, p.takenDate,
    ...(p.tags || [])].join(" ").toLowerCase();
  return (data.photos || [])
    .filter((p) => { const h = hay(p); return terms.every((t) => h.includes(t)); })
    .slice(0, PICKER_LIMIT);
}

/* ---- press-and-sweep selection ---------------------------------------------

   Cam: "a click and drag feature when in the select tool so i dont have to
   click every one individually, please also have this feature in photos when
   in select mode."

   Press on an item and move across others: everything from the item pressed
   to the item under the pointer, in the order they are laid out, takes the
   state the first item took -- so a sweep that started by selecting selects,
   and one that started by clearing clears. It is a RANGE, recomputed from a
   snapshot on every move, so a fast flick can never skip items and moving
   back un-sweeps what was passed. Near the top or bottom of the scrolling
   list it scrolls. A press without a move is an ordinary click.

   opts: item (selector), key(el), has(key), set(key, on), paint(el, on),
         done() once the sweep ends, canStart(el, event) -> false to leave
         the press to someone else (Photos: dragging selected photos onto an
         album), scroller (the element that scrolls; default: nearest). */
function sweepSelect(container, options) {
  if (!container) return;
  /* Wired once per element; wiring it again only swaps the options, so a
     list that is repainted in place keeps one set of listeners. */
  container._sweepOpts = options;
  if (container.dataset.sweep === "1") return;
  container.dataset.sweep = "1";
  const opts = new Proxy({}, {get: (t, k) => (container._sweepOpts || {})[k]});
  let run = null;          // {anchor, mode, before: Map, items, last}
  let scrollTimer = null;
  let lastY = 0;

  const items = () => [...container.querySelectorAll(opts.item)];
  const scrollerOf = () => opts.scroller
    || (function find(el) {
      for (let n = el; n && n !== document.body; n = n.parentElement) {
        const st = getComputedStyle(n);
        if (/(auto|scroll)/.test(st.overflowY) && n.scrollHeight > n.clientHeight) return n;
      }
      return document.scrollingElement;
    })(container);

  function apply(toIdx) {
    const list = run.items;
    const lo = Math.min(run.anchor, toIdx), hi = Math.max(run.anchor, toIdx);
    list.forEach((el, i) => {
      const key = opts.key(el);
      const want = i >= lo && i <= hi ? run.mode : run.before.get(key);
      if (opts.has(key) !== want) { opts.set(key, want); opts.paint(el, want); }
    });
    run.last = toIdx;
  }

  function itemAt(x, y) {
    const el = document.elementFromPoint(x, y);
    const it = el && el.closest(opts.item);
    return it && container.contains(it) ? run.items.indexOf(it) : -1;
  }

  function onDown(e) {
    if (e.button !== 0) return;
    const it = e.target.closest(opts.item);
    if (!it || !container.contains(it)) return;
    if (opts.canStart && opts.canStart(it, e) === false) return;
    e.preventDefault();                                  // no text selection
    const list = items();
    const before = new Map(list.map((el) => [opts.key(el), opts.has(opts.key(el))]));
    const key = opts.key(it);
    run = {anchor: list.indexOf(it), mode: !opts.has(key), before, items: list, last: -1};
    apply(run.anchor);
    document.body.classList.add("ss-sweeping");
    lastY = e.clientY;
    scrollTimer = setInterval(autoScroll, 30);
  }

  let onMove = function (e) {
    if (!run) return;
    lastY = e.clientY;
    const i = itemAt(e.clientX, e.clientY);
    if (i >= 0 && i !== run.last) apply(i);
  };

  function autoScroll() {
    if (!run) return;
    const sc = scrollerOf();
    if (!sc) return;
    const box = sc === document.scrollingElement
      ? {top: 0, bottom: window.innerHeight} : sc.getBoundingClientRect();
    const edge = 36;
    let dy = 0;
    if (lastY < box.top + edge) dy = -Math.ceil((box.top + edge - lastY) / 3);
    else if (lastY > box.bottom - edge) dy = Math.ceil((lastY - (box.bottom - edge)) / 3);
    if (dy) sc.scrollTop += Math.max(-24, Math.min(24, dy));
  }

  let onUp = function () {
    if (!run) return;
    run = null;
    clearInterval(scrollTimer);
    document.body.classList.remove("ss-sweeping");
    if (opts.done) opts.done();
  };

  /* A list that has been rebuilt away takes its own listener with it; the
     two on the document drop themselves the next time they fire. */
  const gone = () => {
    if (document.contains(container)) return false;
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
    clearInterval(scrollTimer);
    return true;
  };
  const move = onMove, up = onUp;
  onMove = (e) => { if (!gone()) move(e); };
  onUp = (e) => { if (!gone()) up(e); };
  /* (the performance audit, 3 Nov) ...and any older lists already rebuilt away let go now, not at the next mouse move: a
     NeuroNet left on Photos without the mouse over it kept every visit's grid */
  const sweeps = SS.shared._sweeps || (SS.shared._sweeps = new Set());
  sweeps.forEach((g) => { if (g()) sweeps.delete(g); });
  sweeps.add(gone);
  container.addEventListener("mousedown", onDown);
  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);
}

/** A picture into the photo library, in a top-level folder of its own and
    tagged (made if need be): `path` (a file, copied in) or `dataUrl`. The
    capture key uses it ("Captures"), and Media's covers ("Covers", 2026-10-02:
    Cam, "the handling of images should be with in built photos app").
    -> {ok, storedName} or {error}. */
async function addToPhotos({path, dataUrl, folder, tag, caption} = {}) {
  const stored = path ? await SS.Store.storePhoto(path)
    : await SS.Store.call("photo_store_data_url", [dataUrl], "Saving the picture");
  if (!stored || stored.error) return stored || {error: "The picture couldn't be stored."};
  let folderId = "";
  if (folder) {
    let f = data.folders.find((x) => x.name === folder && !x.parentId);
    if (!f) { f = {id: newId(), name: folder, parentId: ""}; data.folders.push(f); }
    folderId = f.id;
  }
  if (tag && !data.photoTagList.includes(tag)) data.photoTagList.push(tag);
  const photo = blankPhoto({
    storedName: stored.storedName, originalName: stored.originalName,
    takenDate: stored.takenDate || "", caption: String(caption || ""),
    tags: tag ? [tag] : [], albumIds: [], folderId,
  });
  data.photos.push(photo);
  await nameFileAfterCaption(photo);
  await save();
  /* Only redraw when Photos is on screen: adding in the background must
     never tear down what Cam is working in (see addPhotoFromDataUrl). */
  if (sectionOf(view) === "photos") render();
  return {ok: true, storedName: photo.storedName};
}

/* ---------------------------------------------------------------- snips ---
   Cam (15 Nov 2026): "implement a snip feature that lives within NeuroNet ...
   the snips get stored in the in app photo viewer in a folder called neuronet
   snips. Also saved to a new folder that lives in Documents ... YYMMDD - Snip
   # ... the snip feature should have a save as which will automatically have
   the naming convention above but also an extra piece for example 261115 -
   Snip 22 - (Definition)."
   neuronet-snip takes the picture (Omarchy's omasnap) and names the file in
   Documents (snips.py); these keep the copy in Photos in step with it: the
   folder "NeuroNet Snips" (and its "Archive" inside), tagged Snip, captioned
   with the snip's name, the number kept on the photo as `snip`. */
const SNIP_FOLDER = "NeuroNet Snips";
function snipFolder(archived) {
  let top = data.folders.find((f) => f.name === SNIP_FOLDER && !f.parentId);
  if (!top) { top = {id: newId(), name: SNIP_FOLDER, parentId: ""}; data.folders.push(top); }
  if (!archived) return top;
  let arc = data.folders.find((f) => f.name === "Archive" && f.parentId === top.id);
  if (!arc) { arc = {id: newId(), name: "Archive", parentId: top.id}; data.folders.push(arc); }
  return arc;
}
const snipPhoto = (n) => data.photos.find((p) => p.snip === +n);

/** Save as: "261115 - Snip 22 - (" what Cam types ")". */
async function snipSaveAs(n) {
  const info = await SS.Store.call("snip_info", [+n], "");
  if (!info || !info.ok) { toast((info && info.error) || "That snip couldn't be found.", "error"); return; }
  const p = snipPhoto(n);
  const head = `${info.day} - Snip ${info.n}`;
  const d = openDlg("Save snip as", `
    <div class="snip-save">
      ${p ? `<div class="snip-prev" id="snip-prev"></div>` : ""}
      <label class="label" for="snip-def">Name</label>
      <div class="snip-name"><span class="snip-fixed">${esc(head)} - (</span><input class="input" id="snip-def"
        maxlength="80" autocomplete="off" placeholder="For Q22, New numbers feature…" value="${escA(info.definition)}"><span class="snip-fixed">)</span></div>
      <p class="stamp" id="snip-file"></p>
    </div>`);
  const inp = d.body.querySelector("#snip-def");
  const file = d.body.querySelector("#snip-file");
  const show = () => {
    const t = inp.value.replace(/[\x00-\x1f/\\()]+/g, " ").replace(/\s+/g, " ").trim();
    file.textContent = `${head}${t ? ` - (${t})` : ""}.png`;
  };
  show();
  inp.addEventListener("input", show);
  if (p) thumbFor(p.storedName).then((url) => {
    const box = d.body.querySelector("#snip-prev");
    if (url && box) box.innerHTML = `<img alt="" src="${escA(url)}">`;
  });
  const go = async () => {
    const r = await SS.Store.call("snip_rename", [+n, inp.value], "Saving the snip");
    if (!r || r.error) { toast((r && r.error) || "The snip couldn't be renamed.", "error"); return; }
    d.close();
    const ph = snipPhoto(n);
    if (ph && ph.caption !== r.name) {
      const moved = await renamePhotoEverywhere(ph, r.name);
      if (moved && moved.error) toast(moved.error, "error");
      await save();
      if (sectionOf(view) === "photos") render();
    }
    toast(`Saved as ${r.name}.`, "good");
  };
  d.btn("Keep this name", "btn-quiet", d.close);
  d.btn("Save", "btn-primary", go);
  inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); go(); } });
  setTimeout(() => inp.focus(), 50);
}

/* The Snip button in the top bar: a click is Omarchy's smart capture (drag a
   box, click a window, or click empty space for the screen); a right-click
   offers the other ways in. */
const SNIP_MODES = [["smart", "Smart"], ["region", "Region"], ["windows", "Window"],
  ["fullscreen", "Full screen"], ["scroll", "Scrolling"]];
async function takeSnip(mode) {
  const r = await SS.Store.call("snip_take", [mode || "smart"], "");
  if (r && r.error) toast(r.error, "error");
}
function snipMenu(btn) {
  const old = document.querySelector(".snip-menu");
  if (old) { old.remove(); return; }
  const m = document.createElement("div");
  m.className = "snip-menu";
  m.setAttribute("role", "menu");
  m.innerHTML = SNIP_MODES.map(([k, l]) => `<button type="button" role="menuitem" data-snip-mode="${k}">${esc(l)}</button>`).join("");
  const r = btn.getBoundingClientRect();
  m.style.top = `${Math.round(r.bottom + 6)}px`;
  m.style.right = `${Math.max(8, Math.round(window.innerWidth - r.right))}px`;
  document.body.appendChild(m);
  const close = (e) => { if (!e || !m.contains(e.target)) { m.remove(); document.removeEventListener("pointerdown", close, true); } };
  setTimeout(() => document.addEventListener("pointerdown", close, true), 0);
  m.querySelectorAll("[data-snip-mode]").forEach((b) => b.onclick = () => { close(); takeSnip(b.dataset.snipMode); });
}

function pickFromLibrary(opts) {
  const options = opts || {};
  return new Promise((resolve) => {
    const dlg = openDlg(options.title || "Choose a photo", `
      <div class="pick-search">
        <input class="input" id="pick-q" type="search" autocomplete="off"
               placeholder="Search your photos\u2026" aria-label="Search your photos">
      </div>
      <div class="pick-grid" id="pick-grid"></div>
      <p class="stamp" id="pick-note" style="margin:10px 0 0"></p>`, true);

    let chosen = null;
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      dlg.close();
      resolve(value || null);
    };

    const grid = dlg.body.querySelector("#pick-grid");
    const note = dlg.body.querySelector("#pick-note");
    const input = dlg.body.querySelector("#pick-q");

    const paint = (results, typed) => {
      chosen = null;
      useBtn.disabled = true;
      if (!typed) {
        grid.innerHTML = "";
        note.textContent = (data.photos || []).length
          ? `Type to search your ${data.photos.length} photos.`
          : "There are no photos in NeuroNet yet. Add some to the photo "
            + "library first, then they will show up here.";
        return;
      }
      if (!results.length) {
        grid.innerHTML = "";
        note.textContent = "Nothing matches that.";
        return;
      }
      note.textContent = results.length === PICKER_LIMIT
        ? `First ${PICKER_LIMIT} matches \u2014 keep typing to narrow it.`
        : `${results.length} match${results.length === 1 ? "" : "es"}.`;
      grid.innerHTML = results.map((p) => `
        <button class="pick-tile" data-stored="${escA(p.storedName)}"
                title="${escA(nameOf(p))}">
          <span class="pick-thumb"></span>
          <span class="pick-name">${esc(nameOf(p))}</span>
        </button>`).join("");

      grid.querySelectorAll(".pick-tile").forEach((tile, i) => {
        const photo = results[i];
        /* the same cached, batched loader the library uses, so opening
           the picker twice on the same search costs nothing */
        thumbFor(photo.storedName).then((url) => {
          if (!url) return;
          const slot = tile.querySelector(".pick-thumb");
          if (slot) slot.style.backgroundImage = `url("${url}")`;
        }).catch(() => {});

        tile.onclick = () => {
          chosen = photo;
          grid.querySelectorAll(".pick-tile").forEach((t) =>
            t.classList.toggle("on", t === tile));
          useBtn.disabled = false;
        };
        tile.ondblclick = () => finish(photo);
      });
    };

    let timer = null;
    input.addEventListener("input", () => {
      clearTimeout(timer);
      /* a short pause so a fast typist does not repaint per keystroke */
      timer = setTimeout(() => {
        const typed = input.value.trim();
        paint(photoSearch(typed), !!typed);
      }, 120);
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && chosen) { e.preventDefault(); finish(chosen); }
    });

    dlg.btn("Cancel", "btn-quiet", () => finish(null));
    const useBtn = dlg.btn("Use this photo", "btn-primary", () => finish(chosen));
    useBtn.disabled = true;

    paint([], false);
    setTimeout(() => input.focus(), 30);
  });
}

function openDlg(title, body, wide) {
  const veil = $("modal-veil");
  veil.innerHTML = `<div class="modal${wide ? " modal-wide" : ""}">
    <h3>${esc(title)}</h3>
    <div class="dlg-body"></div><div class="dlg-row"></div></div>`;
  veil.querySelector(".dlg-body").innerHTML = body;
  const close = () => { veil.classList.remove("open"); veil.innerHTML = ""; };
  veil.onclick = (e) => { if (e.target === veil) close(); };
  veil.classList.add("open");
  return {
    body: veil.querySelector(".dlg-body"),
    row: veil.querySelector(".dlg-row"), close,
    btn(label, cls, fn) {
      const b = document.createElement("button");
      b.className = "btn " + cls; b.textContent = label; b.onclick = fn;
      veil.querySelector(".dlg-row").appendChild(b);
      return b;
    },
  };
}

/* Enter answers the box on top. Cam (2026-10-02): "When pressing delete on a
   fleeting note in the vault main section, i want the ability to be able to
   press enter and have it confirm. At the moment it just actions the enter
   button press in the background part of the app and not the confirmation
   box, this is the same in tools where i add media and other things etc."
   Every module has its own boxes (an open veil holding a .modal, openDlg's
   row of buttons, Training's sheet), so this listens on the WINDOW, in the
   capture phase -- ahead of every page's own Enter key -- and while a box is
   up, Enter is the box's: its main button, or the button that has focus. A
   text area keeps Enter for a new line. */
const BOX_SEL = ".open > .modal, .sheet-host:not([hidden]) .sheet";
const MAIN_SEL = '[data-act="yes"], [data-a="yes"], .btn-primary, .btn-save, .btn-danger, .primary-btn';
function shownBox() {
  const shown = (el) => !el.closest("[hidden]") && getComputedStyle(el).display !== "none";
  const boxes = [...document.querySelectorAll(BOX_SEL)].filter(shown);
  if (!boxes.length) return null;
  const z = (m) => parseInt(getComputedStyle(m.parentElement).zIndex, 10) || 0;
  // the one on top: the highest veil; level, the later one (a confirm opened over a box)
  return boxes.reduce((top, m) => (z(m) >= z(top) ? m : top));
}
function mainButtonOf(box) {
  const ok = (b) => b && !b.disabled && !b.closest("[hidden]") && getComputedStyle(b).display !== "none";
  const yes = box.querySelector('[data-act="yes"], [data-a="yes"]');
  if (ok(yes)) return yes;
  const all = [...box.querySelectorAll(MAIN_SEL)].filter(ok);
  return all.length ? all[all.length - 1] : null;   // the row's last: Save / Delete / Go ahead
}
function enterAnswersBox(e) {
  if (e.key !== "Enter" || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey || e.isComposing) return;
  const box = shownBox();
  if (!box) return;
  const t = e.target;
  const inBox = !!(t && t.nodeType === 1 && box.contains(t));
  if (inBox && (t.tagName === "TEXTAREA" || t.isContentEditable)) return;
  if (inBox && t.tagName !== "BUTTON") {
    // A field in the box: its own Enter first (Add a type, a tag, a search),
    // then -- if it had none -- the main button. Caught on the box on the way
    // up, so the page behind never gets it either way.
    const onBox = (ev) => {
      if (ev !== e) return;
      box.removeEventListener("keydown", onBox);
      ev.stopPropagation();
      if (ev.defaultPrevented) return;
      ev.preventDefault();
      const b = mainButtonOf(box);
      if (b) b.click();
    };
    box.addEventListener("keydown", onBox);
    setTimeout(() => box.removeEventListener("keydown", onBox), 0);
    return;
  }
  const b = inBox ? t : mainButtonOf(box);
  e.preventDefault();
  e.stopImmediatePropagation();
  if (b) b.click();
}
window.addEventListener("keydown", enterAnswersBox, true);

/* `fine` is a second, quieter line under the body — the consequence you
   want stated but not shouted. Came across with the cookery merge and
   is worth having everywhere. */
function confirmDlg({title, body, fine = "", yes = "Yes"}) {
  return new Promise((resolve) => {
    const veil = $("confirm-veil");
    veil.innerHTML = `<div class="modal" style="max-width:400px">
      <h3>${esc(title)}</h3>
      <p class="stamp" style="margin:0 0 4px;line-height:1.6">${esc(body)}</p>
      ${fine ? `<p class="stamp" style="margin:0 0 4px;line-height:1.6;
        color:var(--faint)">${esc(fine)}</p>` : ""}
      <div class="dlg-row">
        <button class="btn btn-quiet" data-a="no">Cancel</button>
        <button class="btn btn-danger" data-a="yes">${esc(yes)}</button>
      </div></div>`;
    const done = (v) => { veil.classList.remove("open"); veil.innerHTML = ""; resolve(v); };
    veil.querySelector('[data-a="no"]').onclick = () => done(false);
    veil.querySelector('[data-a="yes"]').onclick = () => done(true);
    veil.onclick = (e) => { if (e.target === veil) done(false); };
    veil.classList.add("open");
  });
}

function promptText(title, label, initial = "") {
  return new Promise((resolve) => {
    const d = openDlg(title, `<label class="label">${esc(label)}</label>
      <input class="input" id="pt-in" style="width:100%" value="${escA(initial)}">`);
    d.btn("Cancel", "btn-quiet", () => { d.close(); resolve(null); });
    d.btn("Save", "btn-primary", () => {
      const v = d.body.querySelector("#pt-in").value; d.close(); resolve(v);
    });
    setTimeout(() => d.body.querySelector("#pt-in").focus(), 50);
  });
}

/* ---------------------------------------------------------- querying --- */
/** The photo a view is showing, before search is applied. */
function photosForView() {
  const all = data.photos;
  if (view === "all") return all;
  if (view === "starred") return all.filter((p) => (p.rating || 0) > 0);
  if (view === "untagged") {
    return all.filter((p) => !(p.tags || []).length
      && !(p.albumIds || []).length && !p.folderId);
  }
  if (view === "recent") {
    return [...all].sort((a, b) =>
      (b.created || "").localeCompare(a.created || "")).slice(0, 60);
  }
  if (view.startsWith("album:")) {
    const id = view.slice(6);
    return all.filter((p) => (p.albumIds || []).includes(id));
  }
  if (view.startsWith("folder:")) {
    const id = view.slice(7);
    /* a folder shows its sub-folders' photos too — otherwise nesting
       would hide things rather than organise them */
    const ids = new Set([id, ...descendantFolderIds(id)]);
    return all.filter((p) => ids.has(p.folderId));
  }
  if (view.startsWith("tag:")) {
    const t = view.slice(4);
    return all.filter((p) => (p.tags || []).includes(t));
  }
  return all;
}

function descendantFolderIds(id) {
  const out = [];
  const walk = (parent) => {
    for (const f of data.folders) {
      if (f.parentId === parent) { out.push(f.id); walk(f.id); }
    }
  };
  walk(id);
  return out;
}

/** Search across everything worth searching: name, caption, tags,
    album names, folder name and notes. A search that only looked at
    filenames would be nearly useless on a library of uuid filenames. */
function matchesQuery(p, q) {
  if (!q) return true;
  const albumNames = (p.albumIds || [])
    .map((id) => (data.albums.find((a) => a.id === id) || {}).name || "");
  const folder = data.folders.find((f) => f.id === p.folderId);
  const hay = [
    p.caption, p.originalName, p.notes, p.takenDate,
    ...(p.tags || []), ...albumNames, folder ? folder.name : "",
  ].join(" ").toLowerCase();
  /* every word must match somewhere — so "beach 2019" finds a beach
     photo from 2019 rather than everything with either word */
  return q.toLowerCase().split(/\s+/).filter(Boolean)
    .every((word) => hay.includes(word));
}

function currentPhotos() {
  const list = photosForView().filter((p) => matchesQuery(p, query));
  const sorters = {
    newest: (a, b) => (dateOf(b)).localeCompare(dateOf(a)),
    oldest: (a, b) => (dateOf(a)).localeCompare(dateOf(b)),
    name: (a, b) => nameOf(a).localeCompare(nameOf(b)),
    rating: (a, b) => (b.rating || 0) - (a.rating || 0),
  };
  return [...list].sort(sorters[sortBy] || sorters.newest);
}

const dateOf = (p) => p.takenDate || (p.created || "").slice(0, 10) || "";
const nameOf = (p) => p.caption || p.originalName || "";

/** Renames a photo's FILE and carries every reference to it.

    Cam: "when renaming a photo within KinCrux i want it to change the
    photo name in the stored location."

    The stored name is not just a filename, it is the identifier every
    other part of the app uses to point at this photo -- a recipe's
    images, an album's cover. Move the file without moving the pointers
    and the photo is still there while everything that used it shows a
    gap.

    So the order matters: rename on disk FIRST, and only update the
    document if that succeeded. The other way round leaves the document
    pointing at a name that does not exist, which is the one state that
    cannot be recovered by trying again. */
/** Every place outside the photo index that names a photo by its file:
    the Kitchen's own photos and recipe pictures (held here, in kitchenDoc,
    and saved from it) -- then the files no page holds (Media's covers, the
    boards: photo_refs_rename). Found by a scan of Cam's data, 2026-10-02:
    nothing else refers to a library photo by name (Training, Divination,
    Puzzles and the Journal keep copies of their own). */
async function renameRefsElsewhere(map, kitchenDirty) {
  const keys = Object.keys(map);
  if (!keys.length) return;
  const kd = await loadKitchen();
  let dirty = !!kitchenDirty;
  if (kd) {
    for (const ph of kd.photos || []) if (map[ph.storedName]) { ph.storedName = map[ph.storedName]; dirty = true; }
    for (const r of kd.recipes || []) {
      for (const im of r.images || []) {
        if (map[im.storedName]) {
          if (im.originalName === im.storedName) im.originalName = map[im.storedName];
          im.storedName = map[im.storedName]; dirty = true;
        }
      }
    }
  }
  if (dirty) await saveKitchen();
  await SS.Store.call("photo_refs_rename", [map], "");
}

async function renamePhotoEverywhere(photo, newName, opts) {
  const batch = opts && opts.batch;          // the one-off naming: refs done once, at the end
  const from = photo.storedName;
  const res = await SS.Store.renamePhoto(from, newName);
  if (!res || res.error) return res || {error: "Couldn't rename that photo."};

  const to = res.storedName;
  photo.caption = newName;
  if (to && to !== from) {
    photo.storedName = to;
    photo.originalName = res.originalName || to;

    /* Recipes live in their own file now, but the interface holds them
       in the same document, so one save covers both. */
    for (const recipe of data.recipes || []) {
      for (const image of recipe.images || []) {
        if (image.storedName === from) {
          image.storedName = to;
          if (image.originalName === from) image.originalName = to;
        }
      }
    }
    /* the art cache is keyed by stored name; the old key now points at a
       file that is not there. forgetPrefix rather than forget, because a
       picture is cached once per size it has been drawn at, and the
       renamed file must not leave any of them behind. */
    SS.Art.forgetPrefix(from);
    if (typeof invalidateThumb === "function") invalidateThumb(from);
    if (!batch) await renameRefsElsewhere({[from]: to});
  }
  return res;
}

/* Photos named when they come in (a cover, a capture) get the file name too. */
async function nameFileAfterCaption(photo) {
  const name = String(photo.caption || "").trim();
  if (!name) return;
  try { await renamePhotoEverywhere(photo, name); } catch (e) { /* the photo is in; its file just keeps its first name */ }
}

/** Once (2026-10-02): every photo with a name gets a file of that name.
    Run by the page, which holds the photo index and the Kitchen, so nothing
    in memory can save the old names back over the new. A backup of every
    file that names photos is taken first, and the old -> new list kept
    beside it (neuronet_data/backups/photo-names-*). Saved every 50, so a
    stop part-way leaves every reference matching the files. */
async function namePhotoFilesOnce(prefs) {
  if (!prefs || prefs.photoFilesNamed) return;
  const todo = (data.photos || []).filter((p) => String(p.caption || "").trim());
  if (!todo.length) { await SS.Store.setPrefs({photoFilesNamed: new Date().toISOString()}); return; }
  const b = await SS.Store.call("photo_names_backup", [], "");
  if (!b || !b.ok) return;                   // no backup, no renaming
  const all = {};
  let batch = {};
  const flush = async () => {
    if (!Object.keys(batch).length) return;
    await save();
    await renameRefsElsewhere(batch);
    Object.assign(all, batch);
    batch = {};
    await SS.Store.call("photo_names_backup", [all], "");
  };
  for (const p of todo) {
    const from = p.storedName;
    const res = await renamePhotoEverywhere(p, String(p.caption).trim(), {batch: true});
    if (res && !res.error && res.storedName && res.storedName !== from) batch[from] = res.storedName;
    if (Object.keys(batch).length >= 50) await flush();
  }
  await flush();
  await SS.Store.setPrefs({photoFilesNamed: new Date().toISOString()});
  if (Object.keys(all).length && sectionOf(view) === "photos") render();
}

/* ------------------------------------------------------------- render --- */
const VIEW_TITLES = {
  all: "All photos", starred: "Starred", recent: "Recently added",
  untagged: "Unfiled", settings: "Settings",
};

function viewTitle() {
  if (view.startsWith("album:")) {
    const a = data.albums.find((x) => x.id === view.slice(6));
    return a ? a.name : "Album";
  }
  if (view.startsWith("folder:")) {
    const f = data.folders.find((x) => x.id === view.slice(7));
    return f ? f.name : "Folder";
  }
  if (view.startsWith("tag:")) return "#" + view.slice(4);
  return VIEW_TITLES[view] || "Photos";
}

/* Views that have moved. Personal Effects became Stuff → Media; a saved
   view, a favourite or a link to the old place lands on the new one. */
/* Divination → Readings became the Journal (Cam: "remove the readings sub
   section from divination ... have the entry save to journal"), which then
   moved from Notes to Mindfulness in place of Thought Journal (Cam: "fully
   migrate the journal to live in mindfullness, change the name from thought
   journal to just be journal"). */
const MOVED_VIEWS = {"div:readings": "mind:journal",
                     "journal:list": "mind:journal",
                     /* Music, Media, the Shelf and Cinema went to NeuroStream (19 Nov 2026, V31, Cam:
                        "remove them from Neuronet completely"): an old link or a saved place lands on M&T's
                        Inventories */
                     "home:effects": "stuff:inventories", "stuff:media": "stuff:inventories",
                     "stuff:shelf": "stuff:inventories", "stuff:cinema": "stuff:inventories",
                     "music:library": "stuff:inventories", "music:albums": "stuff:inventories",
                     "music:playlists": "stuff:inventories", "music:visualizer": "stuff:inventories"};

function render() {
  if (MOVED_VIEWS[view]) view = MOVED_VIEWS[view];
  /* left on a Scribe page before Scribe went to NeuroScribe: NeuroNet opens on its first section instead */
  if (sectionOf(view) === "notes" && !sectionOn("notes")) {
    const first = orderedSections().find((k) => k !== "notes" && sectionOn(k));
    const next = first && firstViewOf(first);
    if (next) { view = next; SS.Store.setPrefs({view}); }
  }
  /* Multitask: the view belongs to the ACTIVE side, and only that side is
     drawn -- the other side is never touched by navigation on this one. */
  if (MT.on) { renderMultitask(); return; }
  renderSidebar();
  renderInto($("ss-main"), null);
}

/** One view, drawn into one host. `pane` is null for the ordinary single
    workspace, or the Multitask side being drawn -- in which case only the
    shells inside THAT side are put away, and the other side's stay up. */
function renderInto(main, pane) {

  /* A ported module may bring its own chrome -- a whole shell that
     lives in the page permanently and is shown rather than rendered
     into the page area. Exactly one may ever be visible, so every one
     of them is put away HERE, BEFORE any view is dispatched, and
     whichever is being opened shows itself again.

     Before, not among. In KinCrux this sat lower down and was skipped
     by every view that returned early, which left one module's shell on
     screen with the page area hidden underneath it. Keeping it in the
     host also means a module added later cannot forget the others. */
  /* Every ported shell, found rather than listed.

     This was a hand-written array of ids, and the fourth module was
     added without anyone remembering to put it in -- so Chords' shell
     never got hidden and sat beside whatever you navigated to, in a
     split screen. A list you have to remember to update is a list that
     will be wrong. The id convention IS the contract now. */
  (pane ? pane.el : document).querySelectorAll(pane ? MT_SHELLS : '[id$="-shell"]')
    .forEach((el) => { el.hidden = true; });

  /* Which section is open, for the page's own styles: the app-wide bar's
     playlist-panel button only shows in the music section. */
  const appEl = document.getElementById("ss-app");
  if (appEl) appEl.dataset.section = String(view).split(":")[0];

  /* Training's Lens is #cf-lens, which the "-shell" convention above does
     not catch -- so leaving Lens for any other screen left it drawn over
     whatever came next. Training's bridge has always offered unmount() for
     exactly this ("the host calls this when it navigates AWAY from a
     training view"), and nothing ever called it: not here, and not in
     KinCrux either, where the same leak almost certainly existed. Called
     only when leaving training, so moving between training's own screens
     does not hide and re-show its shell. */
  /* In Multitask a side unmounts only what IT had (renderPane), never a
     module that is up on the other side. */
  /* Ebooks is here so an open book saves its place before the page it is
     drawn on is handed to another screen. */
  for (const mod of pane ? [] : [window.CP && window.CP.Training, window.CP && window.CP.Notes,
                     window.CP && window.CP.Cookery, window.CP && window.CP.Money,
                     SS.Ebooks]) {
    if (mod && typeof mod.unmount === "function"
        && !String(view).startsWith(mod.PREFIX)) {
      mod.unmount();
    }
  }
  main.style.display = "";
  /* A screen whose content IS the workspace -- a spreadsheet, say -- asks
     for this and then manages its own scrolling inside the pane. Cleared on
     every render so no other screen can inherit it, the same discipline the
     open album page follows in music. */
  main.classList.remove("ss-main-fills");

  if (view === "settings" || view.startsWith("settings:")) {
    renderSettings(main, view.split(":")[1]);
    return;
  }

  /* Each merged module owns its own screen inside this element. The
     guard is the same for all of them: a module that failed to load
     must not take the whole app down with it -- NeuroNet should still
     be a photo library if the games file is missing. */
  for (const mod of routedModules()) {
    if (mod && mod.VIEWS.includes(view)) {
      /* The Kitchen works on a document of its own, fetched the first time
         one of its screens is opened -- not at startup, so an app that never
         visits the Kitchen never reads those files. */
      /* Home reads contacts and the calendar from KinCrux's document too, so
         it waits for the same load. */
      if ((mod === (window.CP && window.CP.Cookery) || mod === SS.Home) && !kitchenLoaded) {
        loadKitchen().then(() => {
          /* The side that asked, which may no longer be the active one. */
          if (pane) { renderPaneAt(MT.panes.indexOf(pane)); return; }
          if (["cookery", "home"].includes(sectionOf(view))) render();
        });
        main.innerHTML = `<p class="stamp">Opening\u2026</p>`;
        return;
      }
      mod.mount(main, view);
      return;
    }
  }

  /* A sidebar entry whose module has not been built or failed to load
     must SAY SO. Falling through to the photo library was the first
     behaviour here and it was wrong in the worst way: Cam clicked
     Games, saw his photos, and reasonably concluded the whole app was
     broken. A screen that admits what it is beats a screen that
     silently shows you something else. */
  if (view.includes(":") && !view.startsWith("album:")
      && !view.startsWith("folder:") && !view.startsWith("tag:")) {
    main.innerHTML = `
      <p class="page-h">${esc(viewTitle())}</p>
      <div class="panel" style="max-width:560px">
        <p class="stamp" style="line-height:1.7;margin:0">
          This part of NeuroNet isn't built yet. The sidebar entry is
          here so the shape of the app is visible while the modules are
          moved across one at a time \u2014 the photo library below it is
          finished and in use.</p>
      </div>`;
    return;
  }
  renderLibrary(main);
}

/* ============================================================ navigation

   TWO MENUS. Cam: "The UI will split into a 2 side navbar system. The left
   side containing all the main sections, the right navbar containing all the
   sub sections of that main section. For example Sessions is a sub section
   of Training." A bottom bar says where you are; F9 hides every bar.

   Both menus are drawn as cards in Cam's Collective's style -- a coloured
   stripe, an icon, a name. Compact by Cam's choice: Training alone has ten
   subsections, and at the dashboard's full card size, with its line of
   description, the right menu would scroll on every visit.

   The views themselves are untouched ("training:sessions" is still
   "training:sessions"), so every screen, shortcut and saved preference keeps
   working. Only the way they are reached has changed. */

const SECTION_ORDER = ["home", "stuff", "photos", "training", "music", "games",
                       "divination", "mind", "cookery", "money", "notes", "creative", "code", "guide"];
const SECTION_META = {
  /* Cam: "Change the current photos icon to be the current music icon." The
     old music icon is a framed picture -- it always read as photos. */
  photos: {icon: "i-album", accent: "#7bb26a", first: "all"},
  training: {icon: "i-stopwatch", accent: "#d8b23a"},
  /* Cam: "i want it to default to the stats page, then to access the
     puzzles i want to select from the sub section." Every puzzle is
     already its own subsection (addPuzzleSections), so landing on a grid
     of the same puzzles was a second menu in front of the first. */
  games: {icon: "i-grid", accent: "#8f7ad6", first: "games:stats"}, // Puzzles
  divination: {icon: "i-star", accent: "#c98ad6"},
  mind: {icon: "i-aperture", accent: "#4bb3a5"},
  home: {icon: "i-home", accent: "#6aa9e0"},
  /* Cam: "lets create a new main section called Stuff ... inventories,
     databases of all our media." A box, in cardboard. */
  stuff: {icon: "i-box", accent: "#c0915c", first: "stuff:inventories"},   // M&T
  cookery: {icon: "i-recipe", accent: "#e28a3f"},
  money: {icon: "i-target", accent: "#5f9ea0"},
  notes: {icon: "i-note-plus", accent: "#6aa9e0"},                     // Scribe
  /* Cam (2026-10-03): "lets create new main section called Creative - Scrap
     book, Boards, paper creator and assets can live in there (later a vector
     graphic tool and Pixel art tool in the future)". */
  creative: {icon: "i-creative", accent: "#e0789e", first: "scrapbook:shelf"},
  /* Cam: "intergrate Algorithm ... into NeuroNet under Code main section and
     be in IDE sub section". Algorithm's own indigo. */
  code: {icon: "i-code", accent: "#7c9cf5", first: "code:ide"},
  /* The Neuro Guide, in NeuroNet's own brand green (Stage 4, 2026-09-29). */
  guide: {icon: "i-neuron", accent: "#5FA665", first: "guide:start"},
  /* Reached by the gear, not the left menu, so this only supplies the
     colour its subsection cards are drawn in and where it opens. */
  settings: {icon: "i-settings", accent: "#9aa0a6", first: "settings:appearance"},
};
/* The icon each subsection has always had, kept so nothing changes look. */
const CHILD_ICONS = {
  "games:home": "i-grid", "games:books": "i-book",
  "games:stats": "i-clock", "div:tarot": "i-tarot", "div:oracle": "i-oracle",
  "div:lenormand": "i-lenormand", "div:runes": "i-runes", "div:iching": "i-book",
  "div:astrology": "i-astrology", "mind:meditation": "i-clock",
  "mind:breathwork": "i-aperture", "mind:journal": "i-pencil", "mind:gratitude": "i-star",
  "training:sessions": "i-session", "training:circuits": "i-circuit",
  "training:library": "i-library", "training:guides": "i-guide",
  "training:calendar": "i-calendar", "training:programs": "i-program", "training:neurotrain": "i-program",
  "training:books": "i-book", "training:athletes": "i-people",
  "training:calculators": "i-calc", "training:lens": "i-search",
  "guide:start": "i-bulb", "guide:desktop": "i-home", "guide:omarchy": "i-grid",
  "guide:keys": "i-letters", "guide:sections": "i-neuron", "guide:help": "i-info",
  /* The seven that used to be pills. Collapsed, the icon IS the entry,
     so every one of these needs its own or it reads as a blank row. */
  "training:questionnaires": "i-form", "training:equipment": "i-kit",
  "training:documents": "i-file", "training:lessonPlans": "i-plan",
  "training:groups": "i-group", "training:settings": "i-settings",
  "training:backup": "i-backup",
  "notes:vault": "i-note-plus", "boards:list": "i-board", "scrapbook:shelf": "i-scrapbook", "cells:list": "i-cells",
  "paper:make": "i-paper", "assets:library": "i-assets", "pixel:studio": "i-pixel", "vector:studio": "i-vector",
  "fleeting:list": "i-clock", "collab:board": "i-people", "archive:list": "i-archive",
  "code:ide": "i-code", "code:guides": "i-guide", "code:research": "i-highlight",
  "code:structures": "i-structure", "code:web": "i-web",
  "home:dashboard": "i-grid", "home:calendar": "i-calendar", "home:contacts": "i-person",
  "stuff:inventories": "i-kit",
  "settings:appearance": "i-shade", "settings:size": "i-heading", "settings:lite": "i-bulb",
  "settings:sidebar": "i-menu", "settings:library": "i-folder",
  "settings:merge": "i-group", "settings:stats": "i-chart",
  "settings:transfer": "i-backup", "settings:datafolder": "i-move", "settings:widgets": "i-eye",
  "recipes": "i-recipe", "menus": "i-menu", "shopping": "i-cart",
  "books": "i-book", "calculators": "i-calc",
  "money:dashboard": "i-home", "money:period": "i-calendar", "money:fortnight": "i-clock",
  "money:templates": "i-repeat", "money:goals": "i-target", "money:calc": "i-calc", "money:compare": "i-chart", "money:books": "i-book",
};
const PHOTO_VIEWS = {all: "All photos", recent: "Recently added",
                     starred: "Starred", untagged: "Unfiled"};
/* Where each section was left, so coming back to Training returns to the
   screen Cam was on rather than always its first. */
let lastViewBySection = {};
/* The screens most recently shown, newest first -- so a Multitask side
   given a section whose usual screen is already on the other side opens the
   one Cam was using, not simply the first in the menu. */
let recentViews = [];

/** Add one subsection per puzzle, from the list Cranium already publishes.
    Called once the module has loaded; if it has not, the section simply
    keeps its three standing entries. */
/** A section whose subsections are only known at run time -- Stuff lists
    each inventory by name. The menus redraw; nothing on screen is re-rendered. */
SS.setSectionChildren = (key, kids) => {
  const s = SECTIONS.find((x) => x.key === key);
  if (!s || !Array.isArray(kids)) return;
  s.children = (s.lead || []).concat(kids).map((k) => ({...k}));
  if (!$("ss-nav")) return;
  renderSidebar();
  if (MT.on) MT.panes.forEach((p, i) => mtPaintSubnav(i));
};

/* Sessions and Programs moved to NeuroTrain, the training planner (Q19 q1, 10 Nov
   2026: "hide its Sessions and Programs and link to NeuroTrain"). Where NeuroTrain
   is installed the two subsections give way to one that opens it; everywhere
   else Training keeps them. Asked once, after the first page is drawn. The
   Calculators went the same way (Q20 q1, 13 Nov 2026): NeuroTrain's page has a
   button straight to its own. */
async function trainingToNeurotrain() {
  const api = window.pywebview && window.pywebview.api;
  if (!api || !api.training_neurotrain) return;
  let r = null;
  try { r = await api.training_neurotrain(); } catch (e) { return; }
  if (!r || !r.installed) return;
  const s = SECTIONS.find((x) => x.key === "training");
  if (!s || s.children.some((c) => c.key === "training:neurotrain")) return;
  const kids = s.children.filter((c) => c.key !== "training:sessions" && c.key !== "training:calculators")
    .map((c) => (c.key === "training:programs" ? {key: "training:neurotrain", name: "NeuroTrain"} : c));
  SS.setSectionChildren("training", kids);
  if (["training:sessions", "training:programs", "training:calculators"].includes(view)) { view = "training:neurotrain"; render(); }
}

function addPuzzleSections() {
  const mod = SS.Games;
  if (!mod || !mod.games) return;
  const section = SECTIONS.find((x) => x.key === "games");
  if (!section || section._puzzlesAdded) return;
  for (const g of mod.games) {
    /* Each puzzle brings its own icon; collapsed, the icon IS the entry. */
    section.children.push({key: "games:" + g.key, name: g.name, icon: g.icon});
  }
  section._puzzlesAdded = true;
}

const KITCHEN_VIEWS = new Set(["recipes", "add-recipe", "menus", "shopping",
                               "books", "calculators"]);

function sectionOf(v) {
  if (KITCHEN_VIEWS.has(String(v || ""))) return "cookery";
  v = String(v || "");
  /* "settings" on its own is what older prefs and the gear used to store;
     it lands on the first subsection rather than nowhere. */
  if (!v) return null;
  if (v === "settings" || v.startsWith("settings:")) return "settings";
  if (PHOTO_VIEWS[v] || /^(folder|album|tag):/.test(v)) return "photos";
  const prefix = v.split(":")[0];
  return {music: "stuff", games: "games", div: "divination", mind: "mind",
          training: "training", notes: "notes", boards: "creative", scrapbook: "creative",
          paper: "creative", assets: "creative", pixel: "creative", vector: "creative",
          cells: "notes", fleeting: "notes", guides: "notes", books: "notes",
          ebooks: "notes", collab: "notes", archive: "notes",
          money: "money", home: "home", stuff: "stuff", code: "code",
          guide: "guide"}[prefix] || null;
}

function sectionName(key) {
  if (key === "photos") return "Photos";
  const s = SECTIONS.find((x) => x.key === key);
  return s ? s.name : "";
}

function childrenOf(key) {
  if (key === "photos") return [];
  const s = SECTIONS.find((x) => x.key === key);
  return (s && s.children || []).filter((c) => sectionOn(c.key));
}

/* WHERE A SECTION OPENS.

   A section used to open on whichever subsection happened to be listed
   first, with Photos written in by name as the one exception. SECTION_META
   already had a `first` field saying where Photos should land -- it was
   simply never read, so the hardcoded line was doing the work and the
   field looked like it worked. Reading it is what lets Puzzles say where
   it opens without another name in here.

   Cam: "the puzzle Main section i want it to default to the stats page,
   then to access the puzzles i want to select from the sub section. At
   the moment it shows cards of all the puzzles when the puzzles main
   section is clicked on."

   The section is still free to be left somewhere else and come back to
   it -- lastViewBySection wins, as it does everywhere -- but that is
   remembered in memory only, so every launch opens on the default. */
function firstViewOf(key) {
  if (lastViewBySection[key]) return lastViewBySection[key];
  const kids = childrenOf(key);
  const wanted = (SECTION_META[key] || {}).first;
  /* Only if it is actually on. Hiding a subsection in Settings must not
     leave its section opening on a page that is not there. Photos is the
     exception it always was: its views are not children. */
  if (wanted && (key === "photos" || kids.some((c) => c.key === wanted))) {
    return wanted;
  }
  return kids.length ? kids[0].key : null;
}

function viewLabel(v) {
  if (v === "settings") return "Settings";
  if (v.startsWith("settings:")) return SET_SECTIONS[v.split(":")[1]] || "Settings";
  if (PHOTO_VIEWS[v]) return PHOTO_VIEWS[v];
  if (v.startsWith("album:")) {
    const a = data.albums.find((x) => "album:" + x.id === v);
    return a ? a.name : "Album";
  }
  if (v.startsWith("tag:")) return v.slice(4);
  if (v.startsWith("folder:")) {
    const f = data.folders.find((x) => "folder:" + x.id === v);
    return f ? f.name : "Folder";
  }
  const sec = SECTIONS.find((x) => (x.children || []).some((c) => c.key === v));
  const kid = sec && sec.children.find((c) => c.key === v);
  return kid ? kid.name : v;
}

/* ---- Cam's own order, and Cam's favourites -------------------------------

   Cam: "integrate a re-arrange feature where i can drag the main section and
   sub section icons to another place in the list" and "a favorite feature
   where i can favorite any sub section".

   Both live in prefs, so they survive a restart. An order only lists what Cam
   has actually moved: anything new the app gains later still appears, at its
   own place, instead of vanishing because an old saved list never heard of
   it. */
let navOrder = {sections: [], children: {}};
/* the sidebar's "More" group (see renderSidebar); Code and Neuro Guide until
   Cam chooses otherwise */
const MORE_DEFAULT = ["code", "guide"];
let moreSections = new Set(MORE_DEFAULT);
let moreOpen = false;
/** A main section into the sidebar's More, or out of it (Home always stays). */
async function setInMore(key, on) {
  if (key === "home" || !SECTION_META[key]) return;
  if (on) moreSections.add(key); else moreSections.delete(key);
  if (on) moreOpen = true;                 // show where it went
  await SS.Store.setPrefs({moreSections: [...moreSections]});
  render();
}
let favourites = [];

/** The saved order first, then anything it does not mention, in the order the
    app itself lists them. */
function inSavedOrder(keys, saved) {
  if (!Array.isArray(saved) || !saved.length) return keys;
  const out = saved.filter((k) => keys.includes(k));
  /* one the saved order has never seen (a new section, a new page) goes in
     after the one it follows in the usual order -- Creative after Scribe,
     not at the very bottom */
  keys.forEach((k, i) => {
    if (out.includes(k)) return;
    const before = keys.slice(0, i).reverse().find((x) => out.includes(x));
    out.splice(before ? out.indexOf(before) + 1 : 0, 0, k);
  });
  return out;
}

function orderedSections() {
  const live = SECTION_ORDER.filter((key) =>
    sectionOn(key) && (key === "photos" || childrenOf(key).length));
  return inSavedOrder(live, navOrder.sections);
}

function orderedChildren(section) {
  const kids = childrenOf(section);
  const order = inSavedOrder(kids.map((c) => c.key), (navOrder.children || {})[section]);
  return order.map((k) => kids.find((c) => c.key === k)).filter(Boolean);
}

const isFavourite = (viewKey) => favourites.includes(viewKey);

/* Home draws the favourites, so it needs to see them and to look one up. */
SS.favourites = () => [...favourites];
/* ...and a card for every app (main section) shown in the sidebar, in its
   order (Cam, 15 Nov 2026: "have all apps have their cards on the dashboard
   by default"). Home itself is the dashboard, so it isn't one of them. */
SS.appCards = () => orderedSections().filter((k) => k !== "home").map((k) => ({
  key: k, name: sectionName(k), icon: (SECTION_META[k] || {}).icon || "i-grid",
  accent: (SECTION_META[k] || {}).accent || "var(--accent)",
  pages: k === "photos" ? [] : orderedChildren(k).map((c) => c.name),
}));
SS.favouriteInfo = (viewKey) => favouriteInfo(viewKey);

async function toggleFavourite(viewKey) {
  favourites = isFavourite(viewKey)
    ? favourites.filter((v) => v !== viewKey)
    : [...favourites, viewKey];
  await SS.Store.setPrefs({favourites});
  render();
}

/** What a favourite is called, and which section it belongs to -- worked out
    from the menus themselves so a renamed subsection reads correctly. */
function favouriteInfo(viewKey) {
  for (const key of SECTION_ORDER) {
    for (const c of childrenOf(key)) {
      if (c.key === viewKey) {
        return {view: viewKey, name: c.name, section: key,
                sectionName: sectionName(key),
                icon: c.icon || CHILD_ICONS[c.key] || "i-grid",
                accent: (SECTION_META[key] || {}).accent || "var(--accent)"};
      }
    }
  }
  return null;
}

const navCard = (key, icon, label, accent, on, attr, extra) => `
  <button class="ss-card ss-nav-btn ${on ? "on" : ""}" ${attr}
          data-drag="${escA(key)}" title="${escA(label)} — hold the right mouse button to move"
          style="--card-accent:${accent}">
    <span class="ss-card-ic">${ic(icon)}</span><span>${esc(label)}</span>${extra || ""}
  </button>`;

/** The star on a subsection card. A button inside a button is not allowed,
    so it is a span that behaves like one. */
const favStar = (viewKey) => `
  <span class="ss-fav ${isFavourite(viewKey) ? "on" : ""}" role="button" tabindex="0"
        data-fav="${escA(viewKey)}"
        title="${isFavourite(viewKey) ? "Remove from Home" : "Add to Home"}"
        aria-label="${isFavourite(viewKey) ? "Remove from Home" : "Add to Home"}"
        aria-pressed="${isFavourite(viewKey)}">${isFavourite(viewKey) ? "\u2605" : "\u2606"}</span>`;

/* ---- dragging a card to a new place --------------------------------------

   Cam: "drag the main section and sub section icons to another place in the
   list to arrange their order." Then: "the current rearrange icons in both
   left and right side bar uses the left mouse when held. Lets change it to
   holding the right mouse button over an icon is used when rearranging this
   is to not mess up the clicking of the icon."

   So a card is moved with the RIGHT button held down, and the left button
   only ever opens it. Built from mousedown/mousemove/mouseup rather than
   HTML5 drag and drop, which starts only from the left button (and see the
   note below on why photos left it too). The app already turns off the
   right-click menu everywhere, so there is nothing for this to fight. The
   same drag drops a main section onto a Multitask side (mtWireDrop). */
let dragging = null;       // {key, from, card, x, y, moved} while the right button is held

/* WHY THIS IS NOT HTML5 DRAG AND DROP.

   Cam: "Bug found, i click hold and the cursor changes to hold it. But
   when i move off the photo it lets go."

   The first version used draggable="true" with dragstart/dragover/drop.
   That is the obvious way to do this on a web page, and it is the wrong
   way HERE. Measured with a real pointer -- an actual press, move and
   release, not synthesised events -- it worked in WebKitGTK 2.52 and in
   Chromium, both of which I can run. Cam launches with `--gui qt`, which
   is QtWebEngine, whose HTML5 drag support on Linux is patchy, and which
   I cannot install to test. A feature that depends on a browser feature
   only some renderers implement properly is broken for whoever has the
   wrong one, and no amount of testing in the other two finds it.

   What his description fits exactly: `cursor: grab` is a HOVER style, so
   the hand appears just from pointing at a photo. If the drag never
   starts, pressing and moving does nothing and the cursor goes back to
   normal on leaving the tile -- which is precisely "it lets go".

   So the drag is built out of mousedown, mousemove and mouseup, which
   every engine has had since the 1990s and none of them get wrong, plus
   a ghost element this file positions itself. Nothing here can be
   half-implemented by a renderer.

   IT ALSO FIXES A BUG THE HTML5 VERSION HAD IN EVERY ENGINE. dragenter
   and dragleave fire for every child element crossed, so moving over the
   album's icon or its label fired dragleave on the album and the
   highlight blinked off -- measured, the album was unlit at the moment of
   the drop even on a run that filed the photo correctly. The app's own
   file-import overlay already worked around that with a depth counter; a
   pointer drag has no such events to work around.

   THE THRESHOLD is what keeps a click a click. Nothing happens until the
   pointer has moved DRAG_SLOP pixels, so tapping a photo still opens it,
   and the click that follows a real drag is swallowed so the viewer does
   not open on top of the drop. */
const DRAG_SLOP = 5;
let photoDrag = null;      // the ids being carried, or null
let dragGhost = null;
let dragStart = null;      // {x, y, ids, tile} once the button is down
let dragMoved = false;     // has it passed the threshold

function photoDragIds(photoId) {
  /* Follows the selection: a photo that is part of it brings the whole
     selection, one that is not brings only itself. Dragging an unselected
     photo must never sweep up forty others Cam never pointed at. */
  return selection.has(photoId) ? [...selection] : [photoId];
}

/** The thing that follows the cursor. Shows the photo being carried, and
    a count when it is a pile of them. */
function makeGhost(tile, n) {
  const ghost = document.createElement("div");
  ghost.className = "ss-drag-ghost";
  const img = tile.querySelector("img");
  if (img && img.src) {
    const copy = document.createElement("img");
    copy.src = img.src;
    ghost.appendChild(copy);
  }
  if (n > 1) {
    const badge = document.createElement("span");
    badge.className = "ss-drag-count";
    badge.textContent = String(n);
    ghost.appendChild(badge);
  }
  document.body.appendChild(ghost);
  return ghost;
}

/** The album under the pointer, if any. The ghost is pointer-events:none
    in CSS, so it never hides what is beneath it. */
function albumUnder(x, y) {
  const el = document.elementFromPoint(x, y);
  const card = el && el.closest ? el.closest('[data-view^="album:"]') : null;
  return card && card.closest("#ss-subnav-body") ? card : null;
}

function paintDropTarget(card) {
  document.querySelectorAll(".ss-drop-album")
    .forEach((el) => { if (el !== card) el.classList.remove("ss-drop-album"); });
  if (card) card.classList.add("ss-drop-album");
}

function endPhotoDrag() {
  if (dragGhost) { dragGhost.remove(); dragGhost = null; }
  document.querySelectorAll(".tile.is-dragging")
    .forEach((t) => t.classList.remove("is-dragging"));
  paintDropTarget(null);
  document.body.classList.remove("ss-dragging-photo");
  photoDrag = null;
  dragStart = null;
}

/* One listener on the gallery, not one per photo (2026-10-06, the audit:
   "attach listeners once to the container"): 874 photos had 1,748 of them.
   Registered before sweepSelect's, so a press reaches both in the same
   order as when each tile had its own. */
function wirePhotoDrag(main) {
  const gallery = main.querySelector(".gallery");
  if (!gallery) return;
  gallery.addEventListener("mousedown", (e) => {
    const tile = e.target.closest("[data-photo]");
    if (!tile || !gallery.contains(tile)) return;
    if (e.button !== 0) return;              // left button only
    /* In select mode an unselected photo's press is a sweep, not a drag. */
    if (selecting && !selection.has(tile.dataset.photo)) return;
    dragStart = {x: e.clientX, y: e.clientY, tile,
                 ids: photoDragIds(tile.dataset.photo)};
  });
}

/** Wired once, on the document, because a drag continues over the menu,
    the bars and the empty page -- none of which the gallery owns. */
function wirePhotoDragGlobals() {
  /* EVERY press clears it, not just a press on a photo.

     dragMoved exists to swallow the click that a real drag leaves behind,
     so releasing over an album does not also open the photo viewer. It
     used to be cleared only in a tile's own mousedown, and a drag that
     ends on the ALBUM produces no click at all -- mousedown and mouseup
     were on different elements -- so the flag stayed true and ate the
     next click on anything that was not a photo. The Select button, a
     menu row, a folder: the first press after any drag did nothing.
     Cleared here, it can only ever swallow the click belonging to the
     press that set it. */
  document.addEventListener("mousedown", () => { dragMoved = false; }, true);

  document.addEventListener("mousemove", (e) => {
    if (!dragStart) return;
    if (!photoDrag) {
      const far = Math.abs(e.clientX - dragStart.x) > DRAG_SLOP
               || Math.abs(e.clientY - dragStart.y) > DRAG_SLOP;
      if (!far) return;                        // still a click, so far
      photoDrag = dragStart.ids;
      dragMoved = true;
      dragGhost = makeGhost(dragStart.tile, photoDrag.length);
      document.body.classList.add("ss-dragging-photo");
      for (const id of photoDrag) {
        const t = document.querySelector(`[data-photo="${CSS.escape(id)}"]`);
        if (t) t.classList.add("is-dragging");
      }
    }
    if (dragGhost) {
      dragGhost.style.left = e.clientX + "px";
      dragGhost.style.top = e.clientY + "px";
    }
    paintDropTarget(albumUnder(e.clientX, e.clientY));
    e.preventDefault();                        // no text selection while dragging
  });

  document.addEventListener("mouseup", async (e) => {
    if (!photoDrag) { dragStart = null; return; }
    const ids = photoDrag;                     // taken before any await
    const card = albumUnder(e.clientX, e.clientY);
    endPhotoDrag();
    if (!card) return;                         // dropped on nothing: no harm
    const got = await addToAlbum(ids, card.dataset.view.slice(6));
    if (got.added) { selection.clear(); render(); }
  });

  /* A drag that is given up on. Escape is the expected key, and a button
     released outside the window would otherwise leave the ghost stuck to
     the cursor forever. */
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && photoDrag) endPhotoDrag();
  });
  window.addEventListener("blur", () => { if (photoDrag) endPhotoDrag(); });

  /* The click that follows a real drag must not open the viewer on top of
     the photo that was just filed. Capture phase, so it is swallowed
     before the gallery's own handler sees it. */
  document.addEventListener("click", (e) => {
    if (!dragMoved) return;
    dragMoved = false;
    e.stopPropagation();
    e.preventDefault();
  }, true);
}

function wireDragOrder(container, onDrop, opts) {
  if (!container) return;
  /* The menus are redrawn on every render but the containers stay, so the
     press is listened for once and the latest onDrop is kept on them. */
  container._onNavDrop = onDrop;
  /* opts.left: the left button drags too, past a few pixels (the page tabs,
     Cam 15 Nov 2026: "hold click and drag to reorder the top horizontal
     buttons"; a press that doesn't move is still a click). opts.across: the
     cards run left to right, so a drop goes before or after by x. */
  container._dragOpts = opts || {};
  if (container.dataset.navDrag === "1") return;
  container.dataset.navDrag = "1";
  container.addEventListener("mousedown", (e) => {
    const left = e.button === 0 && container._dragOpts.left;
    if (e.button !== 2 && !left) return;              // right button (or left, where allowed)
    const card = e.target.closest("[data-drag]");
    if (!card || !container.contains(card)) return;
    if (e.target.closest("[data-fav]")) return;        // the star is a button of its own
    if (!left) e.preventDefault();
    dragging = {key: card.dataset.drag, from: container, card, button: e.button,
                x: e.clientX, y: e.clientY, moved: false};
  });
  wireNavDragGlobals();
}

let navGhost = null;
function clearNavMarks() {
  document.querySelectorAll(".drop-before, .drop-after")
    .forEach((el) => el.classList.remove("drop-before", "drop-after"));
  document.querySelectorAll(".is-drop").forEach((el) => el.classList.remove("is-drop"));
}
function endNavDrag() {
  if (dragging && dragging.card) dragging.card.classList.remove("is-dragging");
  if (navGhost) { navGhost.remove(); navGhost = null; }
  clearNavMarks();
  document.body.classList.remove("ss-nav-dragging");
  dragging = null;
}
/** Where a drop would land: {card, before} in the menu the drag began in,
    or {side} -- a Multitask side, for a main section. */
function navDropAt(x, y) {
  const el = document.elementFromPoint(x, y);
  if (!el || !dragging) return null;
  /* onto the sidebar's More (2026-10-06, Cam: "i want to be able to drag the
     apps into more section") */
  const moreBtn = el.closest("#ss-more");
  if (moreBtn && dragging.from === $("ss-nav")) return {more: moreBtn};
  const card = el.closest("[data-drag]");
  if (card && dragging.from.contains(card)) {
    const box = card.getBoundingClientRect();
    return {card, before: (dragging.from._dragOpts || {}).across
      ? x < box.left + box.width / 2 : y < box.top + box.height / 2};
  }
  const side = el.closest("[data-mt-drop]");
  if (side && MT.on && dragging.from === $("ss-nav")) return {side};
  return null;
}

let navDragWired = false;
function wireNavDragGlobals() {
  if (navDragWired) return;
  navDragWired = true;
  document.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    if (!(e.buttons & (dragging.button === 0 ? 1 : 2))) { endNavDrag(); return; }   // let go somewhere we never heard
    if (!dragging.moved) {
      if (Math.abs(e.clientX - dragging.x) <= DRAG_SLOP
          && Math.abs(e.clientY - dragging.y) <= DRAG_SLOP) return;
      dragging.moved = true;
      if (window.getSelection) window.getSelection().removeAllRanges();
      dragging.card.classList.add("is-dragging");
      document.body.classList.add("ss-nav-dragging");
      navGhost = dragging.card.cloneNode(true);
      navGhost.classList.add("ss-nav-ghost");
      navGhost.removeAttribute("id");
      navGhost.style.width = dragging.card.getBoundingClientRect().width + "px";
      ($("ss-app") || document.body).appendChild(navGhost);
    }
    navGhost.style.left = e.clientX + "px";
    navGhost.style.top = e.clientY + "px";
    clearNavMarks();
    const at = navDropAt(e.clientX, e.clientY);
    if (at && at.card && at.card !== dragging.card) {
      at.card.classList.add(at.before ? "drop-before" : "drop-after");
    } else if (at && at.side) {
      at.side.classList.add("is-drop");
    } else if (at && at.more) {
      at.more.classList.add("is-drop");
    }
    e.preventDefault();
  });
  document.addEventListener("mouseup", (e) => {
    if (!dragging || e.button !== dragging.button) return;
    const d = dragging;
    const at = d.moved ? navDropAt(e.clientX, e.clientY) : null;
    endNavDrag();
    /* a left-button drag ends in a click on the tab: that click must not
       also open the page */
    if (d.moved && d.button === 0) {
      const swallow = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
      document.addEventListener("click", swallow, {capture: true, once: true});
      setTimeout(() => document.removeEventListener("click", swallow, {capture: true}), 0);
    }
    if (!at) return;
    if (at.side) {
      mtOpenSection(Number(at.side.dataset.mtDrop), d.key);
      return;
    }
    if (at.more) { setInMore(d.key, true); return; }
    /* in the main sections, a card dropped among More's joins it; one from
       More dropped among the others leaves it */
    if (d.from === $("ss-nav") && d.key !== "home") {
      const intoMore = !!at.card.closest(".ss-more-list");
      if (intoMore !== moreSections.has(d.key)) {
        if (intoMore) moreSections.add(d.key); else moreSections.delete(d.key);
        SS.Store.setPrefs({moreSections: [...moreSections]});
        if (at.card.dataset.drag === d.key) { render(); return; }
      }
    }
    if (at.card.dataset.drag === d.key) return;
    const keys = [...d.from.querySelectorAll("[data-drag]")].map((c) => c.dataset.drag);
    const without = keys.filter((k) => k !== d.key);
    let i = without.indexOf(at.card.dataset.drag);
    if (i < 0) i = without.length;
    without.splice(at.before ? i : i + 1, 0, d.key);
    if (typeof d.from._onNavDrop === "function") d.from._onNavDrop(without);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && dragging) endNavDrag();
  });
  window.addEventListener("blur", () => { if (dragging) endNavDrag(); });
}

/** The modules the router hands a view to, in the order it asks them. */
function routedModules() {
  return [SS.Games, SS.Cards, SS.Mind, SS.Boards, SS.Scrapbook, SS.Paper, SS.Assets, SS.Pixel, SS.Vector, SS.Cells,
          SS.Fleeting, SS.Collab, SS.Archive, SS.Journal, SS.Stuff,
          SS.Guides, SS.Notebooks, SS.Ebooks, SS.Home, SS.NeuroGuide, SS.Code,
          window.CP && window.CP.Cookery, window.CP && window.CP.Money,
          window.CP && window.CP.Training,
          window.CP && window.CP.Notes];
}
/** Which module draws a view, or null for the host's own screens (photos,
    settings). */
function moduleFor(v) {
  return routedModules().find((m) => m && m.VIEWS.includes(v)) || null;
}

/* ==========================================================================
   MULTITASK — two sections side by side.

   Cam: "lets build a Multitask mode ... splitting the workspace into 2. Then
   i drag and drop the respective mainsection into the respective side. When
   opened in the side it won't have a left hand side bar but will have a
   collapsed version of the right side bar with the subsections."

   Cam's Collective v283 had the same idea, and its history is the brief:
   changing one side must never rebuild the other (v190), the divider only
   ever resizes (never re-renders), and an app whose state lives in one place
   cannot run in both panes at once (v46).

   HOW IT WORKS. There is still one `view` and one render() -- every module
   calls those. In Multitask, `view` is the ACTIVE side's view, and render()
   draws only that side. A side becomes active the moment it is pressed
   (pointerdown, capture phase), so a click inside a side always navigates
   that side, and the other side's DOM, scroll and half-typed work are never
   touched.

   Modules that bring their own shell (Notes, Training, Puzzles, Divination
   and Mindfulness, Music) show it where it stands in the page, so a side
   takes the shell INTO itself before its module mounts. A shell up on the
   other side is never taken. That is also why one main section can only be
   on one side: Divination and Mindfulness are one module with one shell,
   and a section's screens share its module's state.
   ========================================================================== */
const MT_SHELLS = '[id$="-shell"], #cf-lens';
const MT = {on: false, panes: [], active: 0, ratio: 0.5, last: null};

/** Two views that cannot be up at once: ONE MODULE behind both.

    Cam: "in multitasking mode i would like to be able to have 2 instances of
    the same main section open ... an ebook open on one side and the vault on
    the other side so i can take notes at the same time." The limit was never
    the section: it is that a module's state and shell exist once. So two
    different parts of one section -- Ebooks and the Vault, Cells and Boards
    -- sit side by side; the same module twice (Training and Training,
    Divination and Mindfulness, which are one module) still cannot. The
    host's own screens (Photos, Settings) share the host's state, so for
    those the section is what counts. */
function mtClash(a, b) {
  if (!a || !b) return false;
  const ma = moduleFor(a), mb = moduleFor(b);
  if (ma || mb) return !!ma && ma === mb;
  const sa = sectionOf(a), sb = sectionOf(b);
  return !!sa && sa === sb;
}

function mtSave() {
  if (MT.on) {
    MT.last = {ratio: MT.ratio, active: MT.active,
      views: MT.panes.map((p) => p.view || ""),
      subHidden: MT.panes.map((p) => !!p.subHidden)};
  }
  SS.Store.setPrefs({multitask: Object.assign({}, MT.last || {}, {on: MT.on})});
}

function mtPaneEl(i) {
  const el = document.createElement("section");
  el.className = "mt-pane";
  el.dataset.pane = String(i);
  el.innerHTML = `<div class="mt-body"><div class="mt-host"></div></div>
    <nav class="mt-subnav" aria-label="Subsections"></nav>`;
  return el;
}

/** Each side takes the shells it may need before its module mounts: every
    shell except one showing on the other side. */
function mtAdoptShells(i) {
  const me = MT.panes[i], other = MT.panes[1 - i];
  document.querySelectorAll(MT_SHELLS).forEach((sh) => {
    if (other && other.el.contains(sh) && !sh.hidden) return;
    if (sh.parentNode !== me.body) me.body.appendChild(sh);
  });
}

function renderPane(i) {
  const p = MT.panes[i];
  const mod = p.view ? moduleFor(p.view) : null;
  /* Leaving a module on this side: it tidies up after itself (Training's
     Lens, say). Only this side's own module -- never the other side's. */
  if (p.mod && p.mod !== mod && typeof p.mod.unmount === "function") p.mod.unmount();
  p.mod = mod;
  mtAdoptShells(i);
  if (!p.view) {
    p.el.querySelectorAll(MT_SHELLS).forEach((sh) => { sh.hidden = true; });
    p.host.style.display = "";
    p.host.innerHTML = `<div class="mt-empty">
      <div class="mt-empty-ic">${ic("i-grid")}</div>
      <p><b>Drag a section here</b></p>
      <p class="stamp">Drag any main section from the left-hand menu onto
        this side, or click one while this side is highlighted.</p></div>`;
  } else {
    renderInto(p.host, p);
  }
  mtPaintSubnav(i);
}

/** Draws a side that is not the active one -- the Kitchen finishing its load
    for a side Cam has since moved away from, say -- by making it active for
    exactly as long as it takes to draw. */
function renderPaneAt(i) {
  if (!MT.on || i < 0) { render(); return; }
  if (i === MT.active) { render(); return; }
  mtDraw(i);
}

/** Draw side i from its own stored view, whichever side is active, and put
    everything back as it was -- the active side, `view`, the section the
    page is styled for. */
function mtDraw(i) {
  const keepActive = MT.active, keepView = view;
  MT.active = i; view = MT.panes[i].view;
  try { renderPane(i); } finally {
    MT.active = keepActive; view = keepView;
    mtPaintActive();
  }
}

function renderMultitask() {
  const me = MT.panes[MT.active], other = MT.panes[1 - MT.active];
  /* A link on this side to a section already open on the other side (Home's
     "Fleeting →" while Notes is on the right): that section can only be in
     one place, so the other side goes there and becomes the active one. This
     side is left exactly as it was. */
  if (view && mtClash(view, other.view)) {
    const target = view;
    view = me.view || "";
    MT.active = 1 - MT.active;
    view = target;
    toast(`${sectionName(sectionOf(target)) || "That"} is open on the other side.`);
  }
  MT.panes[MT.active].view = view;
  renderSidebar();
  mtPaintActive();
  renderPane(MT.active);
  mtSave();
}

function mtPaintActive() {
  MT.panes.forEach((p, i) => p.el.classList.toggle("is-active", i === MT.active));
  const appEl = $("ss-app");
  if (appEl) appEl.dataset.section = String(view || "").split(":")[0];
}

/** Pressing anywhere in a side makes it the active one -- BEFORE the press
    reaches whatever was pressed, so that thing's render() lands on its own
    side. The shared right-hand menu and the crumb follow it. */
function mtActivate(i) {
  if (!MT.on || i === MT.active || !MT.panes[i]) return;
  MT.panes[MT.active].view = view;
  MT.active = i;
  view = MT.panes[i].view || "";
  mtPaintActive();
  renderSidebar();
  mtSave();
}

/** The side's own subsection strip: the right-hand menu, collapsed to its
    icons, for THIS side's section. Built by the same code as the real menu,
    then stripped to icons with the names kept as tooltips. */
function mtPaintSubnav(i) {
  const p = MT.panes[i];
  const nav = p.el.querySelector(".mt-subnav");
  const section = p.view ? sectionOf(p.view) : null;
  p.el.classList.toggle("subnav-hidden", !!p.subHidden);
  if (!section) { nav.innerHTML = ""; return; }
  const keep = view;
  view = p.view;                   // the "on" card is this side's, not the active side's
  try {
    const accent = (SECTION_META[section] || {}).accent || "var(--accent)";
    nav.innerHTML = section === "photos" ? photosNav(accent)
      : orderedChildren(section).map((c) =>
          navCard(c.key, c.icon || CHILD_ICONS[c.key] || "i-grid", c.name, accent,
            view === c.key, `data-view="${c.key}"`, "")).join("");
  } finally { view = keep; }
  nav.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
  nav.querySelectorAll("[data-view]").forEach((b) => {
    const name = b.textContent.replace(/\s+/g, " ").trim();
    b.title = name; b.setAttribute("aria-label", name);
  });
  nav.onclick = (e) => {
    const b = e.target.closest("[data-view]");
    if (!b) return;
    mtActivate(i);
    view = b.dataset.view;
    selection.clear();
    SS.Store.setPrefs({view});
    render();
  };
}

/** A main section, dropped on (or opened into) side i. */
function mtOpenSection(i, key) {
  const target = firstViewOf(key);
  if (!target || !MT.on || !MT.panes[i]) return;
  const me = MT.panes[i], other = MT.panes[1 - i];
  MT.panes[MT.active].view = view;          // bank the active side first
  let want = target;
  if (other.view && mtClash(want, other.view)) {
    /* The other side already has this part of the section. If another part
       of it can sit alongside -- Notes on the right while the Vault is on the
       left opens Ebooks, say -- open that; only a section that is one module
       all through swaps sides. */
    const alt = recentViews.concat(orderedChildren(key).map((c) => c.key))
      .find((v) => sectionOf(v) === key && !mtClash(v, other.view));
    if (alt) want = alt;
  }
  if (other.view && mtClash(want, other.view)) {
    /* Already open on the other side: dropping it here SWAPS the sides,
       which is what dragging it across means. In this order, so each
       module's shell is free before the side that wants it draws: this
       side lets go, the other side takes this side's old section, then
       this side takes the one that was dropped. */
    const mine = mtClash(me.view, target) ? "" : me.view;
    me.view = ""; mtDraw(i);
    other.view = mine; mtDraw(1 - i);
  }
  MT.active = i;
  view = want;
  selection.clear();
  render();
}

function mtWireGutter(root, gutter) {
  gutter.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    gutter.setPointerCapture(e.pointerId);
    gutter.classList.add("dragging");
    const move = (ev) => {
      const r = root.getBoundingClientRect();
      MT.ratio = Math.min(0.8, Math.max(0.2, (ev.clientX - r.left) / r.width));
      root.style.setProperty("--mt-ratio", MT.ratio);
    };
    const up = () => {
      gutter.classList.remove("dragging");
      gutter.removeEventListener("pointermove", move);
      gutter.removeEventListener("pointerup", up);
      window.dispatchEvent(new Event("resize"));   // modules that measure, re-measure
      mtSave();
    };
    gutter.addEventListener("pointermove", move);
    gutter.addEventListener("pointerup", up);
  });
  gutter.addEventListener("dblclick", () => {
    MT.ratio = 0.5;
    root.style.setProperty("--mt-ratio", MT.ratio);
    window.dispatchEvent(new Event("resize"));
    mtSave();
  });
}

/** Dropping a main section's card from the left-hand menu onto a side.
    The drag itself (right button held, see wireDragOrder) finds the side
    under the pointer by this mark, so nothing here listens for anything. */
function mtWireDrop(el, i) {
  el.dataset.mtDrop = String(i);
}

function enterMultitask(saved) {
  if (MT.on) return;
  saved = saved || {};
  const stage = $("ss-stage");
  const root = document.createElement("div");
  root.id = "mt-root";
  MT.ratio = Number.isFinite(saved.ratio) ? Math.min(0.8, Math.max(0.2, saved.ratio)) : 0.5;
  root.style.setProperty("--mt-ratio", MT.ratio);
  const gutter = document.createElement("div");
  gutter.className = "mt-gutter";
  gutter.title = "Drag to resize — double-click to even up";
  gutter.setAttribute("role", "separator");
  gutter.setAttribute("aria-orientation", "vertical");
  const views = Array.isArray(saved.views) ? saved.views : [view, ""];
  MT.panes = [0, 1].map((i) => {
    const el = mtPaneEl(i);
    return {el, body: el.querySelector(".mt-body"), host: el.querySelector(".mt-host"),
            view: views[i] || "", mod: null,
            subHidden: !!(saved.subHidden && saved.subHidden[i])};
  });
  if (mtClash(MT.panes[0].view, MT.panes[1].view)) MT.panes[1].view = "";
  root.append(MT.panes[0].el, gutter, MT.panes[1].el);
  stage.insertBefore(root, $("ss-subnav"));
  $("ss-main").style.display = "none";
  MT.panes.forEach((p, i) => {
    p.el.addEventListener("pointerdown", () => mtActivate(i), true);
    p.el.addEventListener("focusin", () => mtActivate(i), true);
    mtWireDrop(p.el, i);
  });
  mtWireGutter(root, gutter);
  MT.on = true;
  $("ss-app").classList.add("multitask");
  mtPaintButton();
  /* The side that is not starting active is drawn first, so the one Cam is
     working in is drawn last and holds the page's attention. */
  MT.active = saved.active === 1 ? 1 : 0;
  renderPaneAt(1 - MT.active);
  view = MT.panes[MT.active].view || "";
  render();
  window.dispatchEvent(new Event("resize"));
}

function exitMultitask() {
  if (!MT.on) return;
  const keep = MT.panes[MT.active].view || MT.panes[1 - MT.active].view || "home:dashboard";
  /* Every shell goes back where it lives, before the right-hand menu, in
     the order the page first had them. */
  const stage = $("ss-stage"), anchor = $("ss-subnav");
  for (const id of MT_SHELL_ORDER) {
    const sh = document.getElementById(id);
    if (sh) { sh.hidden = true; stage.insertBefore(sh, anchor); }
  }
  MT.panes.forEach((p) => {
    if (p.mod && typeof p.mod.unmount === "function") p.mod.unmount();
  });
  const root = $("mt-root");
  if (root) root.remove();
  $("ss-main").style.display = "";
  MT.on = false;
  MT.panes = [];
  $("ss-app").classList.remove("multitask");
  mtPaintButton();
  view = keep;
  render();
  mtSave();
  window.dispatchEvent(new Event("resize"));
}

/* Recorded at start-up, before anything moves: where the shells go home to. */
const MT_SHELL_ORDER = [...document.querySelectorAll('#ss-stage > [id$="-shell"], #ss-stage > #cf-lens')]
  .map((el) => el.id);

function mtPaintButton() {
  const b = $("ss-multitask");
  if (!b) return;
  b.classList.toggle("on", MT.on);
  b.setAttribute("aria-pressed", MT.on ? "true" : "false");
  b.title = MT.on ? "Leave Multitask" : "Multitask — two sections side by side";
}

/** F8: the active side's subsection strip, and only that side's -- F9 still
    hides every other bar, as it always has. */
function mtToggleSubnav() {
  if (!MT.on) return;
  const p = MT.panes[MT.active];
  p.subHidden = !p.subHidden;
  p.el.classList.toggle("subnav-hidden", p.subHidden);
  window.dispatchEvent(new Event("resize"));
  mtSave();
}

/** The top bar's button. Coming back into Multitask brings back the last
    layout -- the divider, the strips, the right-hand side -- with whatever
    Cam is looking at now on the left. */
function mtToggle() {
  if (MT.on) { exitMultitask(); return; }
  const last = MT.last || {};
  /* Whichever remembered side is not what is on screen now: leave from the
     right, and that side's section is what the app shows, so the LEFT one
     is the one to bring back beside it. */
  const lastViews = Array.isArray(last.views) ? last.views : [];
  const right = [lastViews[1], lastViews[0]].find((v) => v && !mtClash(view, v)) || "";
  enterMultitask(Object.assign({}, last, {active: 0, views: [view, right]}));
}

SS.Multitask = {
  get on() { return MT.on; },
  get active() { return MT.active; },
  get views() { return MT.panes.map((p) => p.view); },
  enter: enterMultitask, exit: exitMultitask, toggle: mtToggle,
  open: mtOpenSection, activate: mtActivate, toggleSubnav: mtToggleSubnav,
  clash: mtClash,
};

function renderSidebar() {
  const section = sectionOf(view);
  if (section) lastViewBySection[section] = view;
  for (const [k, h] of Object.entries(QUICK_HALVES)) if (view && view.startsWith(h.prefix)) lastHalfView[k] = view;
  if (view) recentViews = [view].concat(recentViews.filter((v) => v !== view)).slice(0, 12);

  /* ---- left: the main sections ---- */
  /* "More" (2026-10-06, the audit; Cam: add "More" only, no renames): the
     sections used least sit in a group at the foot that opens in place.
     Which ones is Cam's (Settings -> Sections shown); it opens by itself
     while one of them is the page on screen. */
  const all = orderedSections();
  const inMore = all.filter((k) => moreSections.has(k));
  const card = (key) => navCard(key, SECTION_META[key].icon, sectionName(key),
    SECTION_META[key].accent, key === section, `data-section="${key}"`, key === "notes" ? collabBadge() : "");
  const moreShown = moreOpen || inMore.includes(section);
  $("ss-nav").innerHTML = all.filter((k) => !moreSections.has(k)).map(card).join("")
    + (inMore.length ? `
      <button class="ss-card ss-nav-btn ss-more ${moreShown ? "open" : ""}" id="ss-more" type="button"
              aria-expanded="${moreShown}" style="--card-accent:var(--muted)"
              title="More sections. Drag a section onto it (hold the right mouse button) to tuck it in here; drag it back out to the list above.">
        <span class="ss-card-ic">${ic("i-more")}</span><span>More</span>
        <span class="ss-more-n">${inMore.length}</span></button>
      <div class="ss-more-list" ${moreShown ? "" : "hidden"}>${inMore.map(card).join("")}</div>` : "");
  const moreBtn = $("ss-more");
  if (moreBtn) moreBtn.onclick = () => { moreOpen = !moreShown; renderSidebar(); };

  renderSubnav(section);
  renderTabs(section);
  renderCrumb(section);

  document.querySelectorAll("#ss-nav [data-section]").forEach((b) =>
    b.addEventListener("click", () => {
      const next = firstViewOf(b.dataset.section);
      if (!next) return;
      view = next;
      selection.clear();
      SS.Store.setPrefs({view});
      render();
    }));
  document.querySelectorAll("#ss-nav [data-view], #ss-subnav [data-view], #ss-tabs [data-view]").forEach((b) =>
    b.addEventListener("click", () => {
      view = b.dataset.view;
      selection.clear();
      SS.Store.setPrefs({view});
      render();
    }));
  ["ss-new-folder", "ss-new-folder-2"].forEach((id) => {
    const el = $(id);
    if (el) el.onclick = (e) => { e.stopPropagation(); newFolderFlow(); };
  });
  ["ss-new-album", "ss-new-album-2"].forEach((id) => {
    const el = $(id);
    if (el) el.onclick = (e) => { e.stopPropagation(); newAlbumFlow(); };
  });
  /* Scroll the open subsection into view only when it is actually out of
     sight, so the menu never jumps while browsing. */
  const active = $("ss-subnav-body").querySelector(".ss-nav-btn.on");
  if (active && active.scrollIntoView) {
    active.scrollIntoView({block: "nearest", inline: "nearest"});
  }

  /* Dragging a card, and the star that puts a subsection on Home. */
  wireDragOrder($("ss-nav"), async (order) => {
    navOrder = {...navOrder, sections: order};
    await SS.Store.setPrefs({navOrder});
    render();
  });
  const saveChildOrder = async (order) => {
    const sec = sectionOf(view);
    if (!sec) return;
    navOrder = {...navOrder, children: {...(navOrder.children || {}), [sec]: order}};
    await SS.Store.setPrefs({navOrder});
    render();
  };
  wireDragOrder($("ss-subnav-body"), saveChildOrder);
  /* the tabs above the page: the same order as the menu, so moving one moves both */
  wireDragOrder($("ss-tabs"), saveChildOrder, {left: true, across: true});
  /* Nothing to wire for album drops: the pointer drag finds the album
     under the cursor with elementFromPoint, so a menu rebuilt on every
     render cannot leave a stale listener behind. */
  document.querySelectorAll("#ss-subnav [data-fav], #ss-tabs [data-fav]").forEach((star) => {
    const go = (e) => {
      e.stopPropagation();          // starring must not also open the section
      e.preventDefault();
      toggleFavourite(star.dataset.fav);
    };
    star.addEventListener("click", go);
    star.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") go(e);
    });
  });

  $("ss-settings").classList.toggle("on", sectionOf(view) === "settings");
  /* "+ Add photos" belongs to Photos. It used to sit under every section,
     offering to add photos while Cam was mid-way through a training session. */
  $("ss-add").hidden = section !== "photos";
  labelNav();
}

/* ---- right: the subsections of the open section ---- */
function renderSubnav(section) {
  const title = $("ss-subnav-title");
  const body = $("ss-subnav-body");
  const foot = $("ss-subnav-foot");
  const accent = (SECTION_META[section] || {}).accent || "var(--accent)";

  if (!section && MT.on && !view) {       // an empty Multitask side
    title.textContent = "Multitask";
    body.innerHTML = `<p class="ss-subnav-empty">Drag a main section onto this side.</p>`;
    foot.innerHTML = "";
    return;
  }
  if (!section) {                       // Settings has no subsections
    title.textContent = "Settings";
    body.innerHTML = `<p class="ss-subnav-empty">Nothing to choose here.</p>`;
    foot.innerHTML = "";
    return;
  }
  title.textContent = sectionName(section);
  foot.innerHTML = "";
  if (section === "photos") {
    body.innerHTML = photosNav(accent);
    return;
  }
  body.innerHTML = orderedChildren(section).map((c) =>
    /* c.icon first: the puzzle entries are added at runtime and bring their
       own, and without it all seventeen showed the same generic tile. */
    navCard(c.key, c.icon || CHILD_ICONS[c.key] || "i-grid", c.name, accent,
      view === c.key, `data-view="${c.key}"`, (c.key === "collab:board" ? collabBadge() : "") + favStar(c.key))).join("");
}

/* A section's pages as a row of tabs above the page (2026-10-05). Cam asked for
   an audit of NeuroNet's design; its first finding was that the right-hand
   menu, the sidebar and the bars left about two thirds of the window for the
   page itself. The tabs show the same pages in the same order. Photos keeps
   its menu -- Cam's own folders, albums and tags -- and so does Multitask,
   whose sides each have their own strip. The right-hand menu is still there
   for anyone who prefers it (the last tab's button, saved as pageTabs). */
let pageTabs = true;
function renderTabs(section) {
  const el = $("ss-tabs");
  if (!el) return;
  const on = pageTabs && !!section && section !== "photos" && !MT.on && orderedChildren(section).length > 0;
  $("ss-app").classList.toggle("page-tabs", on);
  if (!on) { el.hidden = true; el.innerHTML = ""; return; }
  const accent = (SECTION_META[section] || {}).accent || "var(--accent)";
  el.style.setProperty("--card-accent", accent);
  el.innerHTML = `<div class="ss-tabs-row">${orderedChildren(section).map((c) =>
    `<button class="ss-tab ${view === c.key ? "on" : ""}" data-view="${escA(c.key)}" data-drag="${escA(c.key)}"
       aria-current="${view === c.key ? "page" : "false"}">${ic(c.icon || CHILD_ICONS[c.key] || "i-grid")}<span>${esc(c.name)}</span>${c.key === "collab:board" ? collabBadge() : ""}${favStar(c.key)}</button>`).join("")}</div>
    <button class="ss-tabs-mode" type="button" title="Show these pages as a menu on the right"
            aria-label="Show these pages as a menu on the right">${ic("i-menu")}</button>`;
  el.hidden = false;
  const cur = el.querySelector(".ss-tab.on");
  if (cur && cur.scrollIntoView) cur.scrollIntoView({block: "nearest", inline: "nearest"});
  el.querySelector(".ss-tabs-mode").onclick = () => setPageTabs(false);
}
async function setPageTabs(v) {
  pageTabs = !!v;
  render();
  await SS.Store.setPrefs({pageTabs});
}

/* Photos keeps the menu it always had -- its entries are Cam's own folders,
   albums and tags, not a fixed list -- drawn as cards like the rest. */
function photosNav(accent) {
  const counts = {
    all: data.photos.length,
    starred: data.photos.filter((p) => (p.rating || 0) > 0).length,
    untagged: data.photos.filter((p) => !(p.tags || []).length
      && !(p.albumIds || []).length && !p.folderId).length,
  };
  const topFolders = data.folders.filter((f) => !f.parentId);
  const on = (key) => sectionOn(key);
  const count = (n) => (n === null ? "" : `<span class="ss-nav-count">${n}</span>`);
  const card = (key, icon, label, n) => `
    <button class="ss-card ss-nav-btn ${view === key ? "on" : ""}" data-view="${escA(key)}"
            style="--card-accent:${accent}">
      <span class="ss-card-ic">${ic(icon)}</span><span>${esc(label)}</span>${count(n)}
    </button>`;

  return `
    ${on("photos") ? [["all", "i-grid", "All photos", counts.all],
                      ["recent", "i-clock", "Recently added", null],
                      ["starred", "i-star", "Starred", counts.starred],
                      ["untagged", "i-tag", "Unfiled", counts.untagged]]
      .map(([k, i, l, n]) => card(k, i, l, n)).join("") : ""}

    ${on("folders") ? `<div class="ss-nav-h">Folders
      <button class="ss-nav-add" id="ss-new-folder" title="New folder">${ic("i-plus")}</button></div>
    ${topFolders.length ? renderFolderTree(topFolders, 0, accent)
      : `<button class="ss-nav-empty" id="ss-new-folder-2">
           ${ic("i-plus")} <span>New folder</span></button>`}` : ""}

    ${on("albums") ? `<div class="ss-nav-h">Albums
      <button class="ss-nav-add" id="ss-new-album" title="New album">${ic("i-plus")}</button></div>
    ${data.albums.length ? [...data.albums]
      .sort((a, b) => a.name.localeCompare(b.name)).map((a) => {
        const n = data.photos.filter((p) => (p.albumIds || []).includes(a.id)).length;
        return card("album:" + a.id, "i-album", a.name, n);
      }).join("")
      : `<button class="ss-nav-empty" id="ss-new-album-2">
           ${ic("i-plus")} <span>New album</span></button>`}` : ""}

    ${on("tags") && data.photoTagList.length ? `<div class="ss-nav-h">Tags</div>
      ${[...data.photoTagList].sort().map((t) => {
        const n = data.photos.filter((p) => (p.tags || []).includes(t)).length;
        return card("tag:" + t, "i-tag", t, n);
      }).join("")}` : ""}`;
}

/* ---- the bottom bar: where you are ---- */
function renderCrumb(section) {
  const el = $("ss-crumb");
  if (!el) return;
  const parts = [];
  if (section) parts.push(sectionName(section));
  parts.push(viewLabel(view));
  // never "Settings — Settings" (2026-10-05): a page named like its section says it once
  el.textContent = parts.filter(Boolean).filter((p, i, a) => a.indexOf(p) === i).join(" — ");
}

/* COLLAPSIBLE MENU. Collapsed, the sidebar shows icons only, and every button
   takes its own label as the name shown on hover (and read out by a screen
   reader). Worked out here, in one pass after the sidebar draws, rather than
   written into each button's template: there are several templates, and a
   button added later is named without anyone remembering to. Only while
   collapsed -- with the menu open the label is already on screen, and a
   tooltip repeating it just gets in the way. A title a button already had
   (like "New folder") is left exactly as it was. */
let navCollapsed = false;

function labelNav() {
  const buttons = document.querySelectorAll(
    "#ss-sidebar .ss-nav-btn, #ss-sidebar .ss-foot-btn, #ss-add, #ss-subnav .ss-nav-btn");
  for (const b of buttons) {
    const collapsed = b.closest("#ss-subnav") ? subnavCollapsed : navShownCollapsed();
    if (collapsed) {
      if (b.hasAttribute("title") && !b.dataset.autoTitle) continue;
      // Not the icon tile: a card's first span holds its icon, and taking
      // that gave an empty name, so collapsed cards showed nothing on hover.
      const labelEl = b.querySelector(
        ".ss-label, span:not(.ss-nav-count):not(.ss-add-plus):not(.ss-card-ic)");
      const name = (labelEl ? labelEl.textContent : b.textContent).replace(/\s+/g, " ").trim();
      if (!name) continue;
      b.title = name;
      b.setAttribute("aria-label", name);
      b.dataset.autoTitle = "1";
    } else if (b.dataset.autoTitle) {   // expanded again: the label is visible
      b.removeAttribute("title");
      b.removeAttribute("aria-label");
      delete b.dataset.autoTitle;
    }
  }
}

let subnavCollapsed = false;
function applySubnavCollapsed(v) {
  subnavCollapsed = !!v;
  $("ss-app").classList.toggle("subnav-collapsed", subnavCollapsed);
  const t = $("ss-subnav-collapse");
  if (t) {
    const label = subnavCollapsed ? "Expand this menu" : "Collapse this menu";
    t.title = label;
    t.setAttribute("aria-label", label);
    t.setAttribute("aria-pressed", String(subnavCollapsed));
  }
  labelNav();
}

/* F9 hides every bar -- both menus, the top bar and the bottom bar -- leaving
   only the workspace. Cam: "There needs to be a shortcut to hide all bars. So
   top bar (music has to keep playing), side navbars and the bottom bar".

   The music keeps playing because the player's audio does not live in the
   bar: it sits on the page itself, and the bar only shows what it is doing.
   Hiding a bar is a style change; nothing is unloaded.

   Deliberately NOT remembered between launches. Opening NeuroNet to a blank
   window with no menus, having forgotten why, is a bad first five seconds --
   and the way back is a key you would have to already know. */
let barsHidden = false;
function applyBarsHidden(v, announce) {
  barsHidden = !!v;
  $("ss-app").classList.toggle("bars-hidden", barsHidden);
  if (barsHidden && announce) toast("Bars hidden — F9 brings them back");
}

function applyNavCollapsed(v) {
  navCollapsed = !!v;
  paintNavCollapsed();
}
/* Compact (display.js, this computer's layout -- 2026-10-06): the menu shows
   as icons. Its button opens it for now without changing the saved choice,
   which is the roomy screen's. */
let navOpenInCompact = false;
const isCompact = () => !!(window.NNDisplay && NNDisplay.compact());
function navShownCollapsed() { return isCompact() ? !navOpenInCompact : navCollapsed; }
function paintNavCollapsed() {
  const shown = navShownCollapsed();
  $("ss-app").classList.toggle("nav-collapsed", shown);
  const t = $("ss-collapse");
  if (t) {
    const label = shown ? "Expand the menu" : "Collapse the menu";
    t.title = label;
    t.setAttribute("aria-label", label);
    t.setAttribute("aria-pressed", String(shown));
  }
  labelNav();
}
if (window.NNDisplay) NNDisplay.onChange(() => { navOpenInCompact = false; if ($("ss-app")) paintNavCollapsed(); });

function renderFolderTree(folders, depth, accent) {
  return [...folders].sort((a, b) => a.name.localeCompare(b.name))
    .map((f) => {
      const kids = data.folders.filter((x) => x.parentId === f.id);
      const ids = new Set([f.id, ...descendantFolderIds(f.id)]);
      const n = data.photos.filter((p) => ids.has(p.folderId)).length;
      /* the same card as the rest of the menu (Cam, 15 Nov 2026: the sidebar
         "doesnt look consistent with anything"); a folder inside another is
         set in by --depth while the menu is open, and lines up with the rest
         when it is folded to icons */
      return `<button class="ss-card ss-nav-btn ss-folder-card ${view === "folder:" + f.id ? "on" : ""}"
        data-view="folder:${escA(f.id)}" style="--card-accent:${accent};--depth:${depth}">
        <span class="ss-card-ic">${ic("i-folder")}</span><span>${esc(f.name)}</span><span class="ss-nav-count">${n}</span></button>
        ${kids.length ? renderFolderTree(kids, depth + 1, accent) : ""}`;
    }).join("");
}

function renderLibrary(main) {
  const photos = currentPhotos();
  const total = photosForView().length;

  main.innerHTML = `
    <div class="row" style="align-items:flex-start;margin-bottom:2px">
      <div style="flex:1">
        <h2 class="page-h">${esc(viewTitle())}</h2>
        <p class="page-sub">${photos.length}${
          query && total !== photos.length ? ` of ${total}` : ""} photo${
          photos.length === 1 ? "" : "s"}${
          query ? ` matching \u201C${esc(query)}\u201D` : ""}.</p>
      </div>
      <div class="row" style="gap:8px">
        <select class="input" id="ss-sort" style="min-height:38px">
          ${[["newest", "Newest first"], ["oldest", "Oldest first"],
             ["name", "By name"], ["rating", "By rating"]]
            .map(([k, l]) => `<option value="${k}"${
              sortBy === k ? " selected" : ""}>${l}</option>`).join("")}
        </select>
        <button class="btn btn-sm ${selecting ? "btn-primary" : ""}"
                id="ss-select">${selecting ? "Done" : "Select"}</button>
      </div>
    </div>

    <div class="ss-searchbar">
      ${ic("i-search")}
      <input id="ss-search" value="${escA(query)}"
             placeholder="Search names, tags, albums, folders, notes\u2026">
      ${query ? `<button class="btn btn-quiet btn-sm" id="ss-clear">Clear</button>` : ""}
    </div>

    <div id="selbar-slot"></div>

    ${photos.length ? `<div class="gallery" style="--tile:${tileSize}px">
      ${photos.map((p) => `
        <div class="tile ${selection.has(p.id) ? "picked" : ""}"
             data-photo="${escA(p.id)}">
          <div class="ex-loading">&nbsp;</div>
          ${selecting ? `<span class="tile-check">${ic("i-check")}</span>` : ""}
          ${(p.rating || 0) > 0 ? `<span class="tile-stars">${
            "\u2605".repeat(p.rating)}</span>` : ""}
          <div class="tile-meta">${esc(nameOf(p))}</div>
        </div>`).join("")}
    </div>`
      : `<div class="empty">${query
          ? "Nothing matches that search."
          : (data.photos.length
             ? "Nothing here yet."
             : "No photos in the library.<br>Add some, or drag them into the window.")}</div>`}`;

  const search = main.querySelector("#ss-search");
  search.addEventListener("input", () => {
    query = search.value;
    renderLibrary(main);
    const again = $("ss-search");
    again.focus();
    again.setSelectionRange(again.value.length, again.value.length);
  });
  const clear = main.querySelector("#ss-clear");
  if (clear) clear.onclick = () => { query = ""; render(); };

  main.querySelector("#ss-sort").onchange = (e) => {
    sortBy = e.target.value;
    SS.Store.setPrefs({sortBy});
    render();
  };
  main.querySelector("#ss-select").onclick = () => {
    selecting = !selecting;
    if (!selecting) selection.clear();
    /* Toggling the MODE does change every tile (each gains or loses its
       tick), so this one genuinely needs a repaint — but only of the
       checkmarks. Re-fetching every thumbnail for a change that doesn't
       touch the images is what made selection feel slow. */
    main.querySelectorAll("[data-photo]").forEach((tile) => {
      tile.classList.remove("picked");
      const existing = tile.querySelector(".tile-check");
      if (selecting && !existing) {
        const mark = document.createElement("span");
        mark.className = "tile-check";
        mark.innerHTML = `<svg class="ic" viewBox="0 0 24 24"><use href="#i-check"/></svg>`;
        tile.appendChild(mark);
      } else if (!selecting && existing) {
        existing.remove();
      }
    });
    main.querySelector("#ss-select").textContent = selecting ? "Done" : "Select";
    main.querySelector("#ss-select").classList.toggle("btn-primary", selecting);
    paintSelectionBar(main);
  };

  wirePhotoDrag(main);

  /* Cam: "a click and drag feature when in the select tool ... please also
     have this feature in photos when in select mode." In select mode a
     press on an UNSELECTED photo starts a sweep (SS.shared.sweepSelect):
     move across the others and they are ticked too. A press on a photo
     that is ALREADY selected still carries the selection, as before, so
     dragging the ticked photos onto an album in the menu keeps working;
     clicking one un-ticks it. */
  let sweptPress = null;               // the photo whose press the sweep took
  sweepSelect(main.querySelector(".gallery"), {
    item: "[data-photo]",
    canStart: (el) => {
      const ok = selecting && !selection.has(el.dataset.photo);
      sweptPress = ok ? el.dataset.photo : null;
      return ok;
    },
    key: (el) => el.dataset.photo,
    has: (id) => selection.has(id),
    set: (id, on) => { if (on) selection.add(id); else selection.delete(id); },
    paint: (el, on) => el.classList.toggle("picked", on),
    done: () => paintSelectionBar(main),
  });

  const galleryEl = main.querySelector(".gallery");
  if (galleryEl) galleryEl.addEventListener("click", (e) => {
      const el = e.target.closest("[data-photo]");
      if (!el || !galleryEl.contains(el)) return;
      const id = el.dataset.photo;
      if (selecting && sweptPress === id) { sweptPress = null; return; }   // the sweep did it
      if (selecting) {
        /* BUG FIX — Cam: "Everytime when i select a photo in the select
           mode, the whole page of photos refreshes."

           This called render(), which rebuilt the entire page AND
           re-fetched every thumbnail from the backend on every single
           click. On a library of any size that's a visible flash and a
           lot of pointless work.

           Nothing about the gallery changes when a photo is ticked
           except that one tile and the count in the bar, so only those
           are touched now. The images already on screen are left
           exactly where they are. */
        if (selection.has(id)) selection.delete(id); else selection.add(id);
        el.classList.toggle("picked", selection.has(id));
        paintSelectionBar(main);
        return;
      }
      openViewer(id, photos.map((p) => p.id));
    });
  /* Cam (15 Nov 2026): "a right click option ... for rotate left and right
     so i dont need to open the photo to do it". On a ticked photo it turns
     every ticked one; otherwise just the one under the pointer. */
  if (galleryEl) galleryEl.addEventListener("contextmenu", (e) => {
    const el = e.target.closest("[data-photo]");
    if (!el || !galleryEl.contains(el)) return;
    e.preventDefault();
    const id = el.dataset.photo;
    const ids = (selecting && selection.has(id)) ? [...selection] : [id];
    photoMenu(e.clientX, e.clientY, ids);
  });

  paintSelectionBar(main);
  paintThumbs(main, photos);
}

/** The photo grid's right-click: Rotate Left / Right, in the same style as
    the Snip button's menu (.snip-menu). */
function photoMenu(x, y, ids) {
  document.querySelector(".snip-menu")?.remove();
  const n = ids.length;
  const m = document.createElement("div");
  m.className = "snip-menu";
  m.setAttribute("role", "menu");
  m.innerHTML = `<button type="button" role="menuitem" data-rot="left">&#8634; Rotate left${n > 1 ? ` (${n})` : ""}</button>
    <button type="button" role="menuitem" data-rot="right">&#8635; Rotate right${n > 1 ? ` (${n})` : ""}</button>`;
  m.style.left = `${Math.round(x)}px`;
  m.style.top = `${Math.round(y)}px`;
  document.body.appendChild(m);
  const r = m.getBoundingClientRect();     // keep it on screen near the edges
  if (r.right > window.innerWidth - 8) m.style.left = `${Math.max(8, Math.round(x - r.width))}px`;
  if (r.bottom > window.innerHeight - 8) m.style.top = `${Math.max(8, Math.round(y - r.height))}px`;
  const close = (e) => {
    if (e && e.type === "pointerdown" && m.contains(e.target)) return;
    if (e && e.type === "keydown" && e.key !== "Escape") return;
    m.remove();
    document.removeEventListener("pointerdown", close, true);
    document.removeEventListener("keydown", close, true);
  };
  setTimeout(() => {
    document.addEventListener("pointerdown", close, true);
    document.addEventListener("keydown", close, true);
  }, 0);
  m.querySelectorAll("[data-rot]").forEach((b) => b.onclick = () => {
    close();
    rotatePhotos(ids, b.dataset.rot);
  });
}

async function rotatePhotos(ids, dir) {
  const byId = new Map(data.photos.map((p) => [p.id, p]));
  let failed = "";
  for (const id of ids) {
    const p = byId.get(id);
    if (!p || !p.storedName) continue;
    const res = await SS.Store.rotate(p.storedName, dir);
    if (res && res.error) { failed = res.error; continue; }
    invalidateThumb(p.storedName);
  }
  if (failed) toast(failed, "error");
  render();
}

/** Draws the selection bar on its own, so ticking a photo updates the
    count without touching the gallery around it. */
function paintSelectionBar(main) {
  const slot = main.querySelector("#selbar-slot");
  if (!slot) return;
  if (!selecting || !selection.size) { slot.innerHTML = ""; return; }
  slot.innerHTML = `
    <div class="selbar">
      <b>${selection.size} selected</b>
      <span class="spacer"></span>
      <button class="btn btn-sm" id="sel-all">Select all</button>
      <button class="btn btn-sm" id="sel-none">Clear</button>
      <button class="btn btn-sm" id="sel-album">Add to album</button>
      <button class="btn btn-sm" id="sel-folder">Move to folder</button>
      <button class="btn btn-sm" id="sel-tag">Tag</button>
      <button class="btn btn-sm" id="sel-export">${ic("i-export")} Export</button>
      <button class="btn btn-sm btn-danger" id="sel-delete">Delete</button>
    </div>`;

  /* Select all / Clear were worth adding here: filing a whole album was
     the point of select mode, and ticking sixty photos by hand isn't
     meaningfully better than the one-by-one problem it solved. */
  slot.querySelector("#sel-all").onclick = () => {
    for (const p of currentPhotos()) selection.add(p.id);
    main.querySelectorAll("[data-photo]").forEach((t) =>
      t.classList.add("picked"));
    paintSelectionBar(main);
  };
  slot.querySelector("#sel-none").onclick = () => {
    selection.clear();
    main.querySelectorAll("[data-photo]").forEach((t) =>
      t.classList.remove("picked"));
    paintSelectionBar(main);
  };

  wireSelectionActions(main);
}

/* ------------------------------------------------ thumbnail loading ---
   Cam: "Is there a way to preload photos?" — yes, and it turned out the
   real problem was worse than no preloading. The old loop AWAITED each
   thumbnail before asking for the next one, so a library filled strictly
   one photo at a time, top to bottom: 47 photos meant 47 round-trips in
   series. Three changes, in order of how much they matter:

   1. PARALLEL. Thumbnails are now fetched in batches of 8 at a time.
      The batch size is a deliberate ceiling rather than "ask for all of
      them at once" — pywebview's bridge serialises every reply through
      one channel, and flooding it with 300 simultaneous calls makes the
      window itself stop responding while they queue.

   2. CACHED. Once a thumbnail has been decoded it stays in SS.Art,
      so switching from All photos to an album and back repaints from
      memory with no backend calls at all. The cache is keyed on
      storedName (the file), not the photo id, so a photo that's been
      re-filed or renamed keeps its thumbnail.

   3. PRELOADED. After the visible photos are painted, preloadRest()
      quietly fetches everything else in the library in the background,
      so by the time Cam opens another album it's usually already there.
      It's cancellable by token: navigating again abandons the old
      preload rather than leaving two of them fighting for the bridge.

   The one hazard with any cache is staleness, so invalidateThumb() is
   called wherever a file actually changes on disk — delete and editor
   save. Without it, an edited photo would keep showing its old self. */
/* ==========================================================================
   SS.Art — one cache, one gate, one lazy loader, for every module
   ==========================================================================
   Cam: "The app has become unresponsive it lags when i move around the
   app, especially when loading the album sub section found under the
   music main section."

   Measured in Chromium against a 400-track, 25-album library:

     music:library   401 bridge calls, 400 of them thumbnails, EVERY visit
     music:albums     26 bridge calls, and the page stayed blank until the
                      last one landed, because the shelf awaited them all
                      before writing any markup

   Nothing was cached, so leaving the section and coming back paid the
   whole cost again -- which is exactly the "lags when i move around"
   half of the report, as distinct from any one screen being slow.

   The photo library had already solved this, three times over: a cache
   keyed on the file, a single global gate so the bridge is never
   flooded, and a pair of observers so only the tiles you can see hold a
   picture. Music had none of it. Rather than write a second version
   with its own bugs, that machinery lives here now, keyed on a string
   and given a fetcher, so any module can use it. The photo functions
   below are thin wrappers over it and behave exactly as they did.

   WHY THE CACHE HOLDS PROMISES rather than finished data URLs is worth
   repeating, because it was measured and is easy to undo by accident: a
   render doesn't happen once. Boot renders, prefs arrive and it renders
   again, EXIF dates land and it renders a third time. Caching the
   RESULT meant all three passes looked, found nothing there yet, and
   each started its own fetch -- 48 photos cost 144 calls. Storing the
   promise the moment a fetch STARTS means passes two and three find it
   and wait on the same one.

   THE GATE IS GLOBAL, not per caller. Also measured: batching inside
   each caller looked bounded but wasn't -- three renders ran a batch of
   8 each and the real peak was 24 simultaneous calls down a bridge that
   serialises them anyway. The limit belongs around the fetch itself,
   where the visible tiles, the background preload and now music all
   pass through the same queue. Waiters are served first come, first
   served, and what is on screen always asks before a preload does.
   ========================================================================== */
const THUMB_BATCH = 8;

SS.Art = (() => {
  const cache = new Map();
  const MAX = 1200;
  let active = 0;
  const waiting = [];
  /* keys whose fetcher is running right now -- see get() */
  const fetching = new Set();

  function slot() {
    if (active < THUMB_BATCH) { active++; return Promise.resolve(); }
    return new Promise((resolve) => waiting.push(resolve));
  }
  function release() {
    const next = waiting.shift();
    if (next) next();          // hands the slot straight on, no gap
    else active--;
  }

  function remember(key, promise) {
    cache.set(key, promise);
    /* A Map iterates in insertion order, so the oldest entry is the
       first key. Evicting one is safe even while it is on screen: the
       <img> already owns its data, and a still-in-flight promise still
       resolves for whoever is awaiting it. */
    while (cache.size > MAX) {
      const oldest = cache.keys().next().value;
      if (oldest === key) break;
      cache.delete(oldest);
    }
  }

  return {
    /** The picture for `key`, fetching it through the gate at most once.
        `fetch` returns a data URL, or something with .dataUrl, or null.
        A failed fetch is NOT remembered as a permanent "no" -- it is
        dropped so a later render can try again. */
    get(key, fetch) {
      if (fetching.has(key)) {
        return Promise.reject(new Error(
          "SS.Art.get re-entered for " + key + " -- a fetcher must fetch, "
          + "not go back through the cache"));
      }
      if (cache.has(key)) return cache.get(key);
      const p = slot()
        .then(() => {
          /* A fetcher that calls back into get() for the SAME key finds
             the pending promise stored just above and ends up awaiting
             itself -- forever, holding one of the gate's slots while it
             does, so eight of them stop every picture in the app. It
             happened: music's lazy loader was handed its own cached
             accessor as its fetcher. Silent, permanent, and invisible
             in a test that only counts calls, so it is caught here
             rather than left to be found again. */
          fetching.add(key);
          try { return fetch(); } finally { fetching.delete(key); }
        })
        .then((got) => { release(); return got; },
              (e) => { release(); throw e; })
        .then((got) => {
          const url = got && got.dataUrl ? got.dataUrl
            : (typeof got === "string" ? got : null);
          if (url) return url;
          cache.delete(key);
          return null;
        })
        .catch((e) => { cache.delete(key); throw e; });
      remember(key, p);
      return p;
    },

    /** Already in hand, with no call and no wait? Used where a render
        can paint a picture inline rather than filling it in after. */
    ready(key) { return cache.has(key); },

    /** Forget one picture, or every picture whose key starts with a
        prefix -- for a file that has actually changed on disk, where a
        remembered copy would be the old one. A prefix because a single
        image is cached once per size it is drawn at. */
    forget(key) { cache.delete(key); },
    forgetPrefix(prefix) {
      for (const k of [...cache.keys()]) {
        if (k.startsWith(prefix)) cache.delete(k);
      }
    },

    size() { return cache.size; },
    room() { return MAX - cache.size; },

    /* ---- only what you can see carries a picture ---------------------

       Cam, earlier: "when i click on an album and open the individual
       album page, it lags when i scroll on the page."

       TWO observers, because one cannot do both jobs. An observer
       reports a tile once, as it crosses its own boundary. With a
       single near boundary the "gone" report arrives while the tile is
       only just off screen -- too early to release -- and nothing is
       reported again as it travels further, so after scrolling every
       image was still being held.

       The margins are wide on purpose. Narrow ones meant tiles loaded
       and released constantly while scrolling, and work during a scroll
       is exactly what makes a scroll stutter. Load well ahead, release
       well behind, and nothing happens at the moment Cam is moving. */
    lazy(opts) {
      const root = opts.root;
      /* (the performance audit, 3 Nov 2026) Every watch used to live for good: its two observers, rooted on the long-lived
         page, kept every row they had been given -- a whole Music library (about 750 elements) and a Photos grid left in
         memory on every visit, hour after hour (1.8 GB after a day). A watch now stops itself once its list has left the
         page, and each new one sweeps away any that were orphaned without noticing. */
      const live = SS.Art._live || (SS.Art._live = []);
      for (let i = live.length - 1; i >= 0; i--) if (!live[i].root.isConnected) { live[i].stop(); live.splice(i, 1); }
      const tiles = [...root.querySelectorAll(opts.selector)];
      if (!tiles.length) return null;

      /* Somewhere without IntersectionObserver -- an older renderer, or
         a test harness -- every tile is painted as it used to be.
         Slower on a big page, but it works, which beats a grid of empty
         squares. */
      if (typeof IntersectionObserver === "undefined") {
        for (const t of tiles) {
          const key = opts.keyOf(t);
          if (!key) continue;
          SS.Art.get(key, () => opts.fetchOf(t))
            .then((url) => { if (url) opts.place(t, url); })
            .catch(() => {});
        }
        return null;
      }

      let near = null, far = null;
      const stop = () => { if (near) near.disconnect(); if (far) far.disconnect(); };
      near = new IntersectionObserver((entries) => {
        if (!root.isConnected) { stop(); return; }
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const tile = e.target;
          if (tile.dataset.artLoaded) continue;
          const key = opts.keyOf(tile);
          if (!key) continue;
          tile.dataset.artLoaded = "1";
          SS.Art.get(key, () => opts.fetchOf(tile))
            .then((url) => { if (url) opts.place(tile, url); })
            .catch(() => { delete tile.dataset.artLoaded; });
        }
      }, {root: opts.scroller || null, rootMargin: `${NEAR} 0px`});

      far = new IntersectionObserver((entries) => {
        if (!root.isConnected) { stop(); return; }
        for (const e of entries) {
          if (e.isIntersecting) continue;
          const tile = e.target;
          if (!tile.dataset.artLoaded) continue;
          /* Let the decoded bitmap go. The data URL stays in the cache,
             so scrolling back is instant and nothing is fetched twice. */
          if (opts.clear) opts.clear(tile);
          delete tile.dataset.artLoaded;
        }
      }, {root: opts.scroller || null, rootMargin: `${FAR} 0px`});

      for (const t of tiles) { near.observe(t); far.observe(t); }
      live.push({root, stop});
      return {disconnect: stop};
    },
  };
})();

/* ------------------------------------------------------------------------
   The photo library's own view of SS.Art.

   Everything that used to live here -- the cache, the gate, the
   promise-not-result rule, the eviction ceiling -- is now up in SS.Art,
   shared with music. These are the photo-shaped names the gallery calls,
   unchanged in behaviour and in signature. A photo's key is its
   storedName (the file), not its id, so a photo that has been re-filed
   or renamed keeps its thumbnail.
   ------------------------------------------------------------------------ */
let preloadToken = 0;

function thumbFor(storedName) {
  return SS.Art.get(storedName, () => SS.Store.thumb(storedName));
}

function placeThumb(photoId, dataUrl) {
  if (!dataUrl) return;
  /* the gallery may have re-rendered while this was loading */
  const live = document.querySelector(`[data-photo="${photoId}"] .ex-loading`);
  if (!live) return;
  const img = document.createElement("img");
  img.src = dataUrl;
  live.replaceWith(img);
}

/* ---- only the tiles you can see carry an image ---------------------------

   Cam: "when i click on an album and open the individual album page, it lags
   when i scroll on the page."

   Every tile used to be given its full picture the moment the page drew: an
   album of 300 photos held 300 decoded images while 20 were on screen. Even
   in a fast browser that put 21 of 24 scroll steps past 32ms; on a software
   renderer it is far worse.

   The observers themselves are SS.Art's now, shared with the album shelf.
   What stays here is only what is photo-shaped: which element is a tile,
   which file it wants, and what a tile looks like with and without its
   picture. */
/* Wide margins on purpose. Narrow ones meant tiles were loaded and released
   constantly while scrolling, and that work during a scroll is exactly what
   makes it stutter. Loading well ahead and releasing well behind keeps the
   page small without doing anything at the moment Cam is moving. */
const NEAR = "800px";          // start loading this far before it appears
const FAR = "3000px";          // release only once it is well behind
let tileWatcher = null;

function watchTiles(root, photos) {
  if (tileWatcher) tileWatcher.disconnect();
  const byId = new Map(photos.map((p) => [p.id, p]));
  tileWatcher = SS.Art.lazy({
    root,
    scroller: root.closest("#ss-main, .mt-host") || null,
    selector: "[data-photo]",
    keyOf: (tile) => {
      const photo = byId.get(tile.dataset.photo);
      return photo ? photo.storedName : null;
    },
    fetchOf: (tile) => SS.Store.thumb(byId.get(tile.dataset.photo).storedName),
    place: (tile, url) => placeThumb(tile.dataset.photo, url),
    /* Put the placeholder back so the decoded bitmap can go. The data URL
       stays in SS.Art, so scrolling back is instant and nothing is fetched
       twice. */
    clear: (tile) => {
      const img = tile.querySelector("img");
      if (!img) return;
      const slot = document.createElement("div");
      slot.className = "ex-loading";
      slot.innerHTML = "&nbsp;";
      img.replaceWith(slot);
    },
  });
}

async function paintThumbs(root, photos) {
  /* Tiles are painted as they come into view (see watchTiles), so this no
     longer walks the whole album. Anything already cached and already on
     screen still paints on the next microtask, with no backend call. */
  watchTiles(root, photos);
  preloadRest(photos);
}

async function preloadRest(shown) {
  const token = ++preloadToken;
  const seen = new Set(shown.map((p) => p.storedName));
  const room = SS.Art.room();
  if (room <= 0) return;
  /* only preload what the cache can actually keep — fetching more than
     that would evict the photos Cam is looking at to make room for ones
     he isn't */
  const rest = data.photos.filter((p) =>
    !seen.has(p.storedName) && !SS.Art.ready(p.storedName)).slice(0, room);
  if (!rest.length) return;
  for (let i = 0; i < rest.length; i += THUMB_BATCH) {
    if (token !== preloadToken) return;
    const batch = rest.slice(i, i + THUMB_BATCH);
    await Promise.all(batch.map((p) => thumbFor(p.storedName).catch(() => null)));
    /* a breath between batches so the preload never competes with
       something Cam is actually looking at right now */
    await new Promise((r) => setTimeout(r, 40));
  }
}

function invalidateThumb(storedName) {
  SS.Art.forget(storedName);
}

/** Put photos in an album, save, and say so.

    One function for every way of doing it -- the selection bar's dialog
    and dragging onto the album in the menu both land here. Written out
    twice they would drift, and the drift would be silent: a photo that is
    in an album by one route and not by the other looks like a bug in the
    album, not in whichever copy was not updated.

    Already-there photos are counted separately rather than added twice,
    because dropping a selection onto an album it partly belongs to is a
    normal thing to do and "Added 3, 2 were already there" is the honest
    answer. */
async function addToAlbum(photoIds, albumId) {
  const album = data.albums.find((a) => a.id === albumId);
  if (!album) { toast("That album has gone.", "error"); return {added: 0, already: 0}; }
  const ids = new Set(photoIds);
  let added = 0, already = 0;
  for (const p of data.photos) {
    if (!ids.has(p.id)) continue;
    p.albumIds = p.albumIds || [];
    if (p.albumIds.includes(albumId)) already += 1;
    else { p.albumIds.push(albumId); added += 1; }
  }
  if (added) await save();
  const n = (c, word) => `${c} ${word}${c === 1 ? "" : "s"}`;
  if (added && already) {
    toast(`${n(added, "photo")} added to ${album.name} — ${already} already there.`, "good");
  } else if (added) {
    toast(`${n(added, "photo")} added to ${album.name}.`, "good");
  } else if (already) {
    toast(`Already in ${album.name}.`);
  }
  return {added, already};
}

/* --------------------------------------------------- bulk actions --- */
/* The reason a photo app needs selection at all: filing fifty holiday
   photos one at a time is exactly the frustration Cam hit in Camily. */
function wireSelectionActions(main) {
  const picked = () => data.photos.filter((p) => selection.has(p.id));

  const albumBtn = main.querySelector("#sel-album");
  if (albumBtn) albumBtn.onclick = () => {
    /* v2 — this used to refuse with "Make an album first", which sent
       Cam off to find a control that was hard to spot. Creating one
       from right here is the obvious thing to allow: filing photos is
       exactly when you realise you need a new album. */
    const d = openDlg(`Add ${selection.size} photo${selection.size === 1 ? "" : "s"} to\u2026`,
      `${data.albums.length ? [...data.albums]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((a) => `<button class="btn" style="width:100%;justify-content:flex-start;margin-bottom:6px"
          data-al="${escA(a.id)}">${esc(a.name)}</button>`).join("")
        : `<p class="stamp" style="margin:0 0 12px">No albums yet.</p>`}
       <label class="label">New album</label>
       <div class="row" style="gap:8px">
         <input class="input" id="al-new" style="flex:1" placeholder="Holidays">
         <button class="btn btn-primary" id="al-create">Create &amp; add</button>
       </div>`);

    d.body.querySelector("#al-create").onclick = async () => {
      const name = d.body.querySelector("#al-new").value.trim();
      if (!name) { toast("Give the album a name.", "error"); return; }
      const album = {id: newId(), name, created: new Date().toISOString()};
      data.albums.push(album);
      /* The same filing as everywhere else. This used to do its own, and
         a test looking for one place that writes albumIds found two --
         which is exactly how the third route, dragging, would have ended
         up behaving differently from the other two without anyone
         noticing. */
      const got = await addToAlbum([...selection], album.id);
      /* addToAlbum only saves when it actually filed something, which is
         right for filing and wrong here: the ALBUM is new either way, and
         with an empty selection it would exist only in memory and be gone
         on the next launch. */
      if (!got.added) { await save(); toast(`Album “${name}” created.`, "good"); }
      d.close();
      selection.clear();
      render();
    };
    d.body.querySelectorAll("[data-al]").forEach((b) =>
      b.addEventListener("click", async () => {
        await addToAlbum(picked().map((p) => p.id), b.dataset.al);
        d.close();
        selection.clear();
        render();
      }));
    d.btn("Cancel", "btn-quiet", d.close);
  };

  const folderBtn = main.querySelector("#sel-folder");
  if (folderBtn) folderBtn.onclick = () => {
    const d = openDlg(`Move ${selection.size} photo${selection.size === 1 ? "" : "s"} to\u2026`,
      `<button class="btn" style="width:100%;justify-content:flex-start;margin-bottom:6px"
         data-fo="">No folder</button>
       ${data.folders.length ? [...data.folders]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((f) => `<button class="btn" style="width:100%;justify-content:flex-start;margin-bottom:6px"
          data-fo="${escA(f.id)}">${esc(folderPath(f))}</button>`).join("") : ""}
       <label class="label">New folder</label>
       <div class="row" style="gap:8px">
         <input class="input" id="fo-new" style="flex:1" placeholder="2019">
         <button class="btn btn-primary" id="fo-create">Create &amp; move</button>
       </div>`);

    d.body.querySelector("#fo-create").onclick = async () => {
      const name = d.body.querySelector("#fo-new").value.trim();
      if (!name) { toast("Give the folder a name.", "error"); return; }
      const folder = {id: newId(), name, parentId: ""};
      data.folders.push(folder);
      for (const p of data.photos.filter((x) => selection.has(x.id))) {
        p.folderId = folder.id;
      }
      await save();
      d.close();
      toast(`Moved to ${name}.`, "good");
      selection.clear();
      render();
    };
    d.body.querySelectorAll("[data-fo]").forEach((b) =>
      b.addEventListener("click", async () => {
        /* a photo lives in ONE folder — that's what makes folders
           different from albums, which a photo can be in many of */
        for (const p of picked()) p.folderId = b.dataset.fo;
        await save();
        d.close();
        toast("Moved.", "good");
        selection.clear();
        render();
      }));
    d.btn("Cancel", "btn-quiet", d.close);
  };

  const tagBtn = main.querySelector("#sel-tag");
  if (tagBtn) tagBtn.onclick = () => {
    const d = openDlg(`Tag ${selection.size} photo${selection.size === 1 ? "" : "s"}`,
      `${data.photoTagList.length ? `<label class="label" style="margin-top:0">Existing tags</label>
        <div class="chip-row" id="tg-existing">
          ${[...data.photoTagList].sort().map((t) =>
            `<button class="chip" data-tag="${escA(t)}">${esc(t)}</button>`).join("")}
        </div>` : ""}
       <label class="label">New tag</label>
       <div class="row" style="gap:8px">
         <input class="input" id="tg-new" style="flex:1" placeholder="Holiday">
         <button class="btn btn-primary" id="tg-add">Add</button>
       </div>`);

    const applyTag = async (tag) => {
      tag = tag.trim();
      if (!tag) return;
      if (!data.photoTagList.includes(tag)) data.photoTagList.push(tag);
      for (const p of picked()) {
        p.tags = p.tags || [];
        if (!p.tags.includes(tag)) p.tags.push(tag);
      }
      await save();
      d.close();
      toast(`Tagged "${tag}".`, "good");
      selection.clear();
      render();
    };
    d.body.querySelectorAll("[data-tag]").forEach((b) =>
      b.addEventListener("click", () => applyTag(b.dataset.tag)));
    d.body.querySelector("#tg-add").onclick = () =>
      applyTag(d.body.querySelector("#tg-new").value);
    d.btn("Cancel", "btn-quiet", d.close);
  };

  const exportBtn = main.querySelector("#sel-export");
  if (exportBtn) exportBtn.onclick = async () => {
    const items = picked().map((p) => ({storedName: p.storedName,
      originalName: p.originalName}));
    toast(`Exporting ${items.length}\u2026`);
    const result = await SS.Store.exportMany(items);
    if (result.error) { toast(result.error, "error"); return; }
    toast(`${result.exported} exported to your desktop.`, "good");
  };

  const delBtn = main.querySelector("#sel-delete");
  if (delBtn) delBtn.onclick = async () => {
    const n = selection.size;
    const ok = await confirmDlg({
      title: `Delete ${n} photo${n === 1 ? "" : "s"}?`,
      body: "They'll be removed from the library and from disk. This also "
        + "removes them from Camily, since both apps share one collection. "
        + "It can't be undone.",
      yes: `Delete ${n}`});
    if (!ok) return;
    for (const p of picked()) {
      await SS.Store.del(p.storedName);
      invalidateThumb(p.storedName);
    }
    data.photos = data.photos.filter((p) => !selection.has(p.id));
    await save();
    selection.clear();
    render();
    toast(`${n} deleted.`);
  };
}

/** A folder's full path, so two folders both called "2019" under
    different parents can be told apart in a flat list. */
function folderPath(folder) {
  const parts = [folder.name];
  let cur = folder;
  const guard = new Set([folder.id]);
  while (cur && cur.parentId) {
    const parent = data.folders.find((f) => f.id === cur.parentId);
    /* a corrupt file could in principle contain a loop; walking it
       forever would hang the app */
    if (!parent || guard.has(parent.id)) break;
    guard.add(parent.id);
    parts.unshift(parent.name);
    cur = parent;
  }
  return parts.join(" / ");
}

/* --------------------------------------------------- folders/albums --- */
async function newFolderFlow() {
  const name = await promptText("New folder", "Name");
  const trimmed = (name || "").trim();
  if (!trimmed) return;
  /* a folder made while inside another becomes its child — which is
     what nesting is for, and saves a separate "move" step */
  const parentId = view.startsWith("folder:") ? view.slice(7) : "";
  data.folders.push({id: newId(), name: trimmed, parentId});
  await save();
  render();
}

async function newAlbumFlow() {
  const name = await promptText("New album", "Name");
  const trimmed = (name || "").trim();
  if (!trimmed) return;
  data.albums.push({id: newId(), name: trimmed,
    created: new Date().toISOString()});
  await save();
  render();
}

/* -------------------------------------------------------- the viewer --- */
let viewerList = [];
let viewerIndex = 0;

function openViewer(id, ids) {
  viewerList = ids && ids.length ? ids : [id];
  viewerIndex = Math.max(0, viewerList.indexOf(id));
  window.addEventListener("keydown", viewerKeys);
  paintViewer();
}

function closeViewer() {
  window.removeEventListener("keydown", viewerKeys);
  const veil = $("viewer-veil");
  veil.classList.remove("open");
  veil.innerHTML = "";
}

function viewerKeys(e) {
  if (e.key === "Escape") closeViewer();
  else if (e.key === "ArrowLeft") viewerNav(-1);
  else if (e.key === "ArrowRight") viewerNav(1);
  else if (/^[0-5]$/.test(e.key)) rateCurrent(+e.key);
}

function viewerNav(d) {
  if (viewerList.length < 2) return;
  viewerIndex = (viewerIndex + d + viewerList.length) % viewerList.length;
  paintViewer();
}

async function rateCurrent(n) {
  const p = data.photos.find((x) => x.id === viewerList[viewerIndex]);
  if (!p) return;
  /* pressing the same rating again clears it, so a mis-key is undone
     with the same key rather than needing a separate control */
  p.rating = p.rating === n ? 0 : n;
  await save();
  paintViewer();
}

async function paintViewer() {
  const p = data.photos.find((x) => x.id === viewerList[viewerIndex]);
  if (!p) { closeViewer(); return; }
  const veil = $("viewer-veil");
  const multi = viewerList.length > 1;
  const albumNames = (p.albumIds || [])
    .map((id) => (data.albums.find((a) => a.id === id) || {}).name)
    .filter(Boolean);
  const folder = data.folders.find((f) => f.id === p.folderId);

  veil.innerHTML = `
    <button class="vw-close" id="vw-close">${ic("i-x")}</button>
    ${multi ? `<button class="vw-nav vw-prev" id="vw-prev">${ic("i-back")}</button>
      <button class="vw-nav vw-next" id="vw-next">${ic("i-back")}</button>` : ""}
    <div class="viewer">
      <div class="vw-stage" id="vw-stage"><p class="stamp">Loading&hellip;</p></div>
      <div class="vw-bar">
        <div class="vw-meta">
          <div class="vw-title">${esc(nameOf(p))}</div>
          <div class="vw-sub">${esc(dateOf(p) || "No date")}${
            multi ? ` \u00b7 ${viewerIndex + 1} of ${viewerList.length}` : ""}</div>
          <div class="vw-chips">
            ${(p.tags || []).map((t) => `<span class="chip">${esc(t)}</span>`).join("")}
            ${albumNames.map((a) => `<span class="chip">${esc(a)}</span>`).join("")}
            ${folder ? `<span class="chip">${esc(folder.name)}</span>` : ""}
          </div>
        </div>
        <div class="vw-actions">
          <div class="vw-stars" id="vw-stars">
            ${[1, 2, 3, 4, 5].map((n) => `<button data-rate="${n}"
              class="${(p.rating || 0) >= n ? "on" : ""}">\u2605</button>`).join("")}
          </div>
          <button class="btn btn-sm" id="vw-info">${ic("i-info")} Details</button>
          <button class="btn btn-sm" id="vw-rename">Rename</button>
          <button class="btn btn-sm" id="vw-export">${ic("i-export")} Export</button>
          <button class="btn btn-sm btn-primary" id="vw-edit">${ic("i-edit")} Edit</button>
          <button class="btn btn-sm btn-danger" id="vw-delete">${ic("i-trash")}</button>
        </div>
      </div>
      <div class="vw-details" id="vw-details" hidden></div>
    </div>`;
  veil.classList.add("open");

  veil.querySelector("#vw-close").onclick = closeViewer;
  veil.onclick = (e) => { if (e.target === veil) closeViewer(); };
  if (multi) {
    veil.querySelector("#vw-prev").onclick = () => viewerNav(-1);
    veil.querySelector("#vw-next").onclick = () => viewerNav(1);
  }
  veil.querySelectorAll("[data-rate]").forEach((b) =>
    b.addEventListener("click", () => rateCurrent(+b.dataset.rate)));

  veil.querySelector("#vw-rename").onclick = async () => {
    if (p.snip) { closeViewer(); snipSaveAs(p.snip); return; }     // a snip renames as a snip (Documents too)
    const name = await promptText("Rename", "Name", nameOf(p));
    const t = (name || "").trim();
    if (!t) return;
    const moved = await renamePhotoEverywhere(p, t);
    if (moved && moved.error) { toast(moved.error, "error"); return; }
    await save();
    paintViewer();
    renderSidebar();
  };
  veil.querySelector("#vw-edit").onclick = () => {
    /* the viewer closes first: two full-screen layers stacked would
       leave the viewer's arrow keys still listening behind the editor */
    closeViewer();
    openEditor(p);
  };
  veil.querySelector("#vw-export").onclick = async () => {
    const r = await SS.Store.exportOne(p.storedName, p.originalName);
    toast(r.error || "Saved to your desktop.", r.error ? "error" : "good");
  };
  veil.querySelector("#vw-delete").onclick = async () => {
    const ok = await confirmDlg({title: "Delete this photo?",
      body: "It goes from the library and from disk \u2014 and from Camily "
        + "too, since both share one collection. This can't be undone.",
      yes: "Delete"});
    if (!ok) return;
    await SS.Store.del(p.storedName);
    invalidateThumb(p.storedName);
    data.photos = data.photos.filter((x) => x.id !== p.id);
    viewerList = viewerList.filter((x) => x !== p.id);
    await save();
    if (!viewerList.length) closeViewer();
    else { viewerIndex = Math.min(viewerIndex, viewerList.length - 1); paintViewer(); }
    render();
  };
  veil.querySelector("#vw-info").onclick = async () => {
    const panel = veil.querySelector("#vw-details");
    panel.hidden = !panel.hidden;
    if (panel.hidden) return;
    panel.innerHTML = `<p class="stamp">Reading\u2026</p>`;
    const d = await SS.Store.details(p.storedName);
    const size = d.bytes ? (d.bytes > 1048576
      ? (d.bytes / 1048576).toFixed(1) + " MB"
      : Math.round(d.bytes / 1024) + " KB") : "\u2014";
    panel.innerHTML = `
      <div class="vw-detail-grid">
        <div><span>File</span><b>${esc(p.originalName || "\u2014")}</b></div>
        <div><span>Taken</span><b>${esc(p.takenDate || "Not recorded")}</b></div>
        <div><span>Added</span><b>${esc((p.created || "").slice(0, 10) || "\u2014")}</b></div>
        <div><span>Size</span><b>${size}</b></div>
        ${d.width ? `<div><span>Dimensions</span><b>${d.width} \u00d7 ${d.height}</b></div>` : ""}
        <div><span>Folder</span><b>${esc(folder ? folderPath(folder) : "None")}</b></div>
      </div>`;
  };

  const stage = veil.querySelector("#vw-stage");
  const result = await SS.Store.full(p.storedName);
  const live = $("vw-stage");
  if (!live) return;
  live.innerHTML = result && result.dataUrl
    ? `<img src="${result.dataUrl}" alt="">`
    : `<p class="stamp">${esc((result && result.error) || "Couldn't load that photo.")}</p>`;
}

/* ------------------------------------------------------------ import --- */
/** Where a newly added photo should be filed: whatever view it was
    added from. Adding photos while inside an album and finding them
    in "All photos" instead would be a small daily annoyance. */
function importTargets() {
  const albumIds = view.startsWith("album:") ? [view.slice(6)] : [];
  const folderId = view.startsWith("folder:") ? view.slice(7) : "";
  const tags = view.startsWith("tag:") ? [view.slice(4)] : [];
  return {albumIds, folderId, tags};
}

function blankPhoto(extra) {
  const {albumIds, folderId, tags} = importTargets();
  return {
    id: newId(), created: new Date().toISOString(),
    caption: "", tags: [...tags], albumIds: [...albumIds], folderId,
    notes: "", inFrame: false, rating: 0, takenDate: "",
    ...extra,
  };
}

async function addPhotosFlow() {
  const picked = await SS.Store.pickPhotos();
  if (picked.cancelled) return;
  if (picked.error) { toast(picked.error, "error"); return; }
  const paths = picked.paths || [];
  if (!paths.length) return;

  toast(`Adding ${paths.length} photo${paths.length === 1 ? "" : "s"}\u2026`);
  let added = 0;
  const failed = [];
  for (const path of paths) {
    const stored = await SS.Store.storePhoto(path);
    if (stored.error) { failed.push(stored.error); continue; }
    data.photos.push(blankPhoto({
      storedName: stored.storedName,
      originalName: stored.originalName,
      takenDate: stored.takenDate || "",
    }));
    added++;
  }
  if (added) await save();
  render();
  reportImport(added, failed.length);
}

/** Drag-and-drop hands over File objects rather than paths, so the
    bytes are read here and sent as a data URL — the same route the
    editor uses for a saved edit. */
async function importFiles(fileList) {
  const files = [...fileList].filter((f) => /^image\//.test(f.type));
  if (!files.length) { toast("Only image files can be added.", "error"); return; }
  toast(`Adding ${files.length} photo${files.length === 1 ? "" : "s"}\u2026`);

  let added = 0;
  const failed = [];
  for (const file of files) {
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = () => reject(new Error("read"));
        r.readAsDataURL(file);
      });
      const stored = await SS.Store.storeDataUrl(dataUrl);
      if (stored.error) { failed.push(stored.error); continue; }
      data.photos.push(blankPhoto({
        storedName: stored.storedName,
        originalName: file.name,
      }));
      added++;
    } catch (err) {
      failed.push(file.name);
    }
  }
  if (added) await save();
  render();
  reportImport(added, failed.length);
}

function reportImport(added, failed) {
  if (added && !failed) {
    toast(added === 1 ? "Photo added." : `${added} photos added.`, "good");
  } else if (added) {
    toast(`${added} added, ${failed} couldn't be read.`, "error");
  } else {
    toast("Couldn't add those.", "error");
  }
}

function wireDrop() {
  let depth = 0;
  const overlay = $("drop-overlay");
  const hasFiles = (e) => e.dataTransfer
    && [...e.dataTransfer.types].includes("Files");

  /* A window open that takes a dropped picture itself (Media's Add / Edit
     cover, 15 Nov 2026): the import overlay would sit over it and take the
     drop, so it stays away. */
  const ownDrop = () => !!document.querySelector("#modal-veil.open [data-cover-drop]");
  window.addEventListener("dragover", (e) => { if (hasFiles(e)) e.preventDefault(); });
  window.addEventListener("dragenter", (e) => {
    if (!hasFiles(e) || ownDrop()) return;
    e.preventDefault();
    /* counted, not a flag: dragenter/dragleave fire for every child
       element crossed, so a boolean flickers the overlay off as soon
       as the pointer moves over anything inside the window */
    depth++;
    overlay.classList.add("open");
  });
  window.addEventListener("dragleave", () => {
    depth = Math.max(0, depth - 1);
    if (!depth) overlay.classList.remove("open");
  });
  window.addEventListener("drop", async (e) => {
    if (!e.dataTransfer || !e.dataTransfer.files.length) return;
    e.preventDefault();
    depth = 0;
    if (ownDrop()) { overlay.classList.remove("open"); return; }
    overlay.classList.remove("open");
    await importFiles(e.dataTransfer.files);
  });
}

/* ---------------------------------------------------------- settings --- */

/* ==========================================================================
   SECTIONS — what appears in the sidebar
   ==========================================================================
   Cam: "Turn off what you do not use. Nothing is deleted, and search
   still finds everything inside a hidden section — it just stops taking
   up room in the sidebar."

   That promise is the whole design. Hiding a section only stops it being
   DRAWN: the data is untouched, the views still render if something
   navigates to them, and search still reaches inside. Anything else
   would make this a destructive setting wearing a harmless-looking
   switch.

   Held in prefs rather than in the library file, for the same reason the
   dashboard's block layout is: this is how one person likes their
   sidebar, not something that belongs to the photos.
   ========================================================================== */
const SECTIONS = [
  {key: "photos", name: "Photo library"},
  {key: "folders", name: "Folders"},
  {key: "albums", name: "Albums"},
  {key: "tags", name: "Tags"},
  /* Cam: "rename the main section with Sudoku and others Puzzles" and "each
     game be located in sub sections on the right tool bar". The per-game
     entries are added at startup from Cranium's own list (SS.Games.games),
     so a game added there appears here without anyone editing this. */
  {key: "games", name: "Puzzles", children: [
    {key: "games:home", name: "All puzzles"},
    {key: "games:books", name: "Puzzle Books"},
    {key: "games:stats", name: "Stats"},
  ]},
  /* Celestial turned out to be two things, not one: a divination app
     AND a mindfulness app sharing a window. They are separate sections
     here because they are used at different times -- you do not open a
     breathing exercise while laying out a Celtic Cross. */
  /* NeuroPets (begun here as "Pixel Pet", 2026-10-03) is its own game now --
     neuropets.py, ui/pet/ -- with its own window, shortcut and sandbox. */
  {key: "divination", name: "Divination", children: [
    {key: "div:tarot", name: "Tarot"},
    {key: "div:oracle", name: "Oracle"},
    {key: "div:lenormand", name: "Lenormand"},
    {key: "div:runes", name: "Runes"},
    {key: "div:iching", name: "I Ching"},
    {key: "div:astrology", name: "Astrology"},
  ]},
  {key: "mind", name: "Mindfulness", children: [
    {key: "mind:meditation", name: "Meditation"},
    {key: "mind:breathwork", name: "Breathwork"},
    /* The Journal (ui/journal/, journal.py): anything Cam wants to keep,
       with photos, and Divination's readings with their cards. It took
       Thought Journal's place and its view, so a favourite or a saved menu
       order for Thought Journal finds it. */
    {key: "mind:journal", name: "Journal"},
    {key: "mind:gratitude", name: "Gratitude"},
  ]},
  /* Moved here from KinCrux, whole. Cam: "I want the training features to
     be moved from KinCrux to NeuroNet please". */
  /* Cam: "Type tags in Training are no longer needed for me, have sub
     sections provided for each Circuit, Sessions, Guides etc. It is the
     pill tags i want removed."

     Training arrived with a whole navigation system of its own inside
     this one: six sections, sixteen tabs drawn as a row of pills at the
     top of the page, and its own show/hide switches. The pills said
     "Sessions · Circuits · Exercises · Guides · Document library" while
     the subsection menu two inches to the right said the same thing.

     The pills are gone and every destination they reached is listed
     here. SEVEN of them were reachable ONLY through that row --
     Questionnaires, Equipment, Document library, Lesson plans, Groups,
     Appearance and Backup -- so deleting it without this would have
     stranded them, Backup included, which is where Cam's training data
     is written out. That is checked in test_training_nav.js.

     Hiding these is NeuroNet's job now, in Settings, like every other
     subsection. Training's own switches used to do it; what Cam had
     hidden there is carried over once, in migrateTrainingNav(). */
  {key: "training", name: "Training", children: [
    {key: "training:sessions", name: "Sessions"},
    {key: "training:circuits", name: "Circuits"},
    {key: "training:library", name: "Exercises"},
    {key: "training:guides", name: "Guides"},
    {key: "training:questionnaires", name: "Questionnaires"},
    {key: "training:equipment", name: "Equipment"},
    {key: "training:documents", name: "Document library"},
    {key: "training:calendar", name: "Calendar"},
    {key: "training:programs", name: "Programs"},
    {key: "training:lessonPlans", name: "Lesson plans"},
    {key: "training:books", name: "Training Books"},
    {key: "training:athletes", name: "Athletes"},
    {key: "training:groups", name: "Groups"},
    {key: "training:calculators", name: "Calculators"},
    {key: "training:lens", name: "Lens (gym view)"},
    {key: "training:settings", name: "Training settings"},
    {key: "training:backup", name: "Backup"},
  ]},
  /* Copied from KinCrux, not moved -- Cam: "Do not remove it from KinCrux,
     as they will be used to store different variations of notes and store
     different PDF textbooks." NeuroNet's vault is its own. */
  /* Home came from KinCrux too: the dashboard, the calendar and contacts. */
  /* Cam: "i want the settings menu to be like the rest of the app with
     each setting in the right side bar as sub sections."

     Deliberately absent from SECTION_ORDER, so it does NOT appear in the
     left menu -- Settings is reached by the gear at the bottom, as before.
     Being in SECTIONS is what gives it a right-hand menu like everything
     else. It is also skipped by the "Sections shown" toggles below: a
     switch that hides Settings would hide the switch. */
  {key: "settings", name: "Settings", children: [
    {key: "settings:appearance", name: "Appearance"},
    {key: "settings:size", name: "Text & scale"},
    /* Cam (17 Nov 2026, the ThinkPad): "build this lighter version as an option in neuronet
       settings that can be toggled." See lite.py and ui/lite.js. */
    {key: "settings:lite", name: "Lite mode"},
    {key: "settings:sidebar", name: "Sections shown"},
    {key: "settings:library", name: "Photo library"},
    {key: "settings:merge", name: "Combine libraries"},
    /* Cam: "In Settings menu an application stats panel that breaks down
       what is in the app and how much." See ui/stats/stats.js. */
    {key: "settings:stats", name: "App stats"},
    /* Cam: "a setting to export and import data ... except for music,
       movies, videos or anything large ... This will make it easier to move
       to another system." See ui/transfer/transfer.js and data_transfer.py. */
    {key: "settings:transfer", name: "Export & import"},
    /* NeuroNet System decisions (2026-09-29): "a Settings option to migrate
       data to another drive". See ui/datafolder/datafolder.js, data_move.py. */
    {key: "settings:datafolder", name: "Data folder"},
    /* The screensaver (ui/widgets/widgets.js) -- this page was Desktop
       widgets until they went, 3 Nov 2026. */
    {key: "settings:widgets", name: "Screensaver"},
  ]},
  {key: "home", name: "Home", children: [
    {key: "home:dashboard", name: "Dashboard"},
    {key: "home:calendar", name: "Calendar"},
    {key: "home:contacts", name: "Contacts"},
    /* Personal Effects lived here; it is Stuff → Media now (MOVED_VIEWS). */
  ]},
  /* Cam: "lets create a new main section called Stuff, this will act as the
     section where i can make inventories, databases of all our media."
     Media is the old Personal Effects. Each inventory Cam makes joins this
     menu by name at run time (SS.setSectionChildren, from ui/stuff/stuff.js),
     between Media and the page that manages them. */
  /* M&T -- Media and Things (2026-10-02). Cam: "Lets move the music player
     into the main section where i store lists of the media, however lets
     rename stuff to M&T short for (Media and Things). This is where the sub
     subsections from both music and stuff will now live ... a more central
     location." Music's pages lead (`lead`: kept first when Stuff sets its
     own children at run time), then Media, each inventory, Inventories. The
     section's key stays "stuff" and music:* views are filed under it
     (sectionOf), so old prefs, favourites and links all still land. */
  /* Albums left the menu on 2026-10-05: they are Media's CDs (covers, songs, play),
     with New album, Shuffle and Edit album there. music:albums stays as a view --
     it is the one-album editor that a CD's "Edit album…" opens. */
  /* Music and Media left for NeuroStream (19 Nov 2026, V31): M&T keeps the Things, your inventories. */
  {key: "stuff", name: "M&T", children: [
    {key: "stuff:inventories", name: "Inventories"},
  ]},
  /* Brought in from KinCrux with the merge. Their data stays in KinCrux's
     own files; only the photo library is combined. */
  /* The Kitchen names its views WITHOUT a prefix ("recipes", "menus"), the
     way Cheffo always did, so these are the view names themselves -- a
     prefixed key here would open nothing. sectionOf() files them under
     Kitchen. */
  {key: "cookery", name: "Kitchen", children: [
    {key: "recipes", name: "Recipes"},
    {key: "menus", name: "Menus"},
    {key: "shopping", name: "Shopping Lists"},
    {key: "books", name: "Recipe Books"},
    {key: "calculators", name: "Calculators"},
  ]},
  {key: "money", name: "Money", children: [
    {key: "money:dashboard", name: "Overview"},
    {key: "money:period", name: "This period"},
    {key: "money:fortnight", name: "Fortnight"},
    {key: "money:templates", name: "Repeating"},
    {key: "money:goals", name: "Savings"},
    {key: "money:calc", name: "Calculator"},
    {key: "money:compare", name: "Compare"},
    {key: "money:books", name: "Books"},
  ]},
  /* Vault and Notes swapped (2026-10-02, Cam: "swap the names for Notes and
     Vault over, it would be better suited that way"): the main section is
     the Vault, its first page Notes. Keys unchanged, so nothing moves.
     Then (2026-10-03): "change main section vault to be called scribe" --
     the key is still "notes", so prefs, shortcuts and Multitask stay put. */
  {key: "notes", name: "Scribe", children: [
    {key: "notes:vault", name: "Notes"},
    /* Cam (2026-10-15): "lets use neuronet to discuss play tests, questions and more ... if you think of a new UI that
       works better for you rather than the notes app in the scribe section, just build it and have it live in the
       scribe section (you can call it Collaboration)". collab:* -- notes:* is the Vault's. */
    {key: "collab:board", name: "Collaboration"},
    /* Cam: "add another sub section in Notes called Cells ... a complete
       standalone notes page". Its view is "cells:…" for the same reason as
       Boards: Notes owns everything called notes:*. */
    {key: "cells:list", name: "Cells"},
    /* Cam: "it gets saved under a new sub section in Notes called Fleeting
       ... reviewed later and I can add to another note in the Vault section
       Via copy and paste, then I can delete the note from fleeting." */
    {key: "fleeting:list", name: "Fleeting"},
    /* Cam: "integrate a guides subsection in notes, that has an overview
       and guide on how to use all the tools within the section." Same
       reason for the prefix again. */
    /* Cam: "a book feature for the Notes subsection where I can add any
       type of note from a subsection to it and then export or print."
       Same prefix reasoning again -- notes:* is the Vault's. */
    /* Cam: "rename the sub section books to notebooks". The view keeps its
       name, so favourites and a saved menu order still find it. */
    {key: "books:list", name: "Notebooks"},
    /* Cam: "add a new sub section called ebooks. This should be an ebook
       library and reader. It should have a bookmarks feature as well and a
       bookmarks sub section." ebooks:* for the same reason as the others --
       notes:* is the Vault's -- and that is also what lets an ebook sit on
       one side of Multitask with the Vault on the other. */
    {key: "ebooks:library", name: "Ebooks"},
    {key: "ebooks:bookmarks", name: "Bookmarks"},
    {key: "guides:index", name: "Guides"},
    /* Cam (2026-11-02): "implement an archive in the scribe app, which contains all archived notes, collabs etc this
       will stop cluttering the main apps". archive:* for the same reason as the others. */
    {key: "archive:list", name: "Archive"},
  ]},
  /* Cam (2026-10-03): "lets create new main section called Creative - Scrap
     book, Boards, paper creator and assets can live in there (later a vector
     graphic tool and Pixel art tool in the future)." The views keep their
     names (boards:*, scrapbook:*, paper:*, assets:*), so favourites, saved
     menu orders and open pages still find them; sectionOf() files them here.
     A vector or pixel-art tool later is another child with its own prefix. */
  {key: "creative", name: "Creative", children: [
    /* Cam (2026-10-02): "Scrapbook, which should have the same toolbar as
       boards ... This will be a major release and created to be shipped in
       1.0.7." Boards' editor with materials, paper per page and a cover
       (ui/scrapbook/). scrapbook:* for the same reason as boards:*. */
    {key: "scrapbook:shelf", name: "Scrapbook"},
    /* Cam: "The boards feature will be a seperate sub section under the notes
       main section." Its view is "boards:…", not "notes:…", on purpose: Notes
       shows and hides its whole shell for anything called notes:*. Since
       2026-10-03 it lives in Creative. */
    {key: "boards:list", name: "Boards"},
    /* Cam (2026-10-03): "a paper creator. This is a simple tool which will
       print my selected paper at my selected size. Also it will have a cover
       creator ... (i create pocket notebooks)" -- and "a new feature called
       assets" for everything the Scrapbook, Boards and Covers use
       (ui/paper/, ui/assets/, paper_assets.py). Own prefixes, as above. */
    {key: "paper:make", name: "Paper creator"},
    /* Cam (2026-10-04): "Create a pixel art creator in the creative section
       as well where i can make game assests think asesprite style"
       (ui/pixel/; sprites are assets). */
    {key: "pixel:studio", name: "Pixel art"},
    /* Cam (2026-10-04): "please get started on the vector tool in Neuronet"
       -- the everyday 80%, SVG in and out for Inkscape (ui/vector/). */
    {key: "vector:studio", name: "Vector"},
    {key: "assets:library", name: "Assets"},
  ]},
  /* Cam (2026-10-01): "intergrate Algorithm found in /mnt/Cams_Collective into
     NeuroNet under Code main section and be in IDE sub section, there will be
     more sub sections later included guides, ebooks etc." Algorithm is
     ui/code/ide.js + code_ide.py; later subsections are code:<name> views. */
  /* Then: "Code mainsection is also going to have guides (built out like
     Neuro guides ...). Algorthm research (... annotate, highlight and make
     text boxes around a code base i wrote ...). Also then a data structures
     sub section". Those three are ui/code/library.js and code_library.py. */
  {key: "code", name: "Code", children: [
    {key: "code:ide", name: "IDE"},
    {key: "code:guides", name: "Guides"},
    {key: "code:research", name: "Research"},
    {key: "code:structures", name: "Data Structures"},
    {key: "code:web", name: "Web playground"},
  ]},
  /* Cam: "a manual built for NeuroNet ... built into NeuroNet now as a main
     section and then the sub sections on the right hand sidebar can be the
     sections of the manual", and "Manual should be called Neuro Guide". Its
     chapters -- the same list as ui/guide/guide.js's (test_neuro_guide.js). */
  {key: "guide", name: "Neuro Guide", children: [
    {key: "guide:start", name: "Getting started"},
    {key: "guide:desktop", name: "Your desktop"},
    {key: "guide:omarchy", name: "Omarchy basics"},
    {key: "guide:keys", name: "Keyboard shortcuts"},
    {key: "guide:sections", name: "NeuroNet's sections"},
    {key: "guide:help", name: "When something goes wrong"},
  ]},
];

/* Everything is on until it is explicitly switched off, so a new
   section added in a later version appears rather than hiding itself
   from someone whose prefs predate it. */
let hiddenSections = new Set();

/* Training's show/hide switches, carried across once.

   Training used to keep its own hidden list, in its own prefs, switching
   its own pill tabs on and off. Those tabs are subsections here now, and
   hiding a subsection is NeuroNet's job -- so without this, everything
   Cam had switched off in Training would quietly come BACK the first
   time he opened the new version, and he would be looking at six rows he
   had already told the app he did not want.

   Training's list held two kinds of id: section ids (its "plan" group)
   and tab ids. A hidden section hid every tab under it, so both expand
   to the same thing here -- subsection keys.

   Once only, flagged in prefs. Re-running it would undo Cam's later
   choices: unhide Equipment here, and the next launch would hide it
   again from a pref he set in a version that no longer exists. */
const TRAINING_GROUPS = {
  database: ["sessions", "circuits", "library", "guides", "questionnaires",
             "equipment", "documents"],
  plan: ["calendar", "programs", "lessonPlans"],
  books: ["books"],
  people: ["athletes", "groups"],
  tools: ["calculators"],
};

/* What Training hid when nobody had chosen yet. Kept in step with its
   own HIDDEN_BY_DEFAULT (training/app.js): a fresh install must arrive
   at the same quiet menu it always had, not seventeen rows at once. */
const TRAINING_HIDDEN_BY_DEFAULT = ["plan", "programs", "lessonPlans",
                                    "questionnaires", "groups", "equipment"];

/* ONLY THESE CAN BE HIDDEN BY THE MIGRATION -- the seven that were
   reachable only through the pill row, and so have never had a setting
   of their own here.

   The other ten were already in this menu and always shown, whatever
   Training thought. The two lists disagreed: Training's defaults hid its
   "plan" group, so Calendar and Programs were absent from its pills
   while sitting in Cam's subsection menu the whole time. Migrating his
   Training prefs wholesale took Training's side of that disagreement and
   removed two entries he uses -- which is exactly what happened the
   first time I ran this, and the menu came back eleven rows instead of
   thirteen.

   A migration decides what a NEW setting starts as. It does not get to
   overrule one the person already had. */
const TRAINING_MIGRATABLE = new Set([
  "questionnaires", "equipment", "documents", "lessonPlans", "groups",
  "settings", "backup",
]);

async function migrateTrainingNav(prefs) {
  if (!prefs || prefs.trainingNavMigrated) return;
  let hidden = null;
  let docShown = false;
  try {
    const got = await SS.Store.call("training_get_prefs", [], "");
    if (got && Array.isArray(got.hiddenSections)) hidden = got.hiddenSections;
    docShown = !!(got && got.docLibraryShown);
  } catch (e) {
    /* Never let a pref read stop the app booting. */
    hidden = null;
  }
  /* No stored list means Cam never touched these, so the defaults apply
     -- exactly as Training itself did when the pref was missing. */
  if (!hidden) hidden = [...TRAINING_HIDDEN_BY_DEFAULT];
  /* Training un-hid the document library once and recorded that it had.
     If that had not happened yet, it is due now, or the library would be
     hidden here by a default Training itself had already overridden. */
  if (!docShown) hidden = hidden.filter((id) => id !== "documents");
  for (const id of hidden) {
    for (const tab of (TRAINING_GROUPS[id] || [id])) {
      if (TRAINING_MIGRATABLE.has(tab)) hiddenSections.add("training:" + tab);
    }
  }
  await SS.Store.setPrefs({hiddenSections: [...hiddenSections],
                           trainingNavMigrated: true});
}

/* SCRIBE IS NEUROSCRIBE (21 Nov 2026, Cam: "Now hide the scribe inside of the neuronet main app please").

   NeuroScribe has every Scribe page now (V32, Parts 1 to 6): the Vault, Collaboration, Cells, Fleeting, Notebooks,
   Ebooks and Bookmarks, Guides, the Archive. So on a computer where NeuroScribe is built, Scribe is switched off here
   ONCE, the same switch Settings > Sections shown has (it can be turned back on there), and from then on anything
   that would open one of its pages -- Find, the dashboard, a favourite, a link, Multitask -- opens NeuroScribe
   instead. The notes stay where they are; NeuroNet keeps the jobs on them (the ship list, starter notes, exports).
   Where NeuroScribe isn't built yet, nothing changes, and it's asked again next time. */
async function hideScribeOnce(prefs) {
  if (!prefs || prefs.scribeHiddenForNeuroScribe) return;
  let installed = false;
  try { installed = !!(await SS.Store.call("neuroscribe_installed", [], "")).installed; } catch (e) { installed = false; }
  if (!installed) return;
  hiddenSections.add("notes");
  await SS.Store.setPrefs({hiddenSections: [...hiddenSections], scribeHiddenForNeuroScribe: true});
}

/* A Scribe page asked for while Scribe is switched off: NeuroScribe opens on it. */
const SCRIBE_PAGES = {"collab": "collab", "fleeting": "fleeting", "ebooks:library": "page ebooks",
                      "ebooks:bookmarks": "page ebook-marks", "cells": "page cells", "books": "page notebooks",
                      "guides": "page guides", "archive": "page archive"};
function scribeHandedOver(next, extra) {
  if (sectionOf(next) !== "notes" || sectionOn("notes")) return false;
  const v = String(next);
  let request = SCRIBE_PAGES[v] || SCRIBE_PAGES[v.split(":")[0]] || "";
  if (request === "collab" && extra && extra.ref) request = "collab " + extra.ref;
  else if (request === "collab") request = "page collab";
  SS.Store.call("open_neuroscribe", [request, (extra && extra.path) || ""], "Opening NeuroScribe")
    .then((r) => { if (r && r.error) toast(r.error, "error"); else toast("Scribe is NeuroScribe now: it's opening.", "good"); })
    .catch(() => {});
  return true;
}

function sectionOn(key) {
  /* Settings can never be switched off. Nothing offers to, but a pref file
     carried over from an older build could still name it, and the way back
     from a hidden Settings is to edit JSON by hand. */
  if (key === "settings" || String(key).startsWith("settings:")) return true;
  if (hiddenSections.has(key)) return false;
  /* a child of a hidden parent is hidden too, without needing its own
     entry — otherwise turning a group off and on again would lose
     whichever children had been individually switched off */
  const parent = key.includes(":") ? key.split(":")[0] : null;
  return !(parent && hiddenSections.has(parent));
}

function wireSettingsAppearance(main) {
  main.querySelectorAll("[data-theme]").forEach((b) =>
    b.addEventListener("click", async () => {
      CruxTheme.setTheme(b.dataset.theme);
      await SS.Store.setPrefs({theme: b.dataset.theme});
      render();
    }));
  main.querySelectorAll("[data-text]").forEach((b) =>
    b.addEventListener("click", async () => {
      CruxTheme.setTextSize(b.dataset.text);
      await SS.Store.setPrefs({textSize: b.dataset.text});
      render();
    }));
  const mergeBtn = main.querySelector("#ss-merge-preview");
  if (mergeBtn) mergeBtn.onclick = () => previewLibraryMerge(main);
  main.querySelectorAll("[data-disp]").forEach((b) =>
    b.addEventListener("click", () => {
      if (!window.NNDisplay) return;
      NNDisplay.set({[b.dataset.disp]: b.dataset.disp === "brightness" ? Number(b.dataset.val) : b.dataset.val});
      render();
    }));
  main.querySelectorAll("[data-ui-scale]").forEach((b) =>
    b.addEventListener("click", async () => {
      applyUiScale(Number(b.dataset.uiScale));
      await SS.Store.setPrefs({uiScale: uiScale});
      render();
    }));
    main.querySelectorAll("[data-sec]").forEach((b) =>
    b.addEventListener("click", () =>
      setSectionHidden(b.dataset.sec, b.classList.contains("on"))));
  main.querySelectorAll("[data-more-sec]").forEach((b) =>
    b.addEventListener("click", () => setInMore(b.dataset.moreSec, !moreSections.has(b.dataset.moreSec))));
}

async function setSectionHidden(key, hidden) {
  if (hidden) hiddenSections.add(key);
  else hiddenSections.delete(key);
  await SS.Store.setPrefs({hiddenSections: [...hiddenSections]});
  /* If the view Cam is looking at has just been hidden, stay put rather
     than throwing him somewhere else mid-thought — the section is only
     gone from the sidebar, and the page still works. */
  render();
}

/** Fills in the Cheffo-import panel once the backend has had a look.

    Painted separately rather than inline in renderSettings because
    finding the folder means touching the disk: doing it inside the
    render would hold up the whole Settings page for it, and Settings
    is a page Cam opens for other reasons far more often than this. */
/** The Import-recipes panel. Same shape as the Cheffo one below, and
    separate from the render for the same reason: it touches the disk. */
/* UI SCALE -- Cam: "UI needs to be scaleable for now it looks to small for my
   computer, maybe in settings with text size, offer a UI scale feature. This
   way i can use them both to get the perfect working environment."

   The two do different jobs. Text size grows the WORDS. UI scale grows
   EVERYTHING together -- text, buttons, spacing, icons -- by zooming the
   page, which re-lays it out rather than stretching it, so text stays sharp.
   (Cranium's comments record a stretch -- a CSS transform -- being rejected
   for exactly that blurring.) */
const UI_SCALES = [0.9, 1, 1.15, 1.3, 1.5, 1.75, 2];
let uiScale = 1;
function applyUiScale(z) {
  const v = UI_SCALES.includes(z) ? z : 1;
  uiScale = v;
  document.documentElement.style.zoom = v;
  document.documentElement.style.setProperty("--ss-zoom", v);
  try { localStorage.setItem("ss:uiScale", String(v)); } catch (e) { /* fine */ }
}

/** Show what combining the libraries WOULD do, then offer to do it.
    Cam chose "Combine both into one library" when the apps merged; this is
    how that runs, and it never writes without being asked twice. */
async function previewLibraryMerge(main) {
  const note = main.querySelector("#ss-merge-note");
  note.textContent = "Looking\u2026";
  const r = await SS.Store.call("photos_merge_preview", [], "Combining the libraries");
  if (!r || r.error) { note.textContent = r && r.error ? r.error : "That didn't work."; return; }
  const lines = [];
  lines.push(`${r.copied} photo${r.copied === 1 ? "" : "s"} would come across.`);
  if (r.skipped_same) lines.push(`${r.skipped_same} already here (same picture) would be left alone.`);
  if (r.skipped_done) lines.push(`${r.skipped_done} brought across earlier would be skipped.`);
  if (r.renamed.length) {
    lines.push(`${r.renamed.length} would be renamed so nothing is overwritten, e.g. `
      + `${esc(r.renamed[0].was)} \u2192 ${esc(r.renamed[0].now)}.`);
  }
  if (r.albums_made.length) lines.push(`New albums: ${r.albums_made.map(esc).join(", ")}.`);
  if (r.folders_made.length) lines.push(`New folders: ${r.folders_made.map(esc).join(", ")}.`);
  if (r.tags) lines.push(`${r.tags} new tag${r.tags === 1 ? "" : "s"}.`);
  if (r.missing.length) {
    lines.push(`${r.missing.length} record${r.missing.length === 1 ? "" : "s"} point at a file `
      + `that isn't there and would be skipped.`);
  }
  note.innerHTML = lines.join("<br>");
  if (!r.copied) { note.innerHTML += "<br>Nothing to bring across."; return; }

  const yes = await confirmDlg({
    title: "Combine the libraries?",
    body: `${r.copied} photo${r.copied === 1 ? "" : "s"} will be copied into this `
      + `library. KinCrux's copy is not changed, and nothing here is overwritten.`,
    fine: "You can run this again later; photos already brought across are skipped.",
    yes: "Combine",
  });
  if (!yes) return;
  note.textContent = "Copying\u2026";
  const done = await SS.Store.call("photos_merge_run", [], "Combining the libraries");
  if (!done || done.error) { note.textContent = done && done.error ? done.error : "That didn't work."; return; }
  /* Re-read the library so the new photos are there without a restart. */
  data = await SS.Store.load();
  render();
  /* The note is written AFTER the redraw: render() rebuilds Settings, and
     writing it first wiped the one line saying what had happened. */
  const after = document.getElementById("ss-merge-note");
  if (after) {
    after.textContent = `${done.copied} photo${done.copied === 1 ? "" : "s"} brought across`
      + (done.renamed.length ? `, ${done.renamed.length} renamed so nothing was overwritten.` : ".");
  }
  toast(`${done.copied} photo${done.copied === 1 ? "" : "s"} added to your library.`);
}

/* ---- Settings, as subsections ------------------------------------------

   Cam: "i want the settings menu to be like the rest of the app with each
   setting in the right side bar as sub sections of the settings menu,
   default to just the theme selector sub section when opening the
   settings."

   It used to be one page that scrolled through nine labelled groups --
   themes, text size, the library merge, UI scale, the sidebar toggles, the
   library panels -- with no way to jump to any of them. Every other main
   section in the app puts its screens in the right-hand menu; this one now
   does too, and opens on the themes.

   EVERYTHING IS STILL BUILT, and only the chosen section is shown. That is
   deliberate: the wiring below reaches for #set-choose, [data-sec],
   [data-ren-folder] and a dozen others by id, and rendering only the open
   section would mean every one of those needing a guard, with a missed one
   throwing on a page Cam had not even opened. Hiding costs nothing here --
   it is a settings page, not a photo library -- and it keeps the whole of
   the wiring exactly as it was. */
const SET_SECTIONS = {
  appearance: "Appearance",
  size: "Text & scale",
  lite: "Lite mode",
  sidebar: "Sections shown",
  library: "Photo library",
  merge: "Combine libraries",
  stats: "App stats",
  transfer: "Export & import",
  datafolder: "Data folder",
  widgets: "Screensaver",
};
const SET_BLURBS = {
  appearance: "The look of the whole app.",
  size: "How big the words are, and how big everything else is.",
  lite: "NeuroNet lighter to run, for a smaller computer or a laptop on battery.",
  sidebar: "What appears in the menus. Nothing is deleted by hiding it.",
  library: "Where your photos live, and how they are shown.",
  merge: "Bringing KinCrux's photo library in alongside this one.",
  stats: "What is in NeuroNet, and how it is used \u2014 ready for Excel, Word or a board.",
  transfer: "Everything of yours in one file, to move NeuroNet to another computer.",
  datafolder: "Where NeuroNet keeps your things, and moving them to another drive.",
  widgets: "Omarchy's screensaver, with NeuroNet's name or Omarchy's.",
};
const SET_FIRST = "appearance";

function renderSettings(main, which) {
  which = SET_SECTIONS[which] ? which : SET_FIRST;
  const folderCount = data.folders.length;
  main.innerHTML = `    <h2 class="page-h">${esc(SET_SECTIONS[which] || "Settings")}</h2>
    <p class="page-sub">${esc(SET_BLURBS[which] || "")}</p>

    <section class="set-sec" data-set="appearance"${which === "appearance" ? "" : " hidden"}>
    <div class="label">NeuroNet's look</div>
    <div class="th-grid">
      ${Object.entries(CruxTheme.THEMES).map(([key, t]) => `
        <button class="th-card ${CruxTheme.theme === key ? "on" : ""}"
                data-theme="${escA(key)}">
          <span class="th-name">${esc(t.name)}</span>
          <span class="th-blurb">${esc(t.blurb)}</span>
          ${CruxTheme.swatchHtml(key)}
        </button>`).join("")}
    </div>
    <div id="set-glow"></div>
    </section>

    <section class="set-sec" data-set="size"${which === "size" ? "" : " hidden"}>
    ${(() => {
      /* This computer's display (display.js, 2026-10-06): a laptop can be
         compact and brighter while the ultrawide stays roomy. */
      const d = window.NNDisplay ? NNDisplay.get() : {layout: "auto", brightness: 0};
      const seg = (name, val, label, on) => `<button class="seg-btn ${on ? "on" : ""}" data-disp="${name}" data-val="${val}">${label}</button>`;
      return `<div class="disp-box">
      <div class="label">This computer</div>
      <p class="stamp" style="margin:0 0 12px">Kept on this computer only, so a laptop and a
        big monitor can each have their own. UI scale below is this computer's too.</p>
      <div class="disp-row"><span class="disp-name">Layout</span>
        <div class="seg" role="group" aria-label="Layout">
          ${seg("layout", "auto", "Auto", d.layout === "auto")}${seg("layout", "roomy", "Roomy", d.layout === "roomy")}${seg("layout", "compact", "Compact", d.layout === "compact")}
        </div></div>
      <p class="stamp" style="margin:6px 0 14px">Compact: the menu as icons, less space around
        everything, and Training's tags on one row. Auto is compact when the window is narrower
        than ${window.NNDisplay ? NNDisplay.COMPACT_BELOW : 1500} points${isCompact() ? " — <b>it is now</b>" : ""}.</p>
      <div class="disp-row"><span class="disp-name">Brightness</span>
        <div class="seg" role="group" aria-label="Brightness">
          ${seg("brightness", 0, "Normal", d.brightness === 0)}${seg("brightness", 1, "Brighter", d.brightness === 1)}${seg("brightness", 2, "Brightest", d.brightness === 2)}
        </div></div>
      <p class="stamp" style="margin:6px 0 22px">Lifts a dark theme's backgrounds and makes its
        text lighter (a light theme's text darker), for a dim screen. Pictures stay as they are.
        For the strongest contrast, choose the High contrast theme in Appearance.</p>
      </div>`;
    })()}
<div class="label">Text size</div>
    <div class="seg">
      ${Object.entries(CruxTheme.TEXT_SIZES).map(([key, s]) => `
        <button class="seg-btn ${CruxTheme.textSize === key ? "on" : ""}"
                data-text="${escA(key)}">${esc(s.name)}</button>`).join("")}
    </div>
    <p class="stamp" style="margin:12px 0 22px">Text size grows the words.
      To make everything bigger &mdash; buttons, spacing and icons too &mdash;
      use UI scale below. The two work together.</p>
<div class="label">UI scale</div>
    <div class="seg" role="group" aria-label="UI scale">
      ${UI_SCALES.map((z) => `
        <button class="seg-btn ${uiScale === z ? "on" : ""}" data-ui-scale="${z}">
          ${Math.round(z * 100)}%</button>`).join("")}
    </div>
    <p class="stamp" style="margin:12px 0 22px">Scales the whole app &mdash;
      every tool, every screen &mdash; on this computer.</p>
    </section>

    <section class="set-sec" data-set="sidebar"${which === "sidebar" ? "" : " hidden"}>
    <p class="stamp" style="margin:0 0 12px">Turn off what you do not use.
      Nothing is deleted, and search still finds everything inside a
      hidden section \u2014 it just stops taking up room in the sidebar.
      Its keyboard shortcut (Super + Alt + its key) is switched off too.</p>
    <p class="stamp" style="margin:0 0 12px">\u201cMore\u201d keeps a section in the sidebar
      but tucks it into a group at the foot that opens when you press it. You can also drag a
      section onto More in the sidebar (hold the right mouse button), and drag it back out.</p>
    ${SECTIONS.filter((s) => s.key !== "settings").map((s) => `
      <div class="sec-row ${sectionOn(s.key) ? "" : "is-off"}">
        <span class="sec-name">${esc(s.name)}</span>
        ${SECTION_META[s.key] && s.key !== "home" ? `<button class="chip chip-sm ${moreSections.has(s.key) ? "on" : ""}"
          data-more-sec="${escA(s.key)}" aria-pressed="${moreSections.has(s.key)}"
          title="Put ${escA(s.name)} in the sidebar's More group">In More</button>` : ""}
        <button class="toggle ${sectionOn(s.key) ? "on" : ""}"
                data-sec="${escA(s.key)}"
                aria-label="${escA(s.name)}"></button>
      </div>
      ${(s.children || []).map((c) => `
        <div class="sec-row sub ${sectionOn(c.key) ? "" : "is-off"}">
          <span class="sec-name">${esc(c.name)}</span>
          <button class="toggle ${sectionOn(c.key) ? "on" : ""}"
                  data-sec="${escA(c.key)}"
                  ${sectionOn(s.key) ? "" : "disabled"}
                  aria-label="${escA(c.name)}"></button>
        </div>`).join("")}`).join("")}
    </section>

    <section class="set-sec" data-set="library"${which === "library" ? "" : " hidden"}>

    <div class="panel" style="margin-bottom:16px">
      <div class="label" style="margin-top:0">Shared library</div>
      <p class="stamp" style="line-height:1.6;margin:0 0 12px">
        Photos, albums, folders and tags live in Camily's data folder, so
        anything filed here shows up there and the other way round.
        Capture only ever writes the photo side of that file \u2014 your
        calendar, contacts and dashboard are never touched.</p>
      <div class="vw-detail-grid" style="margin-bottom:14px">
        <div><span>Folder</span><b>${esc(libraryRoot || "Not found")}</b></div>
        <div><span>Photos</span><b>${data.photos.length}</b></div>
        <div><span>Albums</span><b>${data.albums.length}</b></div>
        <div><span>Folders</span><b>${folderCount}</b></div>
        <div><span>Tags</span><b>${data.photoTagList.length}</b></div>
      </div>
      <button class="btn" id="set-choose">Choose a different folder\u2026</button>
    </div>

    <div class="panel" style="margin-bottom:16px">
      <div class="label" style="margin-top:0">Thumbnail size</div>
      <input type="range" min="120" max="280" step="4" value="${tileSize}"
             id="set-tile" style="width:100%;max-width:340px">
      <p class="stamp" style="margin:6px 0 0">${tileSize}px</p>
    </div>

    ${folderCount || data.albums.length ? `<div class="panel">
      <div class="label" style="margin-top:0">Manage</div>
      ${data.folders.length ? `<p class="stamp" style="margin:0 0 8px">Folders</p>
        ${[...data.folders].sort((a, b) => folderPath(a).localeCompare(folderPath(b)))
          .map((f) => `<div class="manage-row">
            <span>${esc(folderPath(f))}</span>
            <button class="btn btn-quiet btn-sm" data-ren-folder="${escA(f.id)}">Rename</button>
            <button class="btn btn-quiet btn-sm" data-del-folder="${escA(f.id)}">${ic("i-trash")}</button>
          </div>`).join("")}` : ""}
      ${data.albums.length ? `<p class="stamp" style="margin:14px 0 8px">Albums</p>
        ${[...data.albums].sort((a, b) => a.name.localeCompare(b.name))
          .map((a) => `<div class="manage-row">
            <span>${esc(a.name)}</span>
            <button class="btn btn-quiet btn-sm" data-ren-album="${escA(a.id)}">Rename</button>
            <button class="btn btn-quiet btn-sm" data-del-album="${escA(a.id)}">${ic("i-trash")}</button>
          </div>`).join("")}` : ""}
    </div>` : ""}
    </section>

    <section class="set-sec" data-set="merge"${which === "merge" ? "" : " hidden"}>
    <p class="stamp" style="margin:0 0 10px">The two apps merged, and their
      photo libraries can be combined. KinCrux's copy is never changed &mdash;
      photos are copied across, a name clash keeps both, and a photo already
      here is left alone. Have a look first; nothing is written until you say so.</p>
    <div class="seg" role="group" aria-label="Combine libraries">
      <button class="seg-btn" id="ss-merge-preview">See what would happen</button>
    </div>
    <p class="stamp" style="margin:12px 0 22px" id="ss-merge-note"></p>
    </section>

    <section class="set-sec" data-set="lite"${which === "lite" ? "" : " hidden"}>
    <div id="set-lite"></div>
    </section>

    <section class="set-sec" data-set="stats"${which === "stats" ? "" : " hidden"}>
    <div id="set-stats"></div>
    </section>

    <section class="set-sec" data-set="transfer"${which === "transfer" ? "" : " hidden"}>
    <div id="set-transfer"></div>
    </section>

    <section class="set-sec" data-set="datafolder"${which === "datafolder" ? "" : " hidden"}>
    <div id="set-datafolder"></div>
    </section>

    <section class="set-sec" data-set="widgets"${which === "widgets" ? "" : " hidden"}>
    <div id="set-widgets"></div>
    </section>
`;


  main.querySelector("#set-choose").onclick = async () => {
    const r = await SS.Store.chooseLibrary();
    if (r.cancelled) return;
    if (r.error) { toast(r.error, "error"); return; }
    libraryRoot = r.root;
    data = await SS.Store.load();
    render();
    toast("Library changed.", "good");
  };


  const tile = main.querySelector("#set-tile");
  tile.addEventListener("input", () => {
    tileSize = +tile.value;
    main.querySelector("#set-tile").nextElementSibling.textContent = tileSize + "px";
  });
  tile.addEventListener("change", () => SS.Store.setPrefs({tileSize}));

  main.querySelectorAll("[data-ren-folder]").forEach((b) =>
    b.addEventListener("click", async () => {
      const f = data.folders.find((x) => x.id === b.dataset.renFolder);
      const name = await promptText("Rename folder", "Name", f.name);
      if (!(name || "").trim()) return;
      f.name = name.trim();
      await save();
      render();
    }));
  main.querySelectorAll("[data-del-folder]").forEach((b) =>
    b.addEventListener("click", () => deleteFolder(b.dataset.delFolder)));
  main.querySelectorAll("[data-ren-album]").forEach((b) =>
    b.addEventListener("click", async () => {
      const a = data.albums.find((x) => x.id === b.dataset.renAlbum);
      const name = await promptText("Rename album", "Name", a.name);
      if (!(name || "").trim()) return;
      a.name = name.trim();
      await save();
      render();
    }));
  main.querySelectorAll("[data-del-album]").forEach((b) =>
    b.addEventListener("click", () => deleteAlbum(b.dataset.delAlbum)));
  wireSettingsAppearance(main);
  if (which === "stats" && SS.Stats) SS.Stats.render(main.querySelector("#set-stats"));
  if (which === "transfer" && SS.Transfer) SS.Transfer.render(main.querySelector("#set-transfer"));
  if (which === "datafolder" && SS.DataFolder) SS.DataFolder.render(main.querySelector("#set-datafolder"));
  if (which === "widgets" && SS.DesktopWidgets) SS.DesktopWidgets.render(main.querySelector("#set-widgets"));
  if (which === "lite" && window.NNLite) NNLite.renderSettings(main.querySelector("#set-lite"));
  if (which === "appearance" && SS.WindowGlow) SS.WindowGlow.render(main.querySelector("#set-glow"));
}

async function deleteFolder(id) {
  const folder = data.folders.find((f) => f.id === id);
  if (!folder) return;
  const kids = descendantFolderIds(id);
  const ids = new Set([id, ...kids]);
  const affected = data.photos.filter((p) => ids.has(p.folderId)).length;
  const ok = await confirmDlg({
    title: `Delete "${folder.name}"?`,
    body: `The folder${kids.length ? ` and its ${kids.length} sub-folder${
      kids.length === 1 ? "" : "s"}` : ""} will go. `
      + (affected ? `The ${affected} photo${affected === 1 ? "" : "s"} inside `
        + `stay in your library \u2014 they just won't be filed here any more.`
        : "It's empty, so nothing else changes."),
    yes: "Delete folder"});
  if (!ok) return;
  for (const p of data.photos) if (ids.has(p.folderId)) p.folderId = "";
  data.folders = data.folders.filter((f) => !ids.has(f.id));
  if (view.startsWith("folder:") && ids.has(view.slice(7))) view = "all";
  await save();
  render();
  toast("Folder deleted.");
}

async function deleteAlbum(id) {
  const album = data.albums.find((a) => a.id === id);
  if (!album) return;
  const n = data.photos.filter((p) => (p.albumIds || []).includes(id)).length;
  const ok = await confirmDlg({
    title: `Delete "${album.name}"?`,
    body: n ? `The album goes, but its ${n} photo${n === 1 ? "" : "s"} stay `
      + "in your library." : "This album is empty.",
    yes: "Delete album"});
  if (!ok) return;
  data.albums = data.albums.filter((a) => a.id !== id);
  for (const p of data.photos) {
    if (Array.isArray(p.albumIds)) {
      p.albumIds = p.albumIds.filter((x) => x !== id);
    }
  }
  if (view === "album:" + id) view = "all";
  await save();
  render();
  toast("Album deleted.");
}

/* -------------------------------------------------------------- boot --- */
async function boot() {
  await SS.Store.ready;

  /* Once, on the document. The pointer drag has to keep following the
     cursor over the menu, the bars and the empty page, none of which the
     gallery owns -- and wiring it per render would stack a new listener
     on every navigation. */
  wirePhotoDragGlobals();

  const info = await SS.Store.libraryInfo();
  libraryRoot = info.root || "";
  data = await SS.Store.load();
  /* Camily's calendar and contacts code assumes these exist; a library
     file written by an older build won't have them */
  data.events = data.events || [];
  data.contacts = data.contacts || [];
  /* the cookery half. A library file written before the merge has none
     of these, and every cookery screen assumes they exist. */
  data.recipes = data.recipes || [];
  data.menus = data.menus || [];
  data.shoppingLists = data.shoppingLists || [];
  data.books = data.books || [];
  data.tagList = (data.tagList && data.tagList.length)
    ? data.tagList : ["Sweet", "Bread", "Chicken", "Beef"];
  data.folders = data.folders || [];
  data.photoTagList = data.photoTagList || [];

  const prefs = await SS.Store.getPrefs();
  /* themes.js already applied the cached theme before first paint; this
     is where the real stored preference gets the last word, and the
     cache is corrected if the two disagree. */
  CruxTheme.adoptFromPrefs(prefs);
  refreshOmarchyTheme();
  if (prefs && Array.isArray(prefs.hiddenSections)) {
    hiddenSections = new Set(prefs.hiddenSections);
  }
  await migrateTrainingNav(prefs);
  await hideScribeOnce(prefs);
  /* in the background: the app needn't wait for 700 files to be renamed */
  setTimeout(() => namePhotoFilesOnce(prefs).catch(() => {}), 4000);
  if (prefs && Array.isArray(prefs.moreSections)) moreSections = new Set(prefs.moreSections);
  if (prefs && prefs.navOrder && typeof prefs.navOrder === "object") {
    navOrder = {sections: prefs.navOrder.sections || [],
                children: prefs.navOrder.children || {}};
  }
  if (prefs && Array.isArray(prefs.favourites)) {
    favourites = prefs.favourites.map((k) => MOVED_VIEWS[k] || k);
  }
  /* Cam: "by default favorites is the Main Section that is open when i open
     the app" -- and the favourites live on Home. The app opens there rather
     than wherever it was last left. */
  view = "home:dashboard";
  if (prefs && typeof prefs.view === "string" && prefs.openWhereLeftOff) view = prefs.view;
  if (prefs && typeof prefs.sortBy === "string") sortBy = prefs.sortBy;
  if (prefs && Number.isFinite(prefs.tileSize)) tileSize = prefs.tileSize;
  /* UI scale is this computer's (2026-10-06): the laptop and the ultrawide
     each keep their own -- the shared preference only until it's set here */
  let ownScale = NaN;
  try { ownScale = Number(localStorage.getItem("ss:uiScale")); } catch (e) { /* none */ }
  applyUiScale(UI_SCALES.includes(ownScale) ? ownScale : prefs && Number.isFinite(prefs.uiScale) ? prefs.uiScale : 1);
  applyNavCollapsed(!!(prefs && prefs.navCollapsed === true));
  applySubnavCollapsed(!!(prefs && prefs.subnavCollapsed === true));
  pageTabs = !(prefs && prefs.pageTabs === false);
  const toTabs = $("ss-subnav-tabs");
  if (toTabs) toTabs.onclick = () => setPageTabs(true);
  $("ss-subnav-collapse").onclick = async () => {
    applySubnavCollapsed(!subnavCollapsed);
    await SS.Store.setPrefs({subnavCollapsed});
  };
  window.addEventListener("keydown", (e) => {
    if (e.key !== "F9" || e.ctrlKey || e.altKey || e.metaKey) return;
    e.preventDefault();
    applyBarsHidden(!barsHidden, true);
  });
  /* F8: in Multitask, the active side's subsection strip -- and only that
     side's. Cam: "F8 should be used as the shortcut to hide the sidebars in
     the split windows. This is to avoid hiding sub section bars i may need.
     F9 should hide all the other navigation bars as normal." */
  window.addEventListener("keydown", (e) => {
    if (e.key !== "F8" || e.ctrlKey || e.altKey || e.metaKey || !MT.on) return;
    e.preventDefault();
    mtToggleSubnav();
  });
  if (prefs && prefs.multitask && typeof prefs.multitask === "object") MT.last = prefs.multitask;
  const snipBtn = $("ss-snip");
  if (snipBtn) {
    snipBtn.onclick = () => takeSnip("smart");
    snipBtn.addEventListener("contextmenu", (e) => { e.preventDefault(); snipMenu(snipBtn); });
  }
  const mtBtn = $("ss-multitask");
  if (mtBtn) mtBtn.onclick = () => mtToggle();
  const quickFull = $("ss-quick-full");
  if (quickFull) quickFull.onclick = () => {
    const api = window.pywebview && window.pywebview.api;
    if (api && api.quick_full) api.quick_full();
  };
  $("ss-collapse").onclick = async () => {
    if (isCompact()) { navOpenInCompact = !navOpenInCompact; paintNavCollapsed(); return; }
    applyNavCollapsed(!navCollapsed);
    await SS.Store.setPrefs({navCollapsed});
  };

  $("ss-add").onclick = () => addPhotosFlow();
  /* Cam: "default to just the theme selector sub section when opening the
     settings please."

     SECTION_META.settings.first, not the string spelled out again here, and
     not firstViewOf(): that one remembers where you were last in a section,
     which is right for Photos or Training and wrong here -- Cam asked for
     the theme selector when he opens Settings, not for wherever he left
     off. Reading the same key the rest of the router reads keeps one
     answer to "which settings page is the first one". */
  $("ss-settings").onclick = () => {
    view = SECTION_META.settings.first;
    render();
  };
  wireDrop();

  render();
  /* Multitask comes back on its own only for someone who has asked the app
     to open where they left off; otherwise the app opens on Home, as Cam
     asked, and the button brings the last layout straight back. */
  if (prefs && prefs.openWhereLeftOff && MT.last && MT.last.on) enterMultitask(MT.last);

  addPuzzleSections();
  trainingToNeurotrain();
  /* The page is up: what neuronet-quick or a bar widget asked for before it was runs now (mpris.py). The
     music player's first report used to say this, until the music went to NeuroStream (19 Nov 2026). */
  try { const api = window.pywebview && window.pywebview.api; if (api && api.app_bus_ready) api.app_bus_ready(); } catch (e) { /* no bus: nothing waits */ }

  /* A new computer (NeuroNet System plan, Stage 3): the welcome -- bring a
     NeuroNet across, or start fresh -- rather than a warning about a
     library that was never here. */
  /* The data is on a drive that isn't plugged in (Settings -> Data folder
     can put it there): say so and wait, rather than open an empty library
     or offer a new computer's welcome over it. */
  if (info.missing && SS.DataFolder) {
    SS.DataFolder.showMissing(info.missing);
    return;
  }
  const welcoming = SS.Welcome ? await SS.Welcome.maybeShow() : false;

  /* Said plainly rather than showing an empty library, which would look
     exactly as though every photo had been lost. */
  if (!info.found && !welcoming) {
    toast("Couldn't find Camily's library \u2014 pick the folder in Settings.",
      "error");
  }

  backfillTakenDates();
  refreshCollabFresh();
}

/* I20 (8 Nov 2026, the team's idea; Cam: a pop-up when something new lands in Collaboration "will allow it to prompt me
   to check collaboration"): the pop-up goes after 20 seconds, so the app says it too -- a count on Scribe and on
   Collaboration of what's new since Cam last looked (collab.py fresh()). Asked again when NeuroNet comes into view and
   every few minutes while it's in view (never while it's tucked away); Collaboration itself passes on what it clears. */
let collabNew = 0;
SS.collabFresh = (f) => {
  const n = Math.max(0, (f && f.total) | 0);
  if (n !== collabNew) { collabNew = n; renderSidebar(); }
};
async function refreshCollabFresh() {
  if (document.hidden) return;
  const f = await SS.Store.call("collab_fresh", [], "What's new in Collaboration");
  if (f && !f.error) SS.collabFresh(f);
}
const collabBadge = () => collabNew
  ? `<span class="ss-nav-new" title="${collabNew} new in Collaboration" aria-label="${collabNew} new">${collabNew}</span>` : "";
document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshCollabFresh(); });
setInterval(refreshCollabFresh, 180000);

/** Photos added before EXIF dates were read have no takenDate, so they
    sort by import date instead. Filled in once, in the background. */
async function backfillTakenDates() {
  const missing = data.photos.filter((p) => !p.takenDate);
  if (!missing.length) return;
  try {
    const result = await SS.Store.takenDates(missing.map((p) => p.storedName));
    const dates = (result && result.dates) || {};
    let changed = false;
    for (const p of missing) {
      if (dates[p.storedName]) { p.takenDate = dates[p.storedName]; changed = true; }
    }
    if (changed) { await save(); render(); }
  } catch (err) {
    /* sorting falls back to import dates, which is what it did before */
  }
}

window.addEventListener("DOMContentLoaded", boot);
document.addEventListener("contextmenu", (e) => e.preventDefault());



/* ############################################################################
   FROM CAMILY — calendar, contacts and the dashboard
   ############################################################################
   Cam asked for Camily's features folded into Capture under one name.
   These sections come across from Camily rather than being rewritten:
   they are already proven and tested, and reimplementing a working
   recurrence engine would only introduce new bugs.

   What changed: Camily's own photo widgets now read Hearth's photo
   data (the same shape, so they carry over), and its album manager was
   dropped because Capture's Settings already manages albums AND
   folders, which Camily's did not.
   ############################################################################ */

/* ============================================================================
   THE EDITOR
   ============================================================================
   Cam asked where the edit options were, and the honest answer was that
   they weren't there — the app was built out around organising and the
   editing never got wired in.

   The pixel pipeline is lifted from Camily's, which is proven and
   tested, rather than rewritten. What's new here is the layout: one
   row of controls under the photo, matching the Capture reference Cam
   showed, with the finer adjustments behind a toggle.
   ============================================================================ */

function pxGrayscale(d0) {
  const d = d0.data;
  for (let i = 0; i < d.length; i += 4) {
    const g = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
    d[i] = d[i + 1] = d[i + 2] = g;
  }
}
function pxSepia(d0) {
  const d = d0.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    d[i] = Math.min(255, 0.393 * r + 0.769 * g + 0.189 * b);
    d[i + 1] = Math.min(255, 0.349 * r + 0.686 * g + 0.168 * b);
    d[i + 2] = Math.min(255, 0.272 * r + 0.534 * g + 0.131 * b);
  }
}
function pxInvert(d0) {
  const d = d0.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = 255 - d[i]; d[i + 1] = 255 - d[i + 1]; d[i + 2] = 255 - d[i + 2];
  }
}
function pxVintage(d0) {
  pxSepia(d0);
  const d = d0.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = Math.min(255, d[i] * 0.92 + 12);
    d[i + 1] = Math.min(255, d[i + 1] * 0.90 + 8);
    d[i + 2] = Math.max(0, d[i + 2] * 0.85);
  }
}
function pxCool(d0) {
  const d = d0.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = Math.max(0, d[i] * 0.90);
    d[i + 2] = Math.min(255, d[i + 2] * 1.10 + 6);
  }
}
function pxFaded(d0) {
  /* lifts the blacks and pulls the contrast in — the washed-out film
     look, which needs a lift as well as a reduction or it just goes
     grey */
  const d = d0.data;
  for (let i = 0; i < d.length; i += 4) {
    for (let k = 0; k < 3; k++) {
      d[i + k] = Math.max(0, Math.min(255, d[i + k] * 0.82 + 34));
    }
  }
}
function pxBrightness(d0, value) {
  if (!value) return;
  const delta = value * 2.55;
  const d = d0.data;
  for (let i = 0; i < d.length; i += 4) {
    for (let k = 0; k < 3; k++) {
      d[i + k] = Math.max(0, Math.min(255, d[i + k] + delta));
    }
  }
}
function pxContrast(d0, value) {
  if (!value) return;
  const factor = (259 * (value * 2.55 + 255)) / (255 * (259 - value * 2.55));
  const d = d0.data;
  for (let i = 0; i < d.length; i += 4) {
    for (let k = 0; k < 3; k++) {
      d[i + k] = Math.max(0, Math.min(255, factor * (d[i + k] - 128) + 128));
    }
  }
}
function pxSaturation(d0, value) {
  if (!value) return;
  const factor = 1 + value / 100;
  const d = d0.data;
  for (let i = 0; i < d.length; i += 4) {
    const gray = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
    for (let k = 0; k < 3; k++) {
      d[i + k] = Math.max(0, Math.min(255, gray + (d[i + k] - gray) * factor));
    }
  }
}

const FILTERS = {
  none: {label: "Original", fn: null},
  grayscale: {label: "Mono", fn: pxGrayscale},
  sepia: {label: "Sepia", fn: pxSepia},
  vintage: {label: "Warm", fn: pxVintage},
  cool: {label: "Cool", fn: pxCool},
  faded: {label: "Faded", fn: pxFaded},
  invert: {label: "Invert", fn: pxInvert},
};

function newEdits() {
  return {filter: "none", brightness: 0, contrast: 0, saturation: 0,
    rotate: 0, flipH: false, flipV: false, crop: null};
}

/** sourceCanvas -> a new canvas with rotate/flip, then filter and
    adjustments, then crop, in that order.

    A pure function of (canvas, edits): the same inputs always give the
    same output, which is what makes it testable without any UI. */
function applyEdits(sourceCanvas, edits) {
  const doc = sourceCanvas.ownerDocument || document;
  const sw = sourceCanvas.width, sh = sourceCanvas.height;
  const rotated = (edits.rotate === 90 || edits.rotate === 270);
  const rw = rotated ? sh : sw, rh = rotated ? sw : sh;

  const step1 = doc.createElement("canvas");
  step1.width = rw; step1.height = rh;
  const ctx = step1.getContext("2d");
  ctx.save();
  ctx.translate(rw / 2, rh / 2);
  if (edits.rotate) ctx.rotate((edits.rotate * Math.PI) / 180);
  ctx.scale(edits.flipH ? -1 : 1, edits.flipV ? -1 : 1);
  ctx.drawImage(sourceCanvas, -sw / 2, -sh / 2);
  ctx.restore();

  const fn = (FILTERS[edits.filter] || {}).fn;
  if (fn || edits.brightness || edits.contrast || edits.saturation) {
    const img = ctx.getImageData(0, 0, rw, rh);
    if (fn) fn(img);
    pxBrightness(img, edits.brightness);
    pxContrast(img, edits.contrast);
    pxSaturation(img, edits.saturation);
    ctx.putImageData(img, 0, 0);
  }

  if (!edits.crop) return step1;
  const {x, y, w, h} = edits.crop;
  const cx = Math.round(x * rw), cy = Math.round(y * rh);
  const cw = Math.max(1, Math.round(w * rw)), ch = Math.max(1, Math.round(h * rh));
  const step2 = doc.createElement("canvas");
  step2.width = cw; step2.height = ch;
  step2.getContext("2d").drawImage(step1, cx, cy, cw, ch, 0, 0, cw, ch);
  return step2;
}

let edSource = null;      // the loaded image, as a canvas
let edEdits = newEdits();
let edPhoto = null;
let edCropDrag = null;

async function openEditor(photo) {
  edPhoto = photo;
  edEdits = newEdits();
  const veil = $("editor-veil");
  veil.innerHTML = `<div class="editor"><p class="stamp">Loading&hellip;</p></div>`;
  veil.classList.add("open");

  const result = await SS.Store.full(photo.storedName);
  if (!result || !result.dataUrl) {
    toast((result && result.error) || "Couldn't open that photo.", "error");
    closeEditor();
    return;
  }
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    canvas.getContext("2d").drawImage(img, 0, 0);
    edSource = canvas;
    paintEditor();
  };
  img.onerror = () => { toast("Couldn't read that image.", "error"); closeEditor(); };
  img.src = result.dataUrl;
}

function closeEditor() {
  const veil = $("editor-veil");
  veil.classList.remove("open");
  veil.innerHTML = "";
  edSource = null;
  edPhoto = null;
  edCropDrag = null;
  window.removeEventListener("keydown", editorKeys);
}

function editorKeys(e) {
  if (e.key === "Escape") {
    /* Escape clears a crop selection first, and only closes the editor
       if there isn't one — otherwise a mis-drag would throw away every
       other edit too */
    if (edEdits.crop) { edEdits.crop = null; paintEditor(); return; }
    closeEditor();
  }
}

function paintEditor() {
  const veil = $("editor-veil");
  const dirty = JSON.stringify(edEdits) !== JSON.stringify(newEdits());

  veil.innerHTML = `
    <div class="editor">
      <button class="vw-close" id="ed-close">${ic("i-x")}</button>
      <div class="ed-stage">
        <div class="ed-wrap" id="ed-wrap"><canvas id="ed-canvas"></canvas></div>
      </div>

      <div class="ed-bar">
        <button class="btn btn-sm" id="ed-rot-l" title="Rotate left">&#8634;</button>
        <button class="btn btn-sm" id="ed-rot-r" title="Rotate right">&#8635;</button>
        <button class="btn btn-sm" id="ed-flip-h" title="Flip across">&#8596;</button>
        <button class="btn btn-sm ${edEdits.crop ? "btn-primary" : ""}"
                id="ed-crop">${edEdits.crop ? "Apply crop" : "Crop"}</button>

        <div class="ed-filters">
          ${Object.entries(FILTERS).map(([key, f]) => `
            <button class="chip ${edEdits.filter === key ? "on" : ""}"
                    data-filter="${key}">${esc(f.label)}</button>`).join("")}
        </div>

        <span class="spacer"></span>
        <button class="btn btn-sm btn-quiet" id="ed-adjust">Adjust</button>
        ${dirty ? `<button class="btn btn-sm btn-quiet" id="ed-reset">Reset</button>` : ""}
        <button class="btn btn-sm" id="ed-copy">Save as copy</button>
        <button class="btn btn-sm btn-primary" id="ed-save">Save</button>
      </div>

      <div class="ed-adjust" id="ed-adjust-panel" hidden>
        ${[["brightness", "Brightness"], ["contrast", "Contrast"],
           ["saturation", "Saturation"]].map(([key, label]) => `
          <div class="ed-slider">
            <label>${label} <span id="ed-${key}-v">${edEdits[key]}</span></label>
            <input type="range" min="-100" max="100" value="${edEdits[key]}"
                   data-adj="${key}">
          </div>`).join("")}
      </div>

      <p class="ed-hint">Drag across the photo to crop.
        <b>Save</b> replaces this photo everywhere it's used \u2014 including
        in Camily. <b>Save as copy</b> leaves the original alone.</p>
    </div>`;

  window.addEventListener("keydown", editorKeys);
  veil.querySelector("#ed-close").onclick = closeEditor;

  veil.querySelector("#ed-rot-l").onclick = () => {
    edEdits.rotate = (edEdits.rotate + 270) % 360;
    edEdits.crop = null;      // a crop is meaningless once it rotates
    paintEditor();
  };
  veil.querySelector("#ed-rot-r").onclick = () => {
    edEdits.rotate = (edEdits.rotate + 90) % 360;
    edEdits.crop = null;
    paintEditor();
  };
  veil.querySelector("#ed-flip-h").onclick = () => {
    edEdits.flipH = !edEdits.flipH;
    paintEditor();
  };

  veil.querySelector("#ed-crop").onclick = () => {
    if (!edEdits.crop) {
      toast("Drag across the photo to choose an area.");
      return;
    }
    /* bake the crop into the source, so further edits work from the
       cropped image rather than stacking crops on crops */
    edSource = applyEdits(edSource, edEdits);
    edEdits = newEdits();
    paintEditor();
  };

  veil.querySelectorAll("[data-filter]").forEach((b) =>
    b.addEventListener("click", () => {
      edEdits.filter = b.dataset.filter;
      paintEditor();
    }));

  const adjustBtn = veil.querySelector("#ed-adjust");
  adjustBtn.onclick = () => {
    const panel = veil.querySelector("#ed-adjust-panel");
    panel.hidden = !panel.hidden;
    adjustBtn.classList.toggle("btn-primary", !panel.hidden);
  };
  veil.querySelectorAll("[data-adj]").forEach((slider) =>
    slider.addEventListener("input", () => {
      edEdits[slider.dataset.adj] = +slider.value;
      const label = veil.querySelector(`#ed-${slider.dataset.adj}-v`);
      if (label) label.textContent = slider.value;
      redrawEditor();
    }));

  const resetBtn = veil.querySelector("#ed-reset");
  if (resetBtn) resetBtn.onclick = () => { edEdits = newEdits(); paintEditor(); };

  veil.querySelector("#ed-save").onclick = () => commitEdit(false);
  veil.querySelector("#ed-copy").onclick = () => commitEdit(true);

  wireCrop(veil);
  redrawEditor();
}

/** Repaints the preview without rebuilding the controls — so dragging
    a slider doesn't tear down the slider being dragged. */
function redrawEditor() {
  const canvas = $("ed-canvas");
  if (!canvas || !edSource) return;
  const out = applyEdits(edSource, {...edEdits, crop: null});
  canvas.width = out.width;
  canvas.height = out.height;
  canvas.getContext("2d").drawImage(out, 0, 0);
  paintCropBox();
}

function wireCrop(veil) {
  const wrap = veil.querySelector("#ed-wrap");
  if (!wrap) return;
  const rel = (e) => {
    const r = wrap.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
      y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
    };
  };
  wrap.addEventListener("pointerdown", (e) => {
    edCropDrag = rel(e);
    edEdits.crop = null;
    wrap.setPointerCapture(e.pointerId);
  });
  wrap.addEventListener("pointermove", (e) => {
    if (!edCropDrag) return;
    const now = rel(e);
    edEdits.crop = {
      x: Math.min(edCropDrag.x, now.x), y: Math.min(edCropDrag.y, now.y),
      w: Math.abs(now.x - edCropDrag.x), h: Math.abs(now.y - edCropDrag.y),
    };
    paintCropBox();
  });
  wrap.addEventListener("pointerup", () => {
    edCropDrag = null;
    /* a stray click leaves a sliver of a crop; treat anything tiny as
       no selection rather than cropping the photo to nothing */
    if (edEdits.crop && (edEdits.crop.w < 0.02 || edEdits.crop.h < 0.02)) {
      edEdits.crop = null;
    }
    paintEditor();
  });
}

function paintCropBox() {
  const wrap = $("ed-wrap");
  if (!wrap) return;
  let box = wrap.querySelector(".ed-crop-box");
  if (!edEdits.crop) { if (box) box.remove(); return; }
  if (!box) {
    box = document.createElement("div");
    box.className = "ed-crop-box";
    wrap.appendChild(box);
  }
  const c = edEdits.crop;
  box.style.left = c.x * 100 + "%";
  box.style.top = c.y * 100 + "%";
  box.style.width = c.w * 100 + "%";
  box.style.height = c.h * 100 + "%";
}

async function commitEdit(asCopy) {
  if (!edSource || !edPhoto) return;
  const out = applyEdits(edSource, edEdits);
  const dataUrl = out.toDataURL("image/png");
  const stored = await SS.Store.storeDataUrl(dataUrl);
  if (stored.error) { toast(stored.error, "error"); return; }

  if (asCopy) {
    /* a genuinely separate photo, filed alongside its original so it
       doesn't land in limbo — but with its own record, so editing the
       copy can never touch the original */
    data.photos.unshift({
      ...blankPhoto({}),
      storedName: stored.storedName,
      originalName: edPhoto.originalName,
      caption: (nameOf(edPhoto) || "Photo") + " (edited)",
      tags: [...(edPhoto.tags || [])],
      albumIds: [...(edPhoto.albumIds || [])],
      folderId: edPhoto.folderId || "",
      takenDate: edPhoto.takenDate || "",
    });
    await save();
    closeEditor();
    render();
    toast("Saved as a copy \u2014 the original is untouched.", "good");
    return;
  }

  const oldStored = edPhoto.storedName;
  edPhoto.storedName = stored.storedName;
  await save();
  await SS.Store.del(oldStored);
  invalidateThumb(oldStored);
  closeEditor();
  render();
  toast("Photo saved.", "good");
}


/* Which screen is open, and the section it belongs to -- read by App stats
   to share out time in the app by section. A function, not a copy, so it is
   never a render behind. */
SS.where = () => ({view, section: sectionOf(view)});
SS.sectionName = (key) => sectionName(key) || (key === "settings" ? "Settings" : "");

/* Exposed for the tests, which cannot reach into module scope. Only the
   photo library's own names -- the calendar, contacts and dashboard
   entries this list carried in KinCrux went with those modules. */
SS._test = {
  /* the picker and the rename that carries references */
  pickFromLibrary, photoSearch, renamePhotoEverywhere, PICKER_LIMIT,
  get data() { return data; },
  get view() { return view; },
  _setView: (v) => { view = v; },
  sectionOf,
  get query() { return query; },
  _setQuery: (q) => { query = q; },
  get selection() { return selection; },
  get selecting() { return selecting; },
  _setSelecting: (v) => { selecting = v; },
  render, renderSidebar, renderLibrary, renderSettings,
  photosForView, currentPhotos, matchesQuery, descendantFolderIds,
  folderPath, importTargets, blankPhoto, openViewer, closeViewer,
  paintViewer, rateCurrent, deleteFolder, deleteAlbum, importFiles,
  addPhotosFlow, newFolderFlow, newAlbumFlow, viewTitle,
};

SS._test.openEditor = openEditor;
SS._test.closeEditor = closeEditor;
SS._test.paintEditor = paintEditor;
SS._test.applyEdits = applyEdits;
SS._test.enterAnswersBox = enterAnswersBox;
SS._test.shownBox = shownBox;
SS._test.newEdits = newEdits;
SS._test.FILTERS = FILTERS;
SS._test.commitEdit = commitEdit;
SS._test.thumbFor = thumbFor;
SS._test.paintThumbs = paintThumbs;
SS._test.preloadRest = preloadRest;
SS._test.invalidateThumb = invalidateThumb;
SS._test.art = SS.Art;
SS._test.get_edEdits = () => edEdits;
SS._test._setEdits = (e) => { edEdits = e; };
SS._test._setEdSource = (c) => { edSource = c; };
SS._test._setEdPhoto = (p) => { edPhoto = p; };
