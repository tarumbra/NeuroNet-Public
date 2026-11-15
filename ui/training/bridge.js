/* ==========================================================================
   Training — the bridge between Coach Cam's modules and KinCrux's shell.
   ==========================================================================
   Coach Cam's files expect three things from their host: CF.Store (its
   own storage.js provides that), CF.toast and CF.go. In the original
   those last two came from its app.js, which is also its window shell —
   sidebar, topbar, detail pane, sheet host, the lot.

   This file supplies them from KinCrux instead, so the modules run
   unchanged. It must load BEFORE any of them, because they assign
   themselves onto window.CF as they parse.

   HOW THE SHELL GETS THERE
   ------------------------
   Coach Cam's views reach for its own DOM by id -- pageTitle, crumb,
   topbarActions, detail, sheetHost. Rather than edit nineteen views to
   use KinCrux's chrome, Cam chose to bring Coach Cam's chrome with
   them. So on first mount this file puts Coach Cam's markup on the page
   (shell.js holds it), rebinds the ids, and calls its init() once.

   After that the shell STAYS. Re-rendering it per navigation would
   throw away an open detail pane, a scroll position or a half-filled
   sheet, and re-running init() would boot the app twice.
   ========================================================================== */
window.CF = window.CF || {};

(function () {
  "use strict";

  const S = () => window.CP && window.CP.shared;

  /* WHERE A FLOATING ELEMENT GOES.

     Coach Cam appended its runner, its builder sheets and its selection
     bar to document.body, which was right when it owned the page. In
     KinCrux every one of its CSS rules is scoped under #cf-shell, so an
     element on document.body is OUTSIDE that scope and gets no styling
     at all -- no background, no border, no layout. It is still there and
     still works; it is simply invisible.

     That is how "no options appear when I select highlight" happened in
     the notes module, and the same bug was sitting in the circuit
     runner and all four builders, waiting to be opened.

     Falls back to document.body so these files still run standalone. */
  window.CF.uiRoot = () => document.getElementById("cf-shell") || document.body;

  /* Coach Cam's toast takes (message) and occasionally a kind. KinCrux's
     takes (message, kind) with different kind names, so translate rather
     than leaving half the messages unstyled. */
  window.CF.toast = function (message, kind) {
    const shared = S();
    if (!shared || typeof shared.toast !== "function") return;
    const map = {ok: "good", good: "good", error: "bad", bad: "bad", warn: "warn"};
    shared.toast(String(message == null ? "" : message), map[kind] || "good");
  };

  /* Ctrl+P. Training doesn't print anything itself -- it hands the host
     rendered HTML -- so all it has to do here is say what is currently
     on screen and how to print it. The host honours the offer only
     while `el` is visible, so navigating away withdraws it with no
     bookkeeping at this end. Standalone, these do nothing. */
  window.CF.offerPrint = function (el, label, run) {
    const shared = S();
    if (shared && typeof shared.offerPrint === "function") {
      shared.offerPrint(el, label, run);
    }
  };
  window.CF.withdrawPrint = function (el) {
    const shared = S();
    if (shared && typeof shared.withdrawPrint === "function") {
      shared.withdrawPrint(el);
    }
  };

  /* Coach Cam's own navigation. Its app.js sets this to the real thing
     during init(); until then a click simply does nothing rather than
     throwing. The host reaches training views through mount(). */
  window.CF.go = function (view) {
    void view;
  };

  /* ---- mounting Coach Cam's shell --------------------------------------- */

  const PREFIX = "training:";

  /* Coach Cam's own view ids, namespaced so they cannot collide with the
     host's. Both apps have a "calculators" and a "books" -- unprefixed,
     one would shadow the other, which is exactly what happened to
     Money's dashboard before it was namespaced. */
  const VIEWS = [
    "sessions", "circuits", "library", "guides", "questionnaires",
    "equipment", "documents", "calendar", "programs", "lessonPlans",
    "books", "athletes", "groups", "calculators", "settings", "backup",
    "search",
    "neurotrain",      // where NeuroTrain is installed, in place of Sessions and Programs (Q19 q1)
  ];

  /* Lens is not one of Coach Cam's views -- it was its own window. Here
     it is a view like any other, with its own markup and its own boot. */
  const LENS = "lens";

  /* Cam: "Calculator tools for Training doesn't need to be in split
     view please."

     Coach Cam's three-column layout is list | detail, and above 1000px
     the detail column is permanent -- right for Sessions or Circuits,
     where you pick one and read it beside the list. The calculators are
     not a list of anything. They were rendering into a 320px column
     with a 744px empty pane next to them.

     These are the views with nothing to show in a detail pane, so they
     get the whole width. */
  const NO_DETAIL = new Set(["calculators", "settings", "backup"]);

  function syncLayout() {
    const sh = shell();
    if (!sh || !window.CF.Shell) return;
    sh.classList.toggle("cf-no-detail", NO_DETAIL.has(window.CF.Shell.view));
  }

  let mounted = false;

  /* Opening Training shows Coach Cam's shell and hides KinCrux's page
     area. Nothing is created, injected or moved: the markup has been in
     the document since load (see index.html), because app.js wires its
     listeners at parse time. Moving the subtree would tear those down.

     init() runs once, the first time Training is opened, so the app
     does not pay for it until it is used. */
  function shell() { return document.getElementById("cf-shell"); }
  function lens() { return document.getElementById("cf-lens"); }
  /* The pane the host handed us, remembered from mount() rather than
     looked up by id. It used to be document.getElementById("cp-main") --
     KinCrux's id. NeuroNet's pane is #ss-main, so after the move that
     lookup returned null, unmount() never restored the pane it had
     hidden, and leaving Training left the rest of the app blank. Keeping
     the element the host actually passed makes this work in any host. */
  let givenPane = null;
  function hostPane() {
    return givenPane
      || document.getElementById("ss-main")
      || document.getElementById("cp-main");
  }

  let lensBooted = false;

  async function mountLens(host) {
    const ln = lens();
    if (!ln) { host.textContent = "Lens isn't in this build."; return; }
    host.innerHTML = "";
    const sh = shell();
    if (sh) sh.hidden = true;          /* only one of the two at a time */
    ln.hidden = false;
    host.style.display = "none";
    if (!lensBooted && window.CF.Lens) {
      try {
        await window.CF.Lens.init();
        window.CF.Lens.booted = true;
        lensBooted = true;
      } catch (e) {
        ln.hidden = true;
        host.style.display = "";
        host.textContent = "Lens couldn't start: " + ((e && e.message) || e);
      }
    }
  }

  async function mount(host, view) {
    givenPane = host;
    const want = String(view || "").replace(PREFIX, "") || VIEWS[0];
    if (want === LENS) return mountLens(host);

    const ln = lens();
    if (ln) ln.hidden = true;
    const sh = shell();
    if (!sh) { host.textContent = "The training shell isn't in this build."; return; }

    /* the host cleared its main pane to hand it to us; we use our own */
    host.innerHTML = "";
    sh.hidden = false;
    host.style.display = "none";

    if (!mounted) {
      if (!window.CF.Shell) {
        sh.hidden = true;
        host.style.display = "";
        host.textContent = "The training module didn't load.";
        return;
      }
      try {
        await window.CF.Shell.init();
        window.CF.Shell.booted = true;
        mounted = true;
      } catch (e) {
        sh.hidden = true;
        host.style.display = "";
        host.textContent = "The training module couldn't start: "
          + ((e && e.message) || e);
        return;
      }
    }
    if (VIEWS.includes(want)) window.CF.go(want);
    syncLayout();
  }

  /* Coach Cam's own tabs change the view without going through mount(),
     so the layout is re-checked after any click inside the shell. A
     class toggle on one element is cheap enough to do on every click,
     and it means no ported view has to know about this. */
  document.addEventListener("click", (e) => {
    const sh = shell();
    if (sh && !sh.hidden && sh.contains(e.target)) setTimeout(syncLayout, 0);
  });

  /* The host calls this when it navigates AWAY from a training view.
     Without it Coach Cam's shell would sit on top of every other page. */
  function unmount() {
    const sh = shell();
    const ln = lens();
    if (ln) ln.hidden = true;
    if (sh) sh.hidden = true;
    const pane = hostPane();
    if (pane) pane.style.display = "";
  }

  window.CP = window.CP || {};
  window.CP.Training = {
    mount,
    PREFIX,
    VIEWS: VIEWS.concat(LENS).map((v) => PREFIX + v),
    /* named for the tests, which must not reach into the closure */
    unmount,

    /* ---- what the dashboard's circuit block asks for --------------------

       Cam: "a random circuit generator, which displays a random circuit in
       the widget windows that is scrollable."

       Read through Training's own store, which caches the document, so the
       dashboard drawing often costs nothing after the first read. */
    async circuits() {
      /* CF.Store.load(), which is what Training itself calls -- and it keeps
         its own cache, so the dashboard asking on every draw costs nothing
         after the first read. An earlier version called getData(), which is
         the backend shim underneath and not a function out here. */
      const doc = await CF.Store.load();
      return (doc && doc.circuits) || [];
    },
    async randomCircuit(notId) {
      const all = (await window.CP.Training.circuits())
        .filter((c) => (c.stations || []).length || (c.parts || []).length);
      if (!all.length) return null;
      /* Never hand back the one already showing, unless it is the only one. */
      const pool = all.length > 1 && notId ? all.filter((c) => c.id !== notId) : all;
      return pool[Math.floor(Math.random() * pool.length)] || null;
    },

    _test: {isMounted: () => mounted, viewIds: () => VIEWS.slice()},
  };
})();
