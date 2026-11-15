/* The grid game's prototype (Collaboration project "Grid game", 2026-10-18) and the Kit's setting. Cam: "build a prototype of
   the grid based approach. It should show the main areas on the main island only and i should be able to enter the areas. So
   when going into a foraging, digging node etc it will start collecting. Add some sound ... only the hunter and berserker" --
   and "in the settings in Neuropets add the ability to hide the kit". Run: node test/test_pet_grid.js [app] */
const fs = require("fs"), path = require("path"), vm = require("vm");
const APP = process.argv[2] || path.join(__dirname, "..");
const ctx = {window: {}, console};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8"), ctx);
const C = ctx.window.PetCore || ctx.PetCore;
const G = fs.readFileSync(path.join(APP, "ui", "pet", "grid", "grid.js"), "utf8"), GH = fs.readFileSync(path.join(APP, "ui", "pet", "grid", "index.html"), "utf8");
const PET = fs.readFileSync(path.join(APP, "ui", "pet", "pet.js"), "utf8"), GAME = fs.readFileSync(path.join(APP, "ui", "pet", "game.js"), "utf8"), PY = fs.readFileSync(path.join(APP, "pet.py"), "utf8");
let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log("  ok    " + name); } else { fail++; console.log("  FAIL  " + name + (detail !== undefined ? "  -- " + detail : "")); } };

console.log("\nThe grid prototype\n");
const main = JSON.parse((/const MAIN = (\[[^\]]*\])/.exec(G) || [0, "[]"])[1]);
ok("the main island's areas only (no other islands, no sea, no Misty Isle)", main.length === 11 && main.every((r) => C.REGIONS[r] && !C.REGIONS[r].island)
   && !main.some((r) => ["mistyisle", "frostpeak", "desert", "nile", "opensea", "hollowcrypt", "oasis", "sandport"].includes(r)), main.join());
ok("  every area with gathering has nodes from the game's own spots (the five gathering skills)", /const GATHER = \["foraging", "fishing", "mining", "lumbering", "digging"\]/.test(G)
   && main.filter((r) => r !== "village" && r !== "magetower").every((r) => ["foraging", "mining", "lumbering"].some((k) => C.SKILLS[k].spots.some((sp) => sp.area === r))));
ok("  walking into an area's signpost goes in; the one at the bottom goes back out", /if \(gate\) \{ const to = map\.gates\[nx \+ "," \+ ny\]/.test(G) && /m\.gates\[gx \+ "," \+ \(H - 1\)\] = "world"/.test(G));
ok("  a node: you walk up to it and keep collecting, at the spot's own pace, its finds and xp", /P\.job = \{kind: "gather", node/.test(G) && /n\.sp\.time \* 1000/.test(G) && /pickW\(n\.sp\.loot\)/.test(G) && /addXp\(n\.skill, n\.sp\.xp/.test(G));
ok("  only the Hunter and the Berserker, with the game's own specials", /const KIT = \{\s*hunter:/.test(G) && /berserker: \{name: "Berserker"/.test(G) && !/arcane:|thief:|paladin:|beastmaster:/.test(G.slice(G.indexOf("const KIT"), G.indexOf("const kit ="))) && /const C = Core\.CLASSES\[S\.cls\]; return Object\.keys\(C\.specials\)/.test(G));
ok("  the Hunter shoots from 4 tiles, the Berserker swings up close and builds fury", /range: 4/.test(G) && /meter: "fury"/.test(G) && /S\.fury = Math\.min\(100, S\.fury \+ dealt \* 3\)/.test(G));
ok("  sound: footsteps, a sound for each gathering skill, the fight, finds and levels, and each area's ambience -- made with WebAudio", ["step", "chop", "mine", "pick", "dig", "fish", "arrow", "swing", "hit", "loot", "level"].every((k) => new RegExp("\\b" + k + ": \\(\\) =>").test(G)) && /function ambient\(kind\)/.test(G) && /AudioContext/.test(G));
ok("  a mute button and a volume slider", /id="g-mute"/.test(GH) && /id="g-vol"/.test(GH));
ok("  its own save -- nothing touches your game", /const KEY = "np:grid"/.test(G) && !/SS\.Store|pet_save|pywebview/.test(G));
ok("  no inline scripts (the window's security rules)", !/<script>[^<]/.test(GH) && /script-src 'self' 'unsafe-eval'/.test(GH));
ok("in NeuroPets: Prototypes → Grid world, in a frame", /\["Prototypes", \["proto:grid"\]\]/.test(GAME) && /src="grid\/index\.html"/.test(PET) && /"proto:grid"/.test(PET));

console.log("\nPT22's fixes\n");
ok("combat as in the game: a hunting ground asks its combat level", /combatLevel\(\) < map\.hunt\.level/.test(G) && /need combat level \$\{map\.hunt\.level\}/.test(G));
ok("  you start at a new game's levels (1, and 10 Hitpoints) and heal 1 a minute", /a new game's levels: 1, and 10 Hitpoints/.test(G) && /P\.regenTicks % 10 === 0\) S\.hp\+\+/.test(G));
ok("  a creature's health comes back when the fight's over, and when you're knocked down", /mm\.hp < mm\.max && !mm\.aggro && now - \(mm\.calmAt \|\| 0\) > 4000\) mm\.hp = mm\.max/.test(G) && /m\.aggro = false; m\.hp = m\.max;/.test(G));
ok("  more creatures, all over the area, each keeping to its patch", /for \(let i = 0; i < 11; i\+\+\) spawnMon\(m\)/.test(G) && /m\.huntZone = \[1, 1, W - 2, H - 4\]/.test(G) && /it keeps to its patch/.test(G));
ok("speed (RPG MO): you walk slower to begin with; reptile boots from snakes make you faster", /const STEP = 280/.test(G) && /STEP \/ \(1 \+ speed\(\)\)/.test(G) && /snake: \["reptileboots", 40\]/.test(G));

console.log("\nSettings: hide the Kit\n");
ok("no Show the Kit switch any more: the Kit is the bag (2026-10-20)", !/\["kit", "Show the Kit"/.test(PET) && /function kitWide\(\) \{ return window\.innerWidth > 760; \}/.test(PET));
ok("  its top-bar button only on a narrow window, where it's a drawer", /pv\.made && window\.innerWidth <= 760\) chips\.push/.test(GAME));
ok("Show prototypes: off unless switched on; off, no Prototypes in the sidebar", /"prototypes": False/.test(PY) && /\["prototypes", "Show prototypes"/.test(PET) && /!k\.startsWith\("proto:"\) \|\| NP\.settings\.prototypes === true/.test(GAME) && /keys\.some\(shown\)/.test(GAME));

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
