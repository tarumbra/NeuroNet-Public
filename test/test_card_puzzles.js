/* Solitaire, Pyramid and Colour by Numbers (14 Nov 2026), brought across
   from Cam's Collective when it was retired (team vote V30). The engines
   run here with no page at all, like every other Puzzles engine
   (test_games.js), and the page side is checked for the two rules Cam set:
   pictures come only from NeuroNet's own Photos, never the file browser.
   Run: node test/test_card_puzzles.js */
"use strict";
const fs = require("fs");
const path = require("path");
const UI = path.join(__dirname, "..", "ui");
const src = fs.readFileSync(path.join(UI, "games", "cranium.js"), "utf8");
let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log("  ok    " + name); }
  else { fail++; console.log("  FAIL  " + name + (detail ? "\n          " + detail : "")); }
};

/* the engines' own module, run alone */
const a = src.indexOf("/* ---- games/cards.js"), b = src.indexOf("const {Sudoku, Minesweeper");
const CRG = {};
new Function("CRG", src.slice(a, b))(CRG);
const {Klondike, Pyramid, ColourByNumbers} = CRG;
let seed = 7;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };

console.log("\nSolitaire (Klondike)\n");
const k = Klondike.create(1, rnd);
const all = [...k.stock, ...k.tab.flat()];
ok("a deal uses all 52 cards, each once", all.length === 52
   && new Set(all.map((c) => c.s * 100 + c.r)).size === 52);
ok("seven columns of 1 to 7, only the last card face up",
   k.tab.every((c, i) => c.length === i + 1 && c.filter((x) => x.up).length === 1 && c[c.length - 1].up));
ok("a 7 can go on a red 8, not a black one",
   Klondike.canStack({s: 0, r: 7}, {s: 1, r: 8, up: true}) && !Klondike.canStack({s: 0, r: 7}, {s: 3, r: 8, up: true}));
ok("only a King fills an empty column", Klondike.canStack({s: 0, r: 13}, undefined) && !Klondike.canStack({s: 0, r: 12}, undefined));
ok("a foundation starts with an Ace and builds up in suit",
   Klondike.canFound({s: 1, r: 1}, []) && Klondike.canFound({s: 1, r: 2}, [{s: 1, r: 1}])
   && !Klondike.canFound({s: 2, r: 2}, [{s: 1, r: 1}]));
const before = JSON.stringify(k.waste);
Klondike.deal(k);
ok("dealing turns one card face up onto the waste (draw one)", k.waste.length === 1 && k.waste[0].up);
Klondike.undo(k);
ok("undo puts it back", JSON.stringify(k.waste) === before && k.stock.length === 24);
const three = Klondike.create(3, rnd);
Klondike.deal(three);
ok("draw three turns three", three.waste.length === 3);
while (three.stock.length) Klondike.deal(three);
Klondike.deal(three);
ok("an empty stock turns the waste back over, face down", three.stock.length === 24 && !three.waste.length
   && three.stock.every((c) => !c.up));
/* a nearly-won table: the rest plays itself */
const near = {draw: 1, stock: [], waste: [], found: [[], [], [], []], tab: [[], [], [], [], [], [], []],
  moves: 0, won: false, history: []};
for (let s = 0; s < 4; s++) for (let r = 1; r <= 12; r++) near.found[s].push({s, r, up: true});
for (let s = 0; s < 4; s++) near.tab[s].push({s, r: 13, up: true});
ok("with everything face up, Finish is offered", Klondike.canFinish(near));
Klondike.finish(near);
ok("and finishing wins it", near.won && near.found.every((f) => f.length === 13));
ok("an illegal move changes nothing", !Klondike.move(k, {pile: "tab", i: 0, j: 0}, {pile: "found", i: 0})
   || k.found[0].length === 1);

console.log("\nPyramid\n");
seed = 11;
const p = Pyramid.create(rnd, 40000);
ok("28 cards in the pyramid, 24 in the stock", p.py.length === 28 && p.stock.length === 24);
ok("the bottom row is free, the top isn't", [21, 22, 23, 24, 25, 26, 27].every((i) => Pyramid.free(p.py, i))
   && !Pyramid.free(p.py, 0));
