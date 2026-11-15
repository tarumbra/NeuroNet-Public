/* Worn armour you can see (2026-10-11, Cam: "when i put a piece of bronze on it will be represented on the avatar").
   Gemini dresses the young man, then leaves only the armour; tools/lift_worn.py cuts each piece into a layer the size of
   the body sprite (art/worn/<item>-<a|fight>.webp), and the game stacks them over you. Run: node test/test_pet_worn.js */
const fs = require("fs"), path = require("path"), vm = require("vm");
const APP = process.argv[2] || path.join(__dirname, "..");
const ctx = {window: {}, console};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8"), ctx);
const C = ctx.window.PetCore || ctx.PetCore;
const PET = fs.readFileSync(path.join(APP, "ui", "pet", "pet.js"), "utf8");
const CSS = fs.readFileSync(path.join(APP, "ui", "pet", "theme.css"), "utf8");
const ART = path.join(APP, "ui", "pet", "art");
let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log("  ok    " + name); } else { fail++; console.log("  FAIL  " + name + (detail !== undefined ? "  -- " + detail : "")); } };
const size = (f) => { const b = fs.readFileSync(f), i = b.indexOf("VP8 "); return i < 0 ? null : [b.readUInt16LE(i + 14) & 0x3fff, b.readUInt16LE(i + 16) & 0x3fff].join("x"); };

/* ---- the outfits: every piece you can see on you, once, in its own slot ---- */
{
  const O = JSON.parse(fs.readFileSync(path.join(APP, "tools", "worn", "outfits.json"), "utf8"));
  const seen = Object.values(O).flatMap((d) => Object.values(d));
  const wearable = Object.keys(C.ITEMS).filter((k) => C.ITEMS[k].gear && C.ITEMS[k].gear.who === "player" && ["helmet", "torso", "arms", "legs", "feet", "cloak"].includes(C.ITEMS[k].gear.slot));
  ok("every helmet, body, arms, legs, feet and cloak piece is in exactly one outfit", seen.length === new Set(seen).size && wearable.every((k) => seen.includes(k)) && seen.length === wearable.length,
     wearable.filter((k) => !seen.includes(k)).join(", "));
  ok("  ...under its own slot", Object.values(O).every((d) => Object.entries(d).every(([s, id]) => C.ITEMS[id] && C.ITEMS[id].gear.slot === s)));
}

/* ---- the pictures: listed, there, and the body's size so they stack exactly ---- */
{
  const src = fs.readFileSync(path.join(ART, "worn", "manifest.js"), "utf8");
  const W = JSON.parse((src.match(/window\.WORN_PICS = (\{.*\});/) || [0, "{}"])[1]);
  ok("the bronze set is worn standing and fighting", ["bronzehelm", "bronzeplate", "bronzegloves", "bronzelegs", "bronzeboots"].every((k) => W[k] && W[k].a && W[k].fight));
  const bad = [];
  Object.keys(W).forEach((id) => Object.keys(W[id]).forEach((p) => {
    const f = path.join(ART, "worn", `${id}-${p}.webp`), body = path.join(ART, "player", `body-m-${p}.webp`);
    if (!C.ITEMS[id] || !fs.existsSync(f) || size(f) !== size(body)) bad.push(`${id}-${p}`);
  }));
  ok("every listed piece is a real item, has its picture, and is the body sprite's size", !bad.length, bad.join(", "));
  const O = JSON.parse(fs.readFileSync(path.join(APP, "tools", "worn", "outfits.json"), "utf8"));
  const started = Object.keys(O).filter((o) => Object.values(O[o]).some((id) => W[id]));
  const partial = started.filter((o) => !Object.values(O[o]).every((id) => W[id] && W[id].a && W[id].fight));
  ok("every outfit that's in is whole: each piece, standing and fighting (" + started.length + " outfits)", started.length >= 30 && !partial.length, partial.join(", "));
  ok("  stray ink lines are cleaned off (a soft leather cap's rim crossed the face, 2026-10-11)", /def stray_lines_out\(im, reach=26\)/.test(fs.readFileSync(path.join(APP, "tools", "lift_worn.py"), "utf8")));
  ok("the page loads the list", fs.readFileSync(path.join(APP, "ui", "pet", "index.html"), "utf8").includes('<script src="art/worn/manifest.js"></script>'));
}

/* ---- drawing: stacked over you, legs up; a cloak behind; nothing for a piece with no art ---- */
{
  const m = PET.match(/const WORN_ORDER = (\[[^\]]*\]);[\s\S]*?function wornOn[^\n]*\n\s*function youHTML[\s\S]*?\n  \}\n/);
  ok("youHTML is there", !!m);
  if (m) {
    const box = {window: {WORN_PICS: {bronzehelm: {a: 1, fight: 1}, bronzeplate: {a: 1}, bronzeboots: {a: 1}, magecloak: {a: 1}}}};
    vm.createContext(box);
    vm.runInContext("const window = this.window; function youURL(lk, p) { return `art/player/body-${lk.body === 'f' ? 'f' : 'm'}-${p}.webp`; }\n" + m[0] + "\nthis.youHTML = youHTML;", box);
    const gear = [["helmet", "bronzehelm"], ["torso", "bronzeplate"], ["feet", "bronzeboots"], ["arms", "irongloves"], ["cloak", "magecloak"]].map(([slot, id]) => ({slot, item: {id}}));
    const srcs = (h) => [...h.matchAll(/src="([^"]+)"/g)].map((x) => x[1]);
    const a = srcs(box.youHTML({body: "f"}, "a", gear, "pl-avatar"));
    ok("standing: cloak, body, then boots, chestplate, helmet (legs up); iron gauntlets have no art yet, so they don't show",
       a.join() === "art/worn/magecloak-a.webp,art/player/body-f-a.webp,art/worn/bronzeboots-a.webp,art/worn/bronzeplate-a.webp,art/worn/bronzehelm-a.webp", a.join());
    const f = srcs(box.youHTML({}, "fight", gear, "pp-sprite you", 'id="pp-you"'));
    ok("fighting: only pieces drawn fighting", f.join() === "art/player/body-m-fight.webp,art/worn/bronzehelm-fight.webp", f.join());
    ok("nothing worn: just you", srcs(box.youHTML({}, "a", [], "x")).join() === "art/player/body-m-a.webp");
  }
  ok("the Player page, battles and the game-over picture wear it", PET.includes('youHTML(pv.look, "a", pv.gear, "pl-avatar")') && PET.includes('youHTML(pv.look, "fight", pv.gear, "pp-sprite you", \'id="pp-you"\')')
     && PET.includes('youHTML(pv.look, "a", pv.gear, "pp-avatar-big"'));
  ok("the layers sit in one box, the battle one where the painted you stands", /\.pp-you-pic > img \{ position: absolute; inset: 0;/.test(CSS) && /\.pp-sprite\.you\.pp-you-pic \{ width: 150px; height: 170px;/.test(CSS));
  ok("tools/lift_worn.py cuts them with the body's own crop", /bodies\.frame\(pose\)/.test(fs.readFileSync(path.join(APP, "tools", "lift_worn.py"), "utf8")));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
