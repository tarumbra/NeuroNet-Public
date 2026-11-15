/* NeuroPets' parts with their content filled in, for node tools (2026-10-15) -- the same as tools/build_petcore.py
   does: CONTENT("KEY") in ui/pet/core/NN-name.js becomes ui/pet/content/NN-name.json's KEY, "//" notes left out.
     const {partSource, parts} = require("./pet_content.js") */
const fs = require("fs"), path = require("path");
const APP = path.join(__dirname, ".."), CORE = path.join(APP, "ui", "pet", "core"), CONTENT = path.join(APP, "ui", "pet", "content");
const parts = () => fs.readdirSync(CORE).filter((f) => /^\d\d-.*\.js$/.test(f)).sort();
const noNotes = (v) => Array.isArray(v) ? v.map(noNotes) : v && typeof v === "object"
  ? Object.keys(v).filter((k) => k !== "//").reduce((o, k) => (o[k] = noNotes(v[k]), o), {}) : v;
// the build's layout (json.dumps(separators=(", ", ": "))) -- the same values; a tiny float may be written 1e-05 one way, 0.00001 the other
const dumps = (v) => v === null || typeof v !== "object" ? JSON.stringify(v)
  : Array.isArray(v) ? "[" + v.map(dumps).join(", ") + "]" : "{" + Object.keys(v).map((k) => JSON.stringify(k) + ": " + dumps(v[k])).join(", ") + "}";
function contentOf(f) {
  const p = path.join(CONTENT, f.replace(/\.js$/, ".json"));
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : {};
}
function partSource(f) {
  const tables = contentOf(f);
  return fs.readFileSync(path.join(CORE, f), "utf8").replace(/CONTENT\("((?:[^"\\]|\\.)*)"\)/g, (m, k) => {
    const key = JSON.parse('"' + k + '"');
    if (!(key in tables) || key === "//") throw new Error(f + ': CONTENT("' + key + '") has no key in its JSON');
    return dumps(noNotes(tables[key]));
  });
}
module.exports = {parts, partSource, dumps, contentOf, noNotes, CORE, CONTENT};
