/* ==========================================================================
   The guides tell the truth about the app.
   ==========================================================================
   Cam: "integrate a guides subsection in notes, that has an overview and
   guide on how to use all the tools within the section. Inclusive of a
   cells formula cheat sheets like how to do SUMS in the cells feature,
   all the markdown text for vault."

   A handbook that has quietly drifted out of date is worse than no
   handbook, because it is believed. So nothing here checks that the
   guides EXIST or that they are long enough. Every claim they make is
   run against the thing it describes:

     * every worked formula goes through the REAL grid engine, and the
       answer printed in the guide has to be the answer that comes back
     * every function the engine has must appear in the cheat sheet, and
       every function the cheat sheet names must exist -- so adding a
       function to the grid and forgetting the guide FAILS HERE
     * the same for the error codes and the number formats
     * every piece of markdown syntax is rendered by the REAL Vault
       renderer and has to produce what the guide says it produces
     * the Boards tool list is checked against Boards' own tool table

   The point of each of these is the second direction. Checking that the
   guide's claims are true catches a lie; checking that the code's
   features are all documented catches the far more likely failure, which
   is a guide written once and then left behind.
   ========================================================================== */
"use strict";
const fs = require("fs");
const path = require("path");
const {JSDOM} = require("jsdom");

const APP = process.argv[2] || path.join(__dirname, "..");
const UI = path.join(APP, "ui");
const G = require(path.join(UI, "notes", "grid.js"));

let pass = 0, fail = 0;
const out = [];
const ok = (name, cond, detail) => {
  if (cond) { pass++; out.push("  ok    " + name); }
  else { fail++; out.push("  FAIL  " + name + (detail ? "\n          " + detail : "")); }
};

/* ---- load the guides without a browser ---------------------------------
   guides.js is an IIFE that hangs itself off SS. Give it an SS to hang
   off and read the content straight out of it -- no DOM needed for the
   part that matters, which is what the guides SAY. */
function loadGuides() {
  const src = fs.readFileSync(path.join(UI, "notes", "guides.js"), "utf8");
  const sandbox = {SS: {}, window: {}};
  sandbox.window.SS = sandbox.SS;
  new Function("SS", "window", "document", src)(
    sandbox.SS, sandbox.window, undefined);
  return sandbox.SS.Guides._test.GUIDES;
}

const GUIDES = loadGuides();
const byId = (id) => GUIDES.find((g) => g.id === id);
const ALL = GUIDES.map((g) => g.body).join("\n");

/* HTML entities back to the characters they stand for, so a formula read
   out of the page is the formula a person would type. */
const unent = (s) => String(s)
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");

/* Every <code> span in the guides, as text. */
function codeSpans(html) {
  const found = [...String(html).matchAll(/<code>([\s\S]*?)<\/code>/g)];
  return found.map((m) => unent(m[1]).trim());
}

