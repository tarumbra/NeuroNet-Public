/* ==========================================================================
   SS.Guides — the Notes section's own handbook.
   ==========================================================================
   Cam: "integrate a guides subsection in notes, that has an overview and
   guide on how to use all the tools within the section. Inclusive of a
   cells formula cheat sheets like how to do SUMS in the cells feature,
   all the markdown text for vault. The guides workspace can be presented
   the same as the guides UI in Main section Training sub section guides."

   TWO THINGS ABOUT THE SHAPE, both deliberate:

   1. The view is "guides:index", NOT "notes:guides". Notes owns every
      view whose name begins with notes: -- it shows and hides its whole
      shell on that prefix -- so a notes:guides view would have opened
      underneath the Vault's editor and shown nothing. Boards and Cells
      already live at boards: and cells: for exactly this reason, and
      sectionOf() files all three under Notes so the menus are right.

   2. The guides are BUILT IN, not records. Training's guides are Cam's
      own writing, stored in his training document and edited in the app.
      These describe the app itself, so they ship with it: there is
      nothing to create, nothing to save, and nothing that can be lost by
      replacing the folder. The UI is Training's -- a search over a list
      of cards, each opening a prose page -- because that is what Cam
      asked for and because he already knows how it works.

   EVERY FORMULA AND EVERY PIECE OF SYNTAX BELOW IS CHECKED BY A TEST.
   test_guides.js runs each documented formula through the real grid
   engine and each markdown example through the real Vault renderer, and
   fails if the answer is not what is written here. A handbook that
   quietly goes out of date with the app is worse than no handbook,
   because it is believed.
   ========================================================================== */
