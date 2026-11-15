/* You as a young man or a young woman (2026-10-11, Cam: "lets remove ambiguity and reduce to 4 in total. 1 male character
   standing and fighting and 1 female standing and fighting ... (customisation of character can be shelved)"). Worn armour
   will be drawn onto these exact bodies. Villagers keep the 60 painted looks. Run: node test/test_pet_bodies.js [app dir] */
const fs = require("fs"), path = require("path"), vm = require("vm");
const APP = process.argv[2] || path.join(__dirname, "..");
const ctx = {window: {}, console};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8"), ctx);
const C = ctx.window.PetCore || ctx.PetCore;
const PET = fs.readFileSync(path.join(APP, "ui", "pet", "pet.js"), "utf8"), GAME = fs.readFileSync(path.join(APP, "ui", "pet", "game.js"), "utf8");
let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log("  ok    " + name); } else { fail++; console.log("  FAIL  " + name + (detail !== undefined ? "  -- " + detail : "")); } };
const T0 = Date.UTC(2026, 9, 11, 9);

/* ---- the rules: the body is kept with your look ---- */
{
  const make = (look) => C.act(C.advance(C.empty(), T0), "player", {name: "Cam", look}, T0);
  const f = make({body: "f"}), m = make({body: "m"}), junk = make({body: "x", skin: 2}), none = make({skin: 1, hair: 2, outfit: 3});
  ok("a young woman is kept", f.ok && f.state.player.look.body === "f", JSON.stringify(f.state && f.state.player.look));
  ok("a young man is kept", m.ok && m.state.player.look.body === "m");
  ok("anything else reads as the young man", junk.ok && junk.state.player.look.body === "m" && junk.state.player.look.skin === 2);
  ok("an old look (no body) still saves, as the young man, with its shelved skin/hair/outfit kept",
     none.ok && none.state.player.look.body === "m" && none.state.player.look.outfit === 3);
  ok("the player view hands the body to the screens", C.playerView(f.state, T0).look.body === "f");
}

/* ---- the pictures: four, and each pair the same size (cut with one crop, so armour fits both) ---- */
{
  const size = (f) => {   // a lossy WebP's VP8 frame header holds its size
    const b = fs.readFileSync(f), i = b.indexOf("VP8 ");
    return i < 0 ? null : [b.readUInt16LE(i + 14) & 0x3fff, b.readUInt16LE(i + 16) & 0x3fff].join("x");
  };
  const pic = (b, p) => path.join(APP, "ui", "pet", "art", "player", `body-${b}-${p}.webp`);
  ["a", "fight"].forEach((p) => {
    ok(`both bodies have a ${p === "a" ? "standing" : "fighting"} picture`, fs.existsSync(pic("m", p)) && fs.existsSync(pic("f", p)));
    ok("  ...the same size, so they line up", fs.existsSync(pic("m", p)) && size(pic("m", p)) && size(pic("m", p)) === size(pic("f", p)),
       fs.existsSync(pic("m", p)) && [size(pic("m", p)), size(pic("f", p))].join(" vs "));
  });
  ok("tools/cut_player_bodies.py makes them", fs.existsSync(path.join(APP, "tools", "cut_player_bodies.py")));
}

/* ---- the screens: you are drawn from the body; villagers keep their looks ---- */
{
  ok("youURL picks body-m / body-f, standing or fighting", /function youURL\(lk, pose\) \{ return `art\/player\/body-\$\{lk && lk\.body === "f" \? "f" : "m"\}-\$\{pose === "fight" \? "fight" : "a"\}\.webp`; \}/.test(PET));
  ok("no screen draws you from the old looks any more", !/avatarURL\((pv|pl)\.look|avatarURL\(look[,)]/.test(PET), (PET.match(/avatarURL\((pv|pl)\.look[^)]*\)|avatarURL\(look[^)]*\)/g) || []).join(" "));
  ["youURL(look)", 'youHTML(pv.look, "fight", pv.gear', "youURL(pl.look)"].forEach((c) => ok("  uses " + c, PET.includes(c)));   // (youURL(pv.look) went with the Gear tab's extra portrait -- I1, 2026-10-16)
  ok("villagers and shopkeepers still use their painted looks", /avatarURL\(pp\.look, 48\)/.test(PET) && /avatarURL\(w\.look, size\)/.test(PET));
  ok("the top-bar Player icon is you", GAME.includes("SS.Pet.you(g.pv.look)") && /you: \(lk, pose\) => youURL\(lk, pose\)/.test(PET));
  ok("the look-maker offers a young man or a young woman, no colour swatches", PET.includes('[["m", "A young man"], ["f", "A young woman"]]') && !PET.includes('sw("skin"'));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
