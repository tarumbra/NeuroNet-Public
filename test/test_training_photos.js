/* Training's photo rules, moved here from KinCrux's test_photo_picker.js
   along with the module.

   Both checks guard the same thing: in NeuroNet, training shares the one
   photo library. A photo on an exercise may also be a family picture or an
   album cover, so training must CHOOSE from the library rather than import
   its own copy, and removing a photo from a training record must never
   delete the file underneath. */
const fs = require("fs");
const path = require("path");

const UI = path.join(__dirname, "..", "ui");
let passed = 0, failed = 0;
function ok(name, cond, detail) {
  if (cond) { passed++; console.log("  ok  " + name); }
  else { failed++; console.log("  FAIL " + name + (detail ? "  -- " + detail : "")); }
}

const storage = fs.readFileSync(path.join(UI, "training", "storage.js"), "utf8");

ok("training picks from the photo library instead of the file dialog",
  /pickFromLibrary/.test(storage), "");

const at = storage.indexOf("dropPhoto:");
const drop = storage.slice(at, at + 120);
ok("training's dropPhoto is a no-op rather than a delete",
  at !== -1 && /\{ok: true\}/.test(drop), drop.replace(/\s+/g, " ").slice(0, 80));

/* And NeuroNet must actually provide the picker training reaches for,
   under the name it uses -- the CP adapter in app.js. */
const app = fs.readFileSync(path.join(UI, "app.js"), "utf8");
ok("NeuroNet offers pickFromLibrary on its shared helpers",
  /pickFromLibrary:\s*\(opts\)\s*=>\s*pickFromLibrary\(opts\)/.test(app), "");
ok("and exposes those helpers to training as window.CP.shared",
  /window\.CP\.shared\s*=\s*SS\.shared/.test(app), "");

console.log(`\n  ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
