/* ==========================================================================
   The Kitchen's printing and exporting.
   ==========================================================================
   Cam: "Printing a recipe does not work for some reason would you please
   look into this for me"

   WHAT WAS WRONG. Nothing rendered badly and no printer misbehaved: the
   function was never written. When KinCrux's Kitchen was merged in, a shim
   layer was added to forward its calls to this host (see CP.Store in
   app.js), and five of those forwards pointed at names that did not exist:

       printRecipe  printShoppingList  printBook  exportBook  pdfAvailable

   So pressing Print threw "SS.Store.printRecipe is not a function" inside
   an async click handler with nothing catching it -- no toast, no message,
   a button that simply does nothing. The recipe is the one Cam happened to
   try; the shopping list, the book and the book export were equally dead
   and would have failed the same silent way.

   This file is the missing half. It only builds documents; the Store
   methods that call it live in app.js beside the rest of the shim.

   ONE LETTERHEAD. Every page here starts with the shared header from
   print_header.py -- the same one a Coach Cam session and a Personal
   Effects list use -- because Cam asked for exactly that the same
   morning: "If the application can handle all printouts like this it will
   help keep consistency."

   PAPER, NOT SCREEN. Light background, dark text, generous line height:
   a recipe is read at arm's length on a bench with wet hands, and a page
   of the app's dark theme printed as-is is a page of black ink.
   ========================================================================== */