(() => {
  "use strict";

  const esc = (s) => String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  /* ---------------------------------------------------------------- content

     Each guide is {id, title, blurb, body}. `body` is trusted HTML: it is
     written here, in this file, and never comes from a note, a file or
     anything Cam has typed -- so there is nothing to sanitise and nothing
     that could arrive hostile. Training sanitises its guides because
     those ARE typed, into a rich-text editor, and imported from older
     documents.

     A small helper keeps the tables honest: one row, one fact. */
  const row = (...cells) => `<tr>${cells.map((c, i) =>
    `<td${i === 0 ? ' class="gd-k"' : ""}>${c}</td>`).join("")}</tr>`;
  const table = (heads, rows) => `<div class="gd-scroll"><table>
    <thead><tr>${heads.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>
    <tbody>${rows.join("")}</tbody></table></div>`;
  const code = (s) => `<code>${esc(s)}</code>`;

  const GUIDES = [
    {
      id: "overview",
      title: "Notes — what the three tools are for",
      blurb: "Notes, Boards and Cells: which one to reach for, and what they "
        + "share.",
      body: `
        <p>Notes holds three tools. They do not overlap much, and knowing
        which is which saves the most time.</p>

        <h2>Notes</h2>
        <p>Writing. A folder of plain markdown files on your own disk, shown
        as a tree you can nest as deep as you like. Notes link to each other
        with <code>[[double brackets]]</code>, and the Web of Knowledge draws
        those links as a map you can click through.</p>
        <p>A vault also holds PDFs and canvases, opened and tabbed exactly
        like notes, and split view puts any two of them side by side.</p>

        <h2>Boards</h2>
        <p>Thinking on a canvas. Shapes, arrows, text, photos from your
        library and freehand drawing, on pages you can add to. Good for
        anything where the arrangement carries meaning — a plan, a system, a
        diagram — and bad for anything you will want to search later.</p>

        <h2>Cells</h2>
        <p>Numbers. A full spreadsheet: formulas, fill, sorting, filtering,
        number formats, colour rules and charts, exporting to
        <code>.csv</code> or <code>.xlsx</code>.</p>

        <h2>What they share</h2>
        <ul>
          <li><b>The same grid.</b> A sheet in Cells and a grid inserted into
          a note are the same thing with the same formulas. Anything in the
          formula guide works in both.</li>
          <li><b>The same photo library.</b> Boards and notes both take
          pictures from your library rather than the file browser, so a photo
          used in two places is stored once.</li>
          <li><b>Your own files.</b> The vault is real markdown files in a
          real folder. You can open them in anything else, and nothing here
          is locked in a format only this app reads.</li>
        </ul>

        <h2>Printing</h2>
        <p><b>Ctrl+P</b> prints whatever is on screen, anywhere in the app —
        it is not only for training sheets.</p>`,
    },

    {
      id: "vault-markdown",
      title: "Notes — the complete markdown reference",
      blurb: "Every piece of syntax Notes understands, with what it "
        + "produces. Headings, emphasis, lists, tasks, tables, links, "
        + "highlights, code.",
      body: `
        <p>This is everything this app's own renderer understands — not
        markdown in general. Anything not on this list is shown as the plain
        text you typed.</p>
        <p>The toolbar above the editor writes most of it for you, and
        <b>View</b> (the eye) shows the finished result, where you can keep
        typing.</p>

        <h2>Headings</h2>
        ${table(["Type this", "You get"], [
          row(code("# Title"), "The biggest heading"),
          row(code("## Section"), "Second level"),
          row(code("### Subsection"), "Third level, and so on down to six"),
        ])}
        <p>The hashes need a space after them. <code>#tag</code> with no
        space is not a heading.</p>

        <h2>Emphasis</h2>
        ${table(["Type this", "You get"], [
          row(code("**bold**"), "<b>bold</b>"),
          row(code("__bold__"), "<b>bold</b> — the same thing"),
          row(code("*italic*"), "<i>italic</i>"),
          row(code("***both***"), "<b><i>both</i></b>"),
          row(code("~~struck out~~"), "<del>struck out</del>"),
          row(code("<u>underline</u>"), "<u>underline</u>"),
        ])}
        <p><b>A single underscore does nothing.</b> <code>_word_</code> stays
        as it is, on purpose: it would otherwise mangle
        <code>file_names</code> and <code>snake_case</code> every time you
        wrote one.</p>

        <h2>Highlighting</h2>
        ${table(["Type this", "You get"], [
          row(code("==highlighted=="), "<mark>highlighted</mark>, in yellow"),
          row(code("=={green}text=="), "the same, in green"),
          row(code("=={blue}text=="), "in blue"),
          row(code("=={purple}text=="), "in purple"),
          row(code("=={yellow}text=="), "in yellow, said outright"),
        ])}
        <p>Those four are the only colours. Any other name in the braces is
        left as plain text rather than guessed at.</p>

        <h2>Lists</h2>
        ${table(["Type this", "You get"], [
          row(code("- item"), "A bullet. <code>*</code> and <code>+</code> do the same"),
          row(code("1. item"), "A numbered list"),
          row("&nbsp;&nbsp;" + code("- nested"), "Indent to nest a list inside another"),
        ])}
        <p>A line under a bullet with no marker of its own continues that
        bullet rather than starting a paragraph.</p>

        <h2>Tasks</h2>
        ${table(["Type this", "You get"], [
          row(code("- [ ] to do"), "An empty tick box"),
          row(code("- [x] done"), "A ticked box, with the text struck through"),
        ])}
        <p>In View you tick a box by clicking it, and the note's text is
        rewritten to match — the markdown and the tick never disagree.</p>

        <h2>Links</h2>
        ${table(["Type this", "You get"], [
          row(code("[[Another note]]"),
              "A link to that note. Start typing inside the brackets and it "
              + "suggests notes you already have"),
          row(code("[[Another note|call it this]]"),
              "The same link, shown as different words"),
          row(code("[label](https://example.com)"),
              "An ordinary link, opened in your browser"),
        ])}
        <p>A <code>[[link]]</code> to a note that does not exist yet is drawn
        differently, so a typo looks like a typo. Backlinks under a note show
        everything pointing at it, and the Web of Knowledge draws the lot.</p>

        <h2>Pictures</h2>
        ${table(["Type this", "You get"], [
          row(code("![[photo.jpg]]"), "A picture from the vault's attachments"),
          row(code("![[photo.jpg|caption]]"), "The same, with alt text"),
          row(code("![alt](photo.jpg)"), "The ordinary markdown spelling"),
        ])}

        <h2>Quotes, rules and code</h2>
        ${table(["Type this", "You get"], [
          row(code("> quoted"), "An indented quote with a bar down its left"),
          row(code("---"), "A horizontal rule across the page"),
          row(code("\`code\`"), "<code>code</code>, in the middle of a line"),
          row(code("\`\`\`") + " on its own line", "Starts and ends a block of code"),
        ])}
        <p>Whatever is inside backticks is shown exactly as typed. None of
        the rules above apply inside it, which is how this very page shows
        you <code>**bold**</code> without going bold.</p>

        <h2>Tables</h2>
        <pre>| Week | Exercise    | Sets |
|------|-------------|------|
| 1    | Back squat  | 5    |
| 2    | Front squat | 4    |</pre>
        <p>The line of dashes is what makes it a table. Drag a column edge to
        set its width and the dashes are rewritten to remember it, so the
        shape survives closing the note.</p>
        <p>A table too wide for the pane shrinks to fit rather than forcing
        the page sideways, and grows back when you collapse a sidebar.</p>

        <h2>Grids inside a note</h2>
        <p>The toolbar's grid button drops a real spreadsheet into a note —
        the same one Cells uses, with the same formulas. See the formula
        guide.</p>`,
    },

    {
      id: "cells-formulas",
      title: "Cells — the formula cheat sheet",
      blurb: "Every function the grid knows, with a worked example of each, "
        + "plus ranges, operators and what the error codes mean.",
      body: `
        <p>A formula starts with <code>=</code>. Everything here works in a
        sheet in Cells and in a grid inside a note — one engine, both
        places.</p>

        <h2>Adding things up</h2>
        <p>Every worked example below uses the same three cells:
        <b>A1 is 20, A2 is 45, A3 is 5</b>.</p>
        ${table(["Formula", "What it does", "Worked through"], [
          row(code("=SUM(B2:B10)"), "Adds a range",
              code("=SUM(A1:A3)") + " → <b>70</b>"),
          row(code("=SUM(A1,B4,C7)"), "Adds separate cells",
              code("=SUM(A1,A3)") + " → <b>25</b>"),
          row(code("=SUM(A1:A3,C1:C3)"), "Adds several ranges at once",
              "Commas between them"),
        ])}
        <p>Text in a range is skipped rather than counted as zero, so a
        heading caught in a range does not break the total.</p>

        <h2>The rest of the functions</h2>
        ${table(["Formula", "What it does", "Worked through"], [
          row(code("=AVERAGE(A1:A3)"), "The mean of the numbers in a range",
              code("=AVERAGE(A1:A3)") + " → <b>23.3333333333</b>"),
          row(code("=MEDIAN(A1:A3)"), "The middle value",
              code("=MEDIAN(A1:A3)") + " → <b>20</b>"),
          row(code("=MIN(A1:A3)"), "The smallest",
              code("=MIN(A1:A3)") + " → <b>5</b>"),
          row(code("=MAX(A1:A3)"), "The largest",
              code("=MAX(A1:A3)") + " → <b>45</b>"),
          row(code("=COUNT(A1:A3)"), "How many <i>numbers</i>",
              code("=COUNT(A1:A3)") + " → <b>3</b>"),
          row(code("=COUNTA(A1:A3)"), "How many cells are not empty, text included",
              code("=COUNTA(A1:A3)") + " → <b>3</b>"),
          row(code("=ROUND(A1,2)"), "Rounds to that many decimals",
              code("=ROUND(3.14159,2)") + " → <b>3.14</b>"),
          row(code("=ROUND(A1)"), "Rounds to a whole number",
              code("=ROUND(2.5)") + " → <b>3</b>"),
          row(code("=ABS(A1)"), "Drops the minus sign",
              code("=ABS(-7)") + " → <b>7</b>"),
          row(code("=SQRT(A1)"), "Square root",
              code("=SQRT(81)") + " → <b>9</b>"),
          row(code('=IF(A1>10,"over","under")'), "One answer or the other",
              code('=IF(A1>10,"over","under")') + " → <b>over</b>"),
        ])}
        <p>That is the whole list — eleven functions. Anything else gives
        <code>#NAME?</code> rather than a wrong number.</p>

        <h2>Doing arithmetic</h2>
        ${table(["Write", "Meaning", "Example"], [
          row(code("+ - * /"), "Add, subtract, multiply, divide",
              code("=A1*2") + " → <b>40</b>"),
          row(code("^"), "To the power of", code("=2^10") + " → <b>1024</b>"),
          row(code("&"), "Joins text together",
              code('=A1&" kg"') + " → <b>20 kg</b>"),
          row(code("( )"), "Brackets first, as usual",
              code("=(A1+A2)*2") + " → <b>130</b>"),
        ])}

        <h2>Comparing</h2>
        <p>Inside <code>IF</code>: <code>=</code> equals, <code>&lt;&gt;</code>
        does not equal, <code>&lt;</code>, <code>&gt;</code>, <code>&lt;=</code> and
        <code>&gt;=</code> as you would expect.</p>
        <p>So <code>=IF(B2&gt;=100,&quot;hit&quot;,&quot;short&quot;)</code> reads exactly
        as it sounds.</p>

        <h2>Naming cells</h2>
        ${table(["Write", "Means"], [
          row(code("A1"), "That cell. Copy the formula elsewhere and it moves with it"),
          row(code("$A$1"), "That cell, always. Neither part moves when copied"),
          row(code("$A1"), "The column is pinned, the row is not"),
          row(code("A$1"), "The row is pinned, the column is not"),
          row(code("A1:C10"), "Everything in the rectangle between those two corners"),
        ])}
        <p><b>Fill down</b> and <b>Fill right</b> copy a formula through a
        selection and move the references as they go. Pin with
        <code>$</code> what should stay put — a tax rate in one cell, say.</p>

        <h2>When something is wrong</h2>
        ${table(["You see", "It means"], [
          row(code("#DIV/0!"), "Dividing by zero, or averaging nothing"),
          row(code("#NAME?"), "A function this grid does not have"),
          row(code("#REF!"), "Pointing at a cell that no longer exists"),
          row(code("#VALUE!"), "Text where a number was needed"),
          row(code("#NUM!"), "A sum that has no answer, like the root of a negative"),
          row(code("#CIRC!"), "A formula that depends on itself, directly or round a loop"),
          row(code("#ERROR!"), "The formula could not be read at all — usually a bracket"),
        ])}
        <p>An error shows in the one cell that caused it. The rest of the
        sheet keeps working.</p>

        <h2>Number formats</h2>
        <p>The dropdown in the toolbar changes how a number is shown without
        changing the number: General, whole number, one or two decimals, a
        thousands separator, percent, percent with a decimal, and currency.
        A format on a text cell is ignored rather than mangling it.</p>

        <h2>The rest of the toolbar</h2>
        <ul>
          <li><b>+ Row, + Column, − Row, − Column</b> — change the size of
          the sheet. A new sheet starts at 40 columns by 120 rows.</li>
          <li><b>Fill down, Fill right</b> — copy the first cell of a
          selection through the rest of it.</li>
          <li><b>B, I, Fill, Text</b> and the alignment arrows — how cells
          look.</li>
          <li><b>Sort ↑ / Sort ↓</b> — reorder rows by the selected
          column.</li>
          <li><b>Filter</b> — hide rows that do not match. It is a view, and
          never deletes anything.</li>
          <li><b>Rules</b> — colour cells by what is in them, as a
          condition. Later rules win.</li>
          <li><b>Chart</b> — draw the selection as a chart in the page.</li>
          <li><b>Freeze header</b> — keep the first row in view while the
          rest scrolls.</li>
        </ul>

        <h2>Getting numbers in and out</h2>
        <p><b>Import a spreadsheet</b> on the Cells list takes a
        <code>.csv</code>, <code>.tsv</code> or <code>.xlsx</code> and makes a
        sheet of it, keeping formulas as formulas. <b>Export</b> writes
        <code>.csv</code> or <code>.xlsx</code> to your desktop — as the
        values on screen, since a formula pointing at cells another program
        does not have would arrive broken.</p>`,
    },

    {
      id: "vault-working",
      title: "Notes — tabs, split view, PDFs and the web",
      blurb: "Getting around a vault: the tree, tabs, two notes side by "
        + "side, PDFs, canvases and the link map.",
      body: `
        <h2>The tree</h2>
        <p>Folders nest as deep as you like. Drag a note onto a folder to
        move it; right-click for rename, duplicate, delete and move. The
        search box above the tree filters as you type.</p>

        <h2>Tabs</h2>
        <p>Every note you open takes a tab. A dot on a tab means unsaved
        changes, which save themselves a moment after you stop typing.</p>

        <h2>Split view</h2>
        <p>Two notes side by side, or a note beside the PDF you are reading
        from. Drag the divider to change the share. Each side has its own
        Edit and View, so you can write in one and read the other.</p>

        <h2>PDFs</h2>
        <p>Drop a PDF into the vault and it is a real item in the tree,
        opened and tabbed and split like a note. Zoom with the controls in
        its bar.</p>

        <h2>Canvases</h2>
        <p>A canvas is an infinite page of cards you drag around and join
        with arrows — cards of text, whole files, images and links, grouped
        and coloured. Saved as JSON Canvas, the same format Obsidian uses,
        so the file is not trapped here.</p>
        <p>Boards, in its own subsection, is the drawing tool; a canvas is
        for arranging things you have already written.</p>

        <h2>The Web of Knowledge</h2>
        <p>Every <code>[[link]]</code> in the vault, drawn as a map. Notes
        are dots, links are threads. Click one to open it, and use the filter
        to light up the ones that match. Notes nothing points at, and links
        pointing at notes that do not exist, both show up as soon as you look
        at them.</p>

        <h2>Attachments</h2>
        <p>Pictures and files you add live in the vault's own
        <code>attachments</code> folder. It is deliberately not shown in the
        tree — you reach those files through the notes that use them, and a
        folder full of images beside your writing is noise.</p>`,
    },

    {
      id: "boards",
      title: "Boards — drawing and arranging",
      blurb: "The canvas tools, what each one does, and the keys worth "
        + "knowing.",
      body: `
        <p>A board is a page you draw on. Boards have as many pages as you
        like, and each page is its own canvas.</p>

        <h2>The tools</h2>
        ${table(["Tool", "What it makes"], [
          row("<b>Select</b>", "Pick things up, move and resize them"),
          row("<b>Text</b>", "A block of words"),
          row("<b>Photo</b>", "A picture from your library — not the file browser"),
          row("<b>Graph</b>", "A chart drawn on the board"),
          row("<b>Rectangle, Square</b>", "Boxes"),
          row("<b>Ellipse, Circle</b>", "Rounds"),
          row("<b>Triangle, Diamond</b>", "The other two shapes"),
          row("<b>Line, Arrow, Curve</b>", "Joins between things"),
          row("<b>Pencil</b>", "Freehand drawing -- the tool stays picked; V or Escape goes back to Select"),
        ])}

        <h2>Keys worth knowing</h2>
        ${table(["Key", "Does"], [
          row("<b>Enter</b>", "Edit whatever is selected"),
          row("<b>Delete</b>", "Remove it"),
          row("<b>Escape</b>", "Back to Select"),
          row("<b>Ctrl+Z</b>", "Undo"),
        ])}

        <h2>Getting a board out</h2>
        <p>A board exports as a slide deck, one page per slide.</p>

        <h2>When to use a board, and when not to</h2>
        <p>A board is the right tool when the <i>arrangement</i> is the
        point — a plan, a layout, a diagram of how something fits together.
        It is the wrong tool for anything you will want to search or link
        later: that is what Scribe’s Notes are for, and text in a board is a
        picture of words rather than words.</p>`,
    },
  ];

  /* ------------------------------------------------------------------- UI */

  const PLAIN = (html) => String(html)
    .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  let query = "";
  let openId = null;

  function render(host) {
    if (openId) {
      const g = GUIDES.find((x) => x.id === openId);
      if (g) return showGuide(host, g);
      openId = null;
    }
    host.innerHTML = `
      <div class="ss-guides">
        <div class="gd-head">
          <h2 class="page-h">Guides</h2>
          <p class="stamp">How Notes, Boards and Cells work. These ship
            with the app — there is nothing to set up and nothing to lose.</p>
        </div>
        <div class="gd-search">
          <input class="input" id="gd-q" type="search" value="${esc(query)}"
                 placeholder="Search the guides" autocomplete="off">
        </div>
        <div class="gd-list" id="gd-list"></div>
      </div>`;

    const list = host.querySelector("#gd-list");
    const draw = () => {
      const q = query.trim().toLowerCase();
      /* Searching the BODY as well as the title, the way Training's does:
         looking for "SUM" should find the formula sheet even though the
         word is not in its name. */
      const hits = GUIDES.filter((g) => !q
        || g.title.toLowerCase().includes(q)
        || g.blurb.toLowerCase().includes(q)
        || PLAIN(g.body).toLowerCase().includes(q));
      list.innerHTML = hits.length ? hits.map((g) => `
        <button class="gd-card" data-id="${esc(g.id)}">
          <div class="gd-card-top">
            <span class="gd-card-title">${esc(g.title)}</span>
            <svg class="ic" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor"
                    stroke-width="2" stroke-linecap="round"
                    stroke-linejoin="round"/></svg>
          </div>
          <div class="gd-card-sub">${esc(g.blurb)}</div>
        </button>`).join("")
        : `<p class="bd-empty">No guide mentions that.</p>`;
      list.querySelectorAll("[data-id]").forEach((b) =>
        b.onclick = () => { openId = b.dataset.id; render(host); });
    };
    const box = host.querySelector("#gd-q");
    box.addEventListener("input", (e) => { query = e.target.value; draw(); });
    draw();
  }

  function showGuide(host, g) {
    host.innerHTML = `
      <div class="ss-guides">
        <div class="gd-bar">
          <button class="btn btn-quiet" id="gd-back">← Guides</button>
          <strong class="gd-name">${esc(g.title)}</strong>
        </div>
        <div class="gd-prose" id="gd-body">${g.body}</div>
      </div>`;
    host.querySelector("#gd-back").onclick = () => { openId = null; render(host); };
    /* Ctrl+P prints the guide you are reading, like every other page in the
       app. Anchored to the body, so it dies on its own the moment you
       navigate away -- SS.Print's whole design. */
    if (SS.Print && typeof SS.Print.offer === "function") {
      const body = host.querySelector("#gd-body");
      SS.Print.offer(body, g.title, async () => {
        // the house page (2026-10-05): letterhead, title block, the guide, a footer
        const H = SS.PrintHouse;
        await H.load();
        let head = "";
        try { head = await SS.Store.call("print_header", ["Guide", {logo: "notes.png", name: "notes"}], ""); }
        catch (e) { head = ""; }
        const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(g.title)}</title>`
          + `<style>${H.css}</style></head><body>${typeof head === "string" ? head : ""}`
          + `${H.titleBlock("Notes guide", g.title)}${g.body}${H.foot(g.title, "notes")}</body></html>`;
        SS.Store.call("open_print_document", [html, "notes-guide"], "Printing a guide");
      });
    }
  }

  SS.Guides = {
    VIEWS: ["guides:index"],
    PREFIX: "guides:",
    async mount(host) {
      host.style.display = "";
      render(host);
    },
    _test: {GUIDES},
  };
})();
