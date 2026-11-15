/* ==========================================================================
   crux.store — the bridge to Python, and the guard against losing work.
   ==========================================================================
   Every app in this project grew its own copy of this: the pywebview
   handshake, the localStorage fallback so the UI can be opened in a plain
   browser, and a set of thin wrappers over the Api. This is that code,
   with two things every app should have had and only one did.

   1. THE STALE-WRITE GUARD. Two windows open on one file, both holding
      the whole document in memory: whoever saves second silently erases
      the other's work. Coach Cam solved this and the others never got it.
      save() carries the stamp it last saw; the host refuses a write that
      would clobber a newer one, and hands back the current stamp so the
      caller can reload and retry.

      This matters inside one app too — a second window, a scheduled
      task, or an older standalone app still installed.

   2. A MISSING BACKEND METHOD IS NOT A CRASH. An app folder can be
      half-updated: newer UI, older Python. call() checks the method
      exists and returns a plain error the UI can show, rather than
      throwing a bridge error nobody can read.
   ========================================================================== */
"use strict";

window.CruxStore = (function () {

  function create(options) {
    options = options || {};
    const lsPrefix = options.lsPrefix || "crux";
    const emptyData = options.emptyData || {};

    let api = null;
    let stamp = null;          // what the file looked like when we read it

    const ready = new Promise((resolve) => {
      if (window.pywebview && window.pywebview.api) {
        api = window.pywebview.api;
        resolve();
        return;
      }
      window.addEventListener("pywebviewready", () => {
        api = window.pywebview.api;
        resolve();
      }, {once: true});
      /* A plain browser has no pywebview and never will. Resolving on a
         timer is what lets the UI be opened in a browser for a quick
         look without the whole app hanging on boot. */
      setTimeout(resolve, 700);
    });

    const desktop = () => api !== null;

    const LS = {
      read(key, fallback) {
        try {
          const raw = localStorage.getItem(lsPrefix + ":" + key);
          return raw === null ? fallback : JSON.parse(raw);
        } catch (e) { return fallback; }
      },
      write(key, value) {
        try {
          localStorage.setItem(lsPrefix + ":" + key, JSON.stringify(value));
        } catch (e) { /* private mode, or quota */ }
      },
    };

    /** Calls a backend method, or explains why it can't. */
    async function call(name, args, whatFor) {
      await ready;
      if (!desktop()) {
        return {error: (whatFor || "That") + " runs in the desktop app."};
      }
      if (typeof api[name] !== "function") {
        return {error: (whatFor || "That") + " needs a newer build — "
          + "the app files are out of step with each other."};
      }
      try {
        return await api[name].apply(api, args || []);
      } catch (e) {
        return {error: String((e && e.message) || e)};
      }
    }

    return {
      ready,
      desktop,
      call,
      LS,

      /** The stamp of the data as this window last saw it. */
      get stamp() { return stamp; },
      _setStamp(v) { stamp = v; },

      async load() {
        await ready;
        if (!desktop()) return LS.read("data", emptyData);
        const res = await call("get_data", [], "Loading");
        if (res && res.error) return emptyData;
        /* get_data may answer {data, stamp} or just the data, so both
           shapes work and an older backend needs no change. */
        if (res && typeof res === "object" && "stamp" in res && "data" in res) {
          stamp = res.stamp;
          return res.data;
        }
        const s = await call("data_stamp", [], "Checking");
        if (typeof s === "number") stamp = s;
        return res;
      },

      /** Saves, refusing rather than clobbering a newer write.
          Returns {ok} or {conflict, error, stamp}. */
      async save(data) {
        await ready;
        if (!desktop()) { LS.write("data", data); return {ok: true}; }
        const res = await call("save_data", [data, stamp], "Saving");
        if (res && res.conflict) return res;
        if (res && typeof res.stamp === "number") stamp = res.stamp;
        return res || {ok: true};
      },

      /** Saves without the guard — for a first write, or a caller that
          genuinely owns the file alone. Named so it reads as a decision
          at the call site rather than an oversight. */
      async saveUnguarded(data) {
        await ready;
        if (!desktop()) { LS.write("data", data); return {ok: true}; }
        const res = await call("save_data", [data], "Saving");
        if (res && typeof res.stamp === "number") stamp = res.stamp;
        return res || {ok: true};
      },

      async getPrefs() {
        await ready;
        return desktop() ? await call("get_prefs", [], "Settings")
                         : LS.read("prefs", {});
      },
      async setPrefs(partial) {
        await ready;
        if (!desktop()) {
          LS.write("prefs", Object.assign(LS.read("prefs", {}), partial));
          return {ok: true};
        }
        return call("set_prefs", [partial], "Settings");
      },
    };
  }

  return {create};
})();