(function () {
  "use strict";
  const SS = window.SS = window.SS || {};

  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  const BRAND = "#5FA665";
  const INK = "#2E6B38";

  /* Shared by all three documents. Kept in one string rather than three
     so a recipe, a list and a book look like the same kitchen. */
  /* Only the kitchen's own rules: the type, headings, lists and panels are the
     house style (print_header.py, via SS.PrintHouse), which goes first.
     (Cam, 2026-10-05: "I would like all printouts from Neuronet to be handled
     in this way please.") */
  const CSS = `
    .kc-desc { font-size: 14px; color: #3d4740; margin: 0 0 14px; }
    .kc-cols { columns: 2; column-gap: 28px; }
    .kc-cols li { break-inside: avoid; }
    ol.kc-steps li { margin: 0 0 8px; padding-left: 4px; }
    .kc-tick { list-style: none; padding-left: 0; columns: 2; column-gap: 28px; }
    .kc-tick li { display: flex; align-items: center; gap: 10px; padding: 6px 0;
                  border-bottom: 1px solid #e6e9e3; margin: 0; break-inside: avoid; }
    .kc-tick .box { width: 13px; height: 13px; border: 1.5px solid #5d665f;
                    flex: 0 0 13px; border-radius: 3px; }
    .kc-recipe { break-inside: auto; }
    .kc-chapter { page-break-before: always; break-before: page; }
    .kc-cover { text-align: center; padding: 60px 0 30px; }
    .kc-cover .nn-title-block { text-align: center; }
    .kc-cover .nn-title { font-size: 34px; border-bottom: 0; }
    .kc-cover .nn-chips { justify-content: center; }
    .kc-index { list-style: none; padding: 0; }
    .kc-index li { display: flex; gap: 10px; padding: 7px 0; border-bottom: 1px dashed #d6d9d3; margin: 0; }
    .kc-index .n { color: #2E6B38; font-weight: 700; min-width: 26px; }`;

  const H = () => SS.PrintHouse;
  const page = (title, header, body) =>
    `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>`
    + `<style>${H().css}${CSS}</style></head><body><div class="kc-doc">`
    + (header || "") + body + H().foot(title, "camscookery") + "</div></body></html>";

  /** The shared letterhead. An empty string back is survivable: the page
      prints without it rather than not printing, and the recipe was the
      point. */
  /* Cam: "for the print page same as the Cams Coach i would like the logo
     in the top right. PFA the logo for the kitchen sub section printouts.
     If in your opinion it will be better just have the icon and omit the
     text under the camscookery logo."

     The icon only, and the name set as live text beside it -- which is
     what Coach Cam's sheets already do, so the two headers match. The
     wordmark baked into his artwork is about 11px tall once the whole
     logo is scaled to fit a letterhead, which is a smudge rather than a
     word; as text it stays crisp at any size and in any export. */
  const KITCHEN = {logo: "camscookery.svg", name: "camscookery"};

  async function letterhead(title, opts) {
    await SS.PrintHouse.load();
    try {
      const h = await SS.Store.call("print_header", [title,
        Object.assign({}, KITCHEN, opts || {})], "");
      return typeof h === "string" ? h : "";
    } catch (e) {
      return "";
    }
  }

  const lines = (arr) => (arr || []).map((x) => String(x || "").trim())
    .filter(Boolean);

  /* ------------------------------------------------------------- recipe */

  /** `showTitle` is false for a recipe printed on its own: the letterhead
      already has its name centred at the top, and repeating it directly
      underneath reads as a mistake. Inside a book it is true, because
      there a recipe is a chapter and needs its own heading. */
  function recipeBody(r, kicker) {
    const ing = lines(r.ingredients);
    const steps = lines(r.steps);
    const chips = [["Serves", r.servings], ["From", r.source], ["Tags", (r.tags || []).join(", ")],
                   ["Ingredients", ing.length ? String(ing.length) : ""], ["Steps", steps.length ? String(steps.length) : ""]];
    return `<div class="kc-recipe">
      ${H().titleBlock(kicker || "Recipe", r.name || "Recipe", chips)}
      ${r.description ? `<p class="kc-desc">${esc(r.description)}</p>` : ""}
      ${ing.length ? `${H().section("Ingredients")}
        <ul class="${ing.length > 8 ? "kc-cols" : ""}">${ing.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : ""}
      ${steps.length ? `${H().section("Method")}
        <ol class="kc-steps">${steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>` : ""}
      ${r.notes ? H().panel("Notes", `<p>${esc(r.notes)}</p>`) : ""}
    </div>`;
  }

  async function recipeHtml(r) {
    r = r || {};
    // the letterhead says what it is; the title block below names it (2026-10-05)
    const head = await letterhead("Recipe", {});
    return page(r.name || "Recipe", head, recipeBody(r));
  }

  /* ----------------------------------------------------- shopping list */

  async function shoppingListHtml(l) {
    l = l || {};
    const items = lines(l.items);
    const head = await letterhead("Shopping list", {}) + H().titleBlock("Shopping list",
      l.title || "Shopping list", [["Items", String(items.length)]]);
    /* A box beside each line, because this one is going round a shop in a
       hand, not being read at a desk. */
    const body = items.length
      ? `<ul class="kc-tick">${items.map((i) =>
          `<li><span class="box"></span><span>${esc(i)}</span></li>`).join("")}</ul>`
      : `<p>Nothing on this list yet.</p>`;
    return page(l.title || "Shopping list", head, body);
  }

  /* --------------------------------------------------------------- book */

  /** The cover logo is an SVG path the Kitchen already picked for the book
      -- the same drawing the screen shows, so the printed cover and the
      one on screen cannot disagree. */
  function coverMark(path) {
    if (!path) return "";
    return `<svg viewBox="0 0 24 24" width="54" height="54"
      xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto"
      fill="none" stroke="${BRAND}" stroke-width="1.4"
      stroke-linecap="round" stroke-linejoin="round"><path d="${esc(path)}"/></svg>`;
  }

  async function bookHtml(book, allRecipes) {
    book = book || {};
    const byId = new Map((allRecipes || []).map((r) => [r.id, r]));
    /* Kept in the order Cam put them in the book, not sorted: a recipe
       book has a running order, and re-sorting it would be a second
       opinion about his own book. Anything whose recipe has since been
       deleted is skipped rather than printed as a blank chapter. */
    const chosen = (book.recipeIds || []).map((id) => byId.get(id)).filter(Boolean);
    const head = await letterhead("Recipe book", {});
    const cover = `<div class="kc-cover">${coverMark(book.logoPath)}
      ${H().titleBlock("Recipe book", book.name || "Recipe book",
        [["Recipes", String(chosen.length)]])}
      ${book.notes ? `<p class="kc-desc">${esc(book.notes)}</p>` : ""}</div>`;
    const contents = chosen.length ? `${H().section("Contents")}
      <ol class="kc-index">${chosen.map((r, i) =>
        `<li><span class="n">${i + 1}</span><span>${esc(r.name || "Recipe")}</span></li>`).join("")}</ol>` : "";
    const body = chosen.map((r, i) =>
      `<div class="kc-chapter">${recipeBody(r, `Recipe ${i + 1} of ${chosen.length}`)}</div>`).join("");
    return page(book.name || "Recipe book", head,
      cover + contents + (body || `<p>No recipes in this book yet.</p>`));
  }

  SS.CookeryPrint = {
    recipeHtml, shoppingListHtml, bookHtml,
    _test: {recipeBody, lines, coverMark, CSS},
  };
})();