ok("the deal was checked solvable by the solver (Mathematician's rule)", p.checked === true);
const t = {py: new Array(28).fill(null), stock: [], waste: [], pass: 1, moves: 0, won: false, history: []};
t.py[27] = {s: 0, r: 6}; t.py[26] = {s: 1, r: 7}; t.py[25] = {s: 2, r: 13};
ok("a King goes on its own", Pyramid.remove(t, {py: 25}) && t.py[25] === null);
ok("two cards that don't make 13 stay", !Pyramid.remove(t, {py: 27}, {py: 26 - 1}));
ok("6 + 7 clear together", Pyramid.remove(t, {py: 27}, {py: 26}) && t.won);
const stuck = {py: [{s: 0, r: 2}].concat(new Array(27).fill(null)), stock: [], waste: [], pass: 3,
  moves: 0, won: false, history: []};
ok("a dead end is reported as unsolvable, not looped on", Pyramid.solvable(stuck, 1000) === false);

console.log("\nColour by Numbers\n");
const n = 8, rgba = new Uint8Array(n * n * 4);
for (let i = 0; i < n * n; i++) {
  const left = (i % n) < 4;
  rgba.set(left ? [230, 40, 40, 255] : [30, 60, 200, 255], i * 4);
}
rgba.set([0, 255, 0, 255], 9 * 4);   // one lone speck
const cb = ColourByNumbers.fromPixels(rgba, n, 4);
ok("a two-colour picture gives two numbers (the lone speck is tidied away)", cb.palette.length === 2, JSON.stringify(cb.palette));
ok("every cell has a number in range", cb.cells.every((v) => v >= 0 && v < cb.palette.length));
ok("colours are numbered light to dark", cb.palette.length === 2);
const wrong = cb.cells[0] === 0 ? 1 : 0;
ok("painting the wrong colour doesn't stick, and counts", ColourByNumbers.paint(cb, 0, wrong) === "wrong" && !cb.painted[0] && cb.mistakes === 1);
for (let i = 0; i < n * n; i++) ColourByNumbers.paint(cb, i, cb.cells[i]);
ok("painting every cell its own colour finishes it", cb.won);

console.log("\nThe page\n");
ok("the engines are defined BEFORE the page unpacks them (else they're undefined in the app)",
   a > 0 && b > a);
ok("all three are on the Puzzles list", /key: "klondike"/.test(src) && /key: "pyramid"/.test(src) && /key: "colourbn"/.test(src));
ok("and each has a page", /klondike: renderKlondike, pyramid: renderPyramid, colourbn: renderColourBN/.test(src));
ok("Puzzles never opens the file browser (Cam: only the in-app gallery)",
   !/type="file"|FileReader|showOpenFilePicker/.test(src));