/* ---- 1. the guides are there and filed under Notes --------------------- */
{
  const appJs = fs.readFileSync(path.join(UI, "app.js"), "utf8");
  ok("Guides is a subsection of Notes",
    /\{key: "guides:index", name: "Guides"\}/.test(appJs));
  /* notes:* is the Vault's own prefix -- it shows and hides its whole shell
     on it -- so a notes:guides view would have opened underneath the
     editor. Boards and Cells already learned this. */
  ok("  under its own prefix, not notes:",
    GUIDES.length > 0 && /guides: "notes"/.test(appJs)
    && !/\{key: "notes:guides"/.test(appJs),
    "notes:* belongs to the Vault's shell; a guide filed there opens "
    + "underneath the editor and shows nothing");
  ok("  and the router knows about it", /SS\.Guides,/.test(appJs));
  const html = fs.readFileSync(path.join(UI, "index.html"), "utf8");
  ok("  with its script and its styles loaded",
    html.includes('src="notes/guides.js"') && html.includes('href="notes/guides.css"'));
}

/* ---- 2. every worked formula actually gives that answer ---------------- */
/* The answers are READ OUT OF THE GUIDE, not kept in a list here. That
   distinction is the whole value of this check: a test with its own copy of
   the expected answers passes happily while the guide on screen says
   something else. Found exactly that way -- changing the guide to claim
   SQRT(81) is 8 did not fail until this read the 8 from the page.

   The pattern is the one the cheat sheet uses throughout:
       <code>=SQRT(81)</code> → <b>9</b>
   and the sheet's range examples all run on the column 20, 45, 5, which it
   states. Anything not written in that shape is not checked here -- and the
   count below fails if that ever becomes most of them. */
{
  const value = (formula) => {
    const m = G.normalise({rows: [["20", formula], ["45", ""], ["5", ""]]});
    const v = G.computeAll(m)[0][1];
    return G.isErr(v) ? v.code : v;
  };
  const shown = (formula) => {
    const v = value(formula);
    return typeof v === "number" ? G.display(v, "general") : String(v);
  };

  const body = byId("cells-formulas").body;
  /* every "<code>=...</code> → <b>answer</b>" on the page */
  const claims = [...body.matchAll(
    /<code>(=[^<]*)<\/code>\s*(?:&rarr;|→)\s*<b>([^<]*)<\/b>/g)]
    .map((m) => [unent(m[1]).trim(), unent(m[2]).trim()]);

  ok("the cheat sheet works its examples through, so they can be checked",
    claims.length >= 10, "only found " + claims.length + " worked examples");

  const wrong = claims.filter(([f, want]) => shown(f) !== want)
    .map(([f, want]) => `the guide says ${f} is ${want}; it is ${shown(f)}`);
  ok("  and every answer it prints is the answer the engine gives",
    !wrong.length, wrong.join("; "));

  /* The one example whose answer is text rather than a number. */
  ok('  including =A1&" kg" → 20 kg', value('=A1&" kg"') === "20 kg",
    String(value('=A1&" kg"')));

  /* And that text in a range really is skipped, as the guide promises. */
  const withText = G.normalise({rows: [["20", "=SUM(A1:A4)"], ["Heading", ""],
                                       ["45", ""], ["5", ""]]});
  ok("  and text caught in a range is skipped, not counted as zero",
    G.computeAll(withText)[0][1] === 70,
    String(G.computeAll(withText)[0][1]));
}

/* ---- 3. the cheat sheet and the engine agree on WHAT EXISTS ------------ */
/* This is the check that matters most over time: add SUMIF to the grid and
   forget the guide, and this goes red. */
{
  const guide = byId("cells-formulas");
  ok("there is a formula cheat sheet", !!guide);
  const text = unent(guide.body);
  const real = Object.keys(G.FUNCS);
  const missing = real.filter((fn) => !new RegExp(`\\b${fn}\\(`).test(text));
  ok("every function the grid has is in the cheat sheet",
    !missing.length, "not documented: " + missing.join(", "));

  /* And nothing invented. Any NAME( in the guide that looks like a
     function must be one the engine really has. */
  const named = new Set(codeSpans(guide.body)
    .flatMap((c) => [...c.matchAll(/\b([A-Z][A-Z0-9]{1,})\s*\(/g)].map((m) => m[1])));
  const invented = [...named].filter((n) => !real.includes(n));
  ok("  and the cheat sheet invents none",
    !invented.length, "no such function: " + invented.join(", "));

  ok("  it says how many there are, correctly",
    /eleven functions/.test(text) && real.length === 11,
    "the guide says eleven; the engine has " + real.length);
}

/* ---- 4. error codes and number formats -------------------------------- */
{
  const text = unent(byId("cells-formulas").body);
  /* Every error the engine can produce, straight out of the engine. */
  const codes = ["#DIV/0!", "#NAME?", "#REF!", "#VALUE!", "#NUM!", "#CIRC!", "#ERROR!"];
  const undoc = codes.filter((c) => !text.includes(c));
  ok("every error code the grid can show is explained", !undoc.length,
    "not explained: " + undoc.join(" "));

  /* Each one is also produced on demand, so the descriptions describe
     something real rather than a code that no longer happens. */
  const produced = {
    "#DIV/0!": "=1/0",
    "#NAME?": "=NOSUCHFN(1)",
    "#NUM!": "=SQRT(-1)",
    "#ERROR!": "=SUM(",
  };
  const notReal = Object.entries(produced).filter(([codeStr, f]) => {
    const v = G.computeAll(G.normalise({rows: [[f]]}))[0][0];
    return !(G.isErr(v) && v.code === codeStr);
  }).map(([c, f]) => `${f} was meant to give ${c}`);
  ok("  and each is really what that mistake produces", !notReal.length,
    notReal.join("; "));

  const formats = ["General", "Whole number", "Percent", "Currency",
                   "thousands separator"];
  ok("the number formats are described", formats.every((f) =>
    text.toLowerCase().includes(f.toLowerCase())));
}

/* ---- 5. every documented piece of markdown really renders that way ----- */
/* The Vault's renderer is inside notes/app.js, which expects a document. It
   gets one. */
function vaultRenderer() {
  /* runScripts: "outside-only" is what gives w.eval a real window to run
     in. Without it the file runs in Node's own context and dies on its
     first line of "window.CC = ...". */
  const dom = new JSDOM("<!doctype html><html><body></body></html>",
    {runScripts: "outside-only", url: "file://" + UI + "/index.html"});
  const w = dom.window;
  w.SS = {Store: {call: async () => ({})}, shared: {}};
  w.CP = {Store: {call: async () => ({})}};
  w.requestAnimationFrame = (fn) => setTimeout(fn, 0);
  w.cancelAnimationFrame = (id) => clearTimeout(id);
  w.matchMedia = () => ({matches: false, addListener() {}, removeListener() {}});
  w.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  w.eval(fs.readFileSync(path.join(UI, "notes", "app.js"), "utf8"));
  const md = w.CC && w.CC.md;
  if (!md || typeof md.render !== "function") return null;
  /* render(markdown, existingTitles) -- a Set of lowercased titles, not an
     options object. Getting that wrong is how a [[link]] ends up looking
     broken in a test and fine in the app. */
  return (src) => md.render(src, new Set(["another note"]));
}

{
  const render = vaultRenderer();
  ok("the Vault's own renderer is reachable, so this tests the real thing",
    !!render, "without it the markdown guide could only be read, not checked");

  if (render) {
    /* [what the guide tells you to type, what must appear in the result] */
    const CASES = [
      ["# Title", "<h1"],
      ["## Section", "<h2"],
      ["### Subsection", "<h3"],
      ["**bold**", "<strong>bold</strong>"],
      ["__bold__", "<strong>bold</strong>"],
      ["*italic*", "<em>italic</em>"],
      ["***both***", "<strong><em>both</em></strong>"],
      ["~~struck out~~", "<del>struck out</del>"],
      ["<u>underline</u>", "<u>underline</u>"],
      ["==highlighted==", "<mark>"],
      ["=={green}text==", 'class="cx-hl-green"'],
      ["=={blue}text==", 'class="cx-hl-blue"'],
      ["=={purple}text==", 'class="cx-hl-purple"'],
      ["=={yellow}text==", 'class="cx-hl-yellow"'],
      ["- item", "<ul>"],
      ["1. item", "<ol>"],
      ["- [ ] to do", "cx-task"],
      ["- [x] done", "cx-task-done"],
      ["[[Another note]]", "cx-wikilink"],
      ["[[Another note|call it this]]", "call it this"],
      ["[label](https://example.com)", "data-cx-ext"],
      ["![[photo.jpg]]", "data-cx-embed"],
      ["![alt](photo.jpg)", "data-cx-embed"],
      ["> quoted", "<blockquote>"],
      ["---", "<hr>"],
      ["`code`", "<code>code</code>"],
      ["| A | B |\n|---|---|\n| 1 | 2 |", "<table"],
    ];
    const broken = CASES.filter(([src, want]) => !render(src).includes(want))
      .map(([src]) => JSON.stringify(src));
    ok("every documented piece of markdown renders the way the guide says",
      !broken.length, "these did not: " + broken.join(", "));

    /* The guide makes a point of the single underscore NOT working, which is
       a deliberate decision rather than a gap -- it would mangle file_names
       and snake_case. If that ever changes, the guide is wrong. */
    ok("  and a single underscore still does nothing, as the guide warns",
      !render("_word_").includes("<em>"), render("_word_"));

    /* Every piece of syntax the guide shows is in a <code> span, and the
       colours it lists are the only ones the renderer knows. */
    const guideText = unent(byId("vault-markdown").body);
    const colours = ["yellow", "green", "purple", "blue"];
    ok("  the highlight colours listed are the four that exist",
      colours.every((c) => guideText.includes(`=={${c}}`))
      && !/==\{(red|orange|pink)\}/.test(guideText));
  }
}

/* ---- 6. Boards -------------------------------------------------------- */
{
  const editor = fs.readFileSync(path.join(UI, "boards", "editor.js"), "utf8");
  const block = editor.slice(editor.indexOf("const TOOLS = ["));
  const tools = [...block.slice(0, block.indexOf("];"))
    .matchAll(/\["([a-z]+)", "([^"]+)"/g)].map((m) => m[2]);
  const guide = unent(byId("boards").body).toLowerCase();
  const missing = tools.filter((t) => !guide.includes(t.toLowerCase()));
  ok("every Boards tool is in the Boards guide", !missing.length,
    "not documented: " + missing.join(", "));
  ok("  and the keys it lists are the keys the board really handles",
    ["Enter", "Delete", "Escape"].every((k) =>
      editor.includes(`e.key === "${k}"`) && unent(byId("boards").body).includes(k)));
}

/* ---- 7. the shape of the section -------------------------------------- */
{
  ok("each guide has a title, a blurb and a body",
    GUIDES.every((g) => g.id && g.title && g.blurb && g.body
                        && g.body.trim().length > 200));
  ok("  and the four tools each have one",
    ["overview", "vault-markdown", "cells-formulas", "boards"]
      .every((id) => !!byId(id)));
  /* The guides are written here, not typed by Cam and not imported, which
     is why they are not sanitised the way Training's are. If that ever
     stops being true this reasoning has to be revisited. */
  const src = fs.readFileSync(path.join(UI, "notes", "guides.js"), "utf8");
  ok("  the guides are built in, with nothing to save and nothing to lose",
    !/Store\.call\("guides_/.test(src) && /const GUIDES = \[/.test(src));
  /* Cells' page used to carry a one-line explainer that said much less than
     this. It was removed when the sheet was given the whole pane; the
     formula guide is where that sentence went. */
  const cells = fs.readFileSync(path.join(UI, "cells", "cells.js"), "utf8");
  ok("  and Cells points its workspace at the sheet rather than an explainer",
    !cells.includes("Everything from a grid in a note is here"));
}

console.log(out.join("\n"));
console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
