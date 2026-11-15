/* ==========================================================================
   crux.test — booting an app under jsdom, with the traps already handled.
   ==========================================================================
   Every trap below cost real time somewhere in this project, and more
   than once made working code look broken. They are handled here so no
   one has to rediscover them.

   TRAP 1 — DO NOT DISPATCH DOMContentLoaded. jsdom fires it itself, AND
   a bubbling document event also reaches window. Dispatching it by hand
   runs boot() a second and third time, which inflates every backend call
   count. Measured: no dispatch = 1 get_data; window dispatch = 2;
   bubbling document + window = 3. I briefly mistook that for a
   regression of a real double-boot bug.

   TRAP 2 — LOAD EVERY SCRIPT index.html DECLARES, IN ITS ORDER. Modules
   depend on each other; loading just app.js throws once it reaches the
   theme engine.

   TRAP 3 — CONFIRM DIALOGS: click [data-act=yes] EXPLICITLY. A combined
   ".btn-danger, .btn" selector returns whichever matches FIRST in
   document order, which is Cancel. A test that silently cancels then
   reports the working code as broken.

   TRAP 4 — DO NOT await A FUNCTION THAT BLOCKS ON A CONFIRM before
   clicking it. Start it, click, then await. Otherwise it deadlocks.

   TRAP 5 — TEST BEHAVIOUR, NOT STRUCTURE. Count backend calls, assert on
   computed values, click real buttons. A test that checks a function
   exists tells you nothing, and a regex over source will happily match a
   compatibility shim or the word "cheffo" in a comment and report a
   feature that does not exist.
   ========================================================================== */
"use strict";

const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

/** Boots an app. Returns { w, settle, calls } where `calls` counts every
    backend method invoked, by name — which is how a performance claim
    gets measured rather than asserted. */
function boot(opts) {
  const uiDir = opts.uiDir;
  const scripts = opts.scripts || ["app.js"];
  const api = opts.api || {};
  const calls = {};

  /* Wrap every api method so the count is free at every call site. */
  const counted = {};
  for (const [name, fn] of Object.entries(api)) {
    counted[name] = async function (...args) {
      calls[name] = (calls[name] || 0) + 1;
      return fn.apply(null, args);
    };
  }

  const dom = new JSDOM(
    fs.readFileSync(path.join(uiDir, opts.html || "index.html"), "utf8"),
    { runScripts: "outside-only", pretendToBeVisual: true });
  const w = dom.window;
  w.pywebview = { api: counted };
  if (opts.beforeScripts) opts.beforeScripts(w);

  for (const f of scripts) {                         /* TRAP 2 */
    w.eval(fs.readFileSync(path.join(uiDir, f), "utf8"));
  }
  /* TRAP 1: nothing is dispatched here, on purpose. */

  return {
    w, calls,
    settle: (ms) => new Promise((r) => w.setTimeout(r, ms || 400)),
    doc: w.document,
    $: (sel) => w.document.querySelector(sel),
    $$: (sel) => [...w.document.querySelectorAll(sel)],
  };
}

/** Answers a confirm dialog. TRAP 3 handled. */
async function answerConfirm(ctx, yes, veilId) {
  await ctx.settle(90);
  const sel = "#" + (veilId || "confirm-veil")
    + " [data-act=" + (yes === false ? "no" : "yes") + "]";
  const btn = ctx.$(sel);
  if (btn) btn.click();
  await ctx.settle(260);
  return !!btn;
}

/** A tiny assertion runner, so every suite reports the same way. */
function suite(title) {
  let pass = 0, fail = 0;
  console.log("\n" + title + "\n");
  const api = {
    ok(name, cond, extra) {
      if (cond) { pass++; console.log("  ok   " + name); }
      else {
        fail++;
        console.log("  FAIL " + name + (extra ? "\n         " + extra : ""));
      }
      return !!cond;
    },
    eq(name, got, want) {
      return api.ok(name, got === want,
        "got " + JSON.stringify(got) + "\n         want " + JSON.stringify(want));
    },
    done() {
      console.log("\n  " + pass + " passed, " + fail + " failed\n");
      process.exit(fail ? 1 : 0);
    },
    get failed() { return fail; },
  };
  return api;
}

module.exports = { boot, answerConfirm, suite };