ok("pictures come through NeuroNet's shared Photos picker", /S\.pickFromLibrary\(\{title\}\)/.test(src)
   && /pickPuzzlePhoto\("Choose a photo for the puzzle"\)/.test(src) && /pickPuzzlePhoto\("Choose a photo to paint by numbers"/.test(src));
const css = fs.readFileSync(path.join(UI, "games", "cranium.css"), "utf8");
const added = css.slice(css.indexOf("Solitaire, Pyramid, Colour by Numbers"));
ok("their styles are scoped to Puzzles and use theme tokens only (no colour literals)",
   added.split("\n").filter((l) => /^\S.*\{/.test(l)).every((l) => l.startsWith("#cr-shell "))
   && !/#[0-9a-fA-F]{3,6}\b/.test(added.replace(/#cr-shell/g, "")));
ok("Solitaire: press and drag a card (and what's on it); it lifts see-through, its place empties",
   /ks-ghost/.test(src) && /b\.style\.visibility = "hidden"/.test(src) && /\.ks-ghost \{[^}]*opacity: 0\.55/.test(css));
ok("  a drop that isn't legal puts them back; a press that doesn't move is still a click",
   /if \(dst && Klondike\.move\(s, src, dst\)\) after\(\);\s*else render\(\);/.test(src) && /< 6\) return;/.test(src));
ok("Colour by Numbers: the grid fills the page, centred, and the Puzzles zoom grows it",
   /Math\.floor\(Math\.min\(availW, availH\) \/ s\.n \* zoomLevel\(\)\)/.test(src)
   && /view === "sliding" \|\| view === "colourbn"\) render\(\)/.test(src)
   && /\.cbn-wrap \{ display: flex; flex-direction: column; align-items: center/.test(css));
ok("  and its colours stay pinned under the grid when zoomed in", /\.cbn-palette \{[\s\S]{0,200}position: sticky/.test(css));
ok("Colour by Numbers goes up to Giant: 64 squares with 48 colours (Cam, 15 Nov 2026: \"2 more options ... even more detail\")",
   /SIZES: \{small: 32, medium: 40, large: 48, huge: 56, giant: 64\}/.test(src)
   && /COLOURS: \{small: 24, medium: 28, large: 32, huge: 40, giant: 48\}/.test(src));
ok("Lights Out and Hitori are gone (Cam: \"puzzles feels bloated\")",
   !/LightsOut|Hitori|lightsout|hitori/.test(src) && !/\.lo-|\.hi-/.test(css));
ok("  and Peg Solitaire and Mastermind (15 Nov 2026)",
   !/PegSolitaire|renderPegs|key: "pegs"|const Mastermind|renderMastermind|key: "mastermind"/.test(src) && !/\.pg-|\.mm-peg/.test(css));

/* Cam (15 Nov 2026): "once completed they should get added to the pixel art
   creator app as a project". The real PixelCore, the real cbnToPixel. */
{
  const vm = require("vm");
  const ctx = {Buffer, console};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(UI, "pixel", "pixelcore.js"), "utf8") + ";this.PixelCore = PixelCore;", ctx);
  let saved = null;
  ctx.SS = {Store: {call: async (name, args) => { saved = [name, args]; return {ok: true, id: "as1"}; }}, AssetStore: {forget() {}}};
  ctx.window = {PixelCore: ctx.PixelCore, SS: ctx.SS};
  const fn = src.slice(src.indexOf("async function cbnToPixel"), src.indexOf("function renderColourBN"));
  vm.runInContext(fn + ";this.cbnToPixel = cbnToPixel;", ctx);
  const st = {n: 32, name: "Cat", palette: ["#ff0000", "#00ff00", "#0000ff"], cells: Array.from({length: 1024}, (_, i) => i % 3)};
  ctx.cbnToPixel(st).then((id) => {
    const [name, args] = saved || [];
    const [cat, title, preview, design, size, stage] = args || [];
    ok("a finished picture is saved as a Pixel art sprite, In progress",
       id === "as1" && name === "asset_add" && cat === "other" && title === "Colour by Numbers: Cat" && stage === "wip"
       && JSON.stringify(size) === "[32,32]" && /^data:image\/png;base64,/.test(preview));
    const back = ctx.PixelCore.deserialise(JSON.parse(JSON.stringify(design)));
    const px = back.cels[back.layers[0].id][0];
    ok("  one pixel per square, each its own colour, with the picture's colours as its palette",
       back.w === 32 && [...px.slice(0, 12)].join() === "255,0,0,255,0,255,0,255,0,0,255,255"
       && back.palette.colours.join() === st.palette.join());
    ok("  the win says so, with a button to open it in Pixel art",
       /id="cbn-pixel">Open in Pixel art/.test(src) && /SS\.Pixel\.openAsset\(s\.assetId\)/.test(src));
    console.log(`\n  ${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  });
}

const html = fs.readFileSync(path.join(UI, "index.html"), "utf8");
ok("their icons are drawn", ["i-cardfan", "i-pyramid", "i-palette"].every((i) => html.includes(`id="${i}"`)));

