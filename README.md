# NeuroNet

> **Quick access and its keys** (Super+Alt+ a key for every tool, NeuroNet in the background): see [QUICK-ACCESS.md](QUICK-ACCESS.md).

Formerly SynapSoul, then Cam's Collective S, then Meus Cerebro, and merged
along the way with KinCrux. One window for the things Cam does for herself: a photo library, music
(Chords), puzzles (Cranium), divination and mindfulness (Celestial),
training (Coach Cam) and notes (Amnesia).

    python3 neuronet.py

Sister app to **KinCrux**, which holds the household side — kitchen, family
library, notes and money. Both share the same core (`crux/`), so they look
and behave alike.





## The dashboard

**Three columns, three widgets each.** Press **Edit layout** and drag a widget
by its grip into any column and any place in it; the column highlights and a
line shows where it will sit. A column already holding three says so rather
than taking a fourth. Every widget is the same height, so a photo frame is a
widget rather than the whole page.

The arrangement is saved and comes back next launch. Widgets arranged under
the earlier free grid are moved into columns once, in the order they were on
screen, so no arrangement is lost. A narrow window shows one column.

`test/test_dashboard.py` guards it.

## Money prints on Cashbox letterhead

Every page Money prints -- the period sheets and the calculation summary --
opens with the shared letterhead -- NeuroNet top left, the title in the
middle, the Cashbox logo and "cashbox" on the right, like every other
section's printouts. The logo lives in `icons/cashbox.png` only: replace that
file and every Money printout follows. It is made from Cam's artwork
(`~/Videos/CashBox Icon.jpeg`): the emblem alone, on a transparent ground, in
the letterhead's deep green, since green-on-black prints as a black square and
the light green is too faint on white paper. Money has no other export.

`test/test_money_print.py` guards it.

## Fleeting notes

**Notes → Fleeting** holds quick thoughts as a numbered queue. Jot one on the
dashboard's **Quick note** block (Ctrl+Enter saves) or on the Fleeting screen
itself; copy one out into a Vault note, then delete it and the rest close up,
so the numbers stay a queue.

They are ordinary notes in a `Fleeting` folder of the vault, so they open in
Notes, go into books, and are visible to anything else pointed at the vault.
A note you name yourself in that folder is left alone and stays out of the
queue.

The dashboard also has a **Random circuit** block: one of your circuits at
random, scrollable, with "Another" for the next — and it never hands back the
one already showing.

`test/test_fleeting.py` guards both.

## Puzzle, Quick recipe and the Fleeting viewer

Three more dashboard widgets, added from **Edit layout → + Add a block**.

**Puzzle** plays a Sudoku (easy), Kakuro (small), Minesweeper (beginner) or a
word search, picked by the tabs across its top; **New** deals another. The
puzzles come from Cranium's own generators, so every Sudoku and Kakuro has
exactly one solution. Click a cell and type a digit (or use the pad under the
board); arrows move around. In Minesweeper, right-click flags and clicking an
opened number opens its neighbours. In a word search, click a word's first
letter and then its last. Each tab keeps its own game while you look at the
others; the tab showing is remembered, a game in progress is not.

**Quick recipe** takes a title, then the ingredients, then the directions, one
at a time — **Enter** moves on (Shift+Enter for a new line), and the third
Enter saves it into Recipes and starts again. Pasted lists are split exactly
as the recipe builder splits them, bullets and step numbers removed. Open it in
Recipes later to add the rest.

**Fleeting viewer** reads the Fleeting queue one note at a time, from note 1;
the arrows (or ← →) walk it, a long note scrolls inside the widget, and
**Delete** removes it from Fleeting itself, so the numbers close up behind it.
**A− / A+** (2026-10-02) scale the text in six steps, kept on the block
(`textScale` in `dashBlocks`); the text box has a ceiling, so a big note
scrolls rather than stretching the widget.

`test/test_dashboard_widgets.js` plays all three.

## The qt renderer and permission requests

With `--gui qt`, pywebview 6.2.1 answered the page's permission requests with
bare numbers, which PyQt6 6.11 rejects; PyQt turns that error into an abort,
so any request -- pressing Copy was enough -- closed NeuroNet outright
(SIGABRT in the crash log). `neuronet.py` now installs its own answer before
the window opens: the same rules as pywebview's, given in the form PyQt6
accepts, plus the clipboard for NeuroNet's own pages so Copy copies. It lives
in NeuroNet, not in pywebview's files, so upgrading pywebview cannot undo it.

`test/test_qt_permissions.py` guards it.


## The dashboard

**Edit layout** now lets you **drag blocks into place**. The up and down
arrows are gone — three buttons crowded into a corner sat on top of the
block's own heading. Each block keeps a strip of its own for its grip,
settings and remove.

**Music block** — your saved playlists and albums, one click from playing, so
the app can start music the moment it opens. It reads the shelves from Music
itself every time it draws, and plays an album through the same function the
Albums shelf uses, so the two can never behave differently.

`test/test_dashboard.py` guards it.


## Your own order, and your favourites

**Hold the right mouse button on any card** — a main section on the left, a
subsection on the right — and move it. Let go where it should sit. The left
button only ever opens a card, so a click can never turn into a move by
accident (Cam: *"this is to not mess up the clicking of the icon"*). The same
right-button drag drops a main section onto a Multitask side. The order is
remembered. A saved order only lists what you have moved, so anything the
app gains later still appears rather than vanishing because an old list
never heard of it. A drag only affects the menu it started in; Esc cancels.

**Star a subsection** (the star appears on its card when you hover) and it
turns up on **Home** as a quick link straight to it. Starring never also
opens the section.

The app **opens on Home**, where the favourites are.

`test/test_nav_order.py` guards all of it.


## One app

NeuroNet is one app with several tools, not several apps side by side.

**The top bar** runs across every screen: the music player, and the date and
time. Tools keep only their own controls beneath it — Cranium its game title,
buttons and zoom; Notes its editor toolbar; Training its page headers. The
bar's styles live in `ui/topbar.css`, generated from the music styles by
`make_topbar_css.py`; its layout (three columns, so the player can never run
over the clock) is NeuroNet's own, in `shared.css`.

**Settings → Text size** grows the words. **Settings → UI scale** (90–200%)
grows everything together — text, buttons, spacing, icons — and keeps text
sharp. Use both to get the size right. Text size used to reach only the music
section: every other tool sized its text in fixed pixels. They now use rem,
and at Normal every text size is identical to what it was.

**The menu collapses** to icons with the arrow beside the NeuroNet name. While
collapsed, hovering a button shows its name. The choice is remembered.

`test/test_one_app.py` guards each of these decisions.

## Training

Moved here from KinCrux, whole: sessions, circuits, exercises, guides,
calendar, programs, training books, athletes, calculators and Lens (the
read-only gym view). Cam: *"I want the training features to be moved from
KinCrux to NeuroNet please, remove it from KinCrux entirely."*

It is Coach Cam's own code, carried across rather than rewritten, so a
session prints here exactly as it prints from Coach Cam.

**This is a separate library from standalone Coach Cam.** Coach Cam still
runs alongside, over its own `coach_cam_data/`. Edits in one do not appear
in the other. NeuroNet's training location is fixed deliberately — it
never searches for Coach Cam's folder — so it can never silently switch to
a different library because that folder became findable one day.

## Notes

Amnesia's notes vault — notes, canvases and PDF textbooks. Copied here
from KinCrux, **not moved**: Cam: *"Do not remove it from KinCrux, as they
will be used to store different variations of notes and store different
PDF textbooks."*

**NeuroNet's vault is its own.** KinCrux's Notes finds its vault by
searching — for standalone Amnesia's folder first, because there sharing
one vault was the point. NeuroNet's never searches: its vault is fixed at
`neuronet_data/notes/vault/`, so it cannot open KinCrux's or Amnesia's by
accident. `test/test_notes_vault.py` plants decoy vaults where a search
would look and fails if NeuroNet touches any of them.

The vault is a real folder of real `.md` files. Obsidian can open it.

**PDFs.** Notes renders them with pdf.js, which lives in
`ui/notes/vendor/pdfjs/`. It had never worked in KinCrux: when Amnesia's
code moved into a `notes/` subfolder, its relative path to the library
silently started pointing at a folder that did not exist. The library and
its worker now resolve from where the Notes script actually loads, so a
long textbook is parsed off the main thread and the window stays usable.


## The merge

KinCrux's tools live here now: **Home** (dashboard, calendar, contacts),
**Kitchen** and **Money**. **Games** became **Puzzles**, with each puzzle its
own entry in the right-hand menu.

Nothing was moved to make this work. Kitchen, Home and Money read KinCrux's
own files exactly where they sit — `camily.json`, `cookery.json` and the money
file — so the merge cannot strand anything, and the old app still opens the
same files. `kitchen_backend.py` is KinCrux's data layer, brought across whole.

The one thing that IS combined is the photo library, and only when asked:
**Settings → KinCrux's photo library**. It shows what would happen first and
writes nothing until you agree. KinCrux's copy is never changed, a name clash
keeps both photos, the same picture under another name is skipped, albums of
the same name are joined rather than duplicated, and running it twice brings
nothing across twice.

`test/test_merge.py` guards all of it, including the library merge, which it
runs for real against a throwaway pair of libraries.

## Boards — freeform drawing, under Notes

**Notes → Boards.** New board, then draw: text, photos, graphs, rectangles,
squares, ellipses, circles, triangles, diamonds, lines, arrows, curves and
freehand (the pencil). Select and drag to move, corner handle to resize,
Front/Forward/Backward/Back to layer, zoom 25–200%, **Ctrl+Z** to
undo, **Delete** to remove, **Enter** or **Edit** to change the selected item.

**The toolbar (2026-09-29).** Cam: *"i reckon we build a side buildbar on
the side of the canvas (like a photoshop, paint tool bar)."* The tools run
down the left of the canvas in groups:

- **Select** (V)
- **Insert**: Text (T), Photo, Graph
- **Shapes**: Rectangle (R), Square, Ellipse (E), Circle, Triangle, Diamond
- **Draw**: Pencil (P), Line (L), Arrow (A), Curve (C)

A tool's letter picks it.

- **Line / Arrow** (*"i want the abiility to draw the line and arrow
  myself"*): press where it starts and drag to where it ends, in any
  direction. Shift keeps it to 15° steps. Selected, each end has its own
  handle. They used to be squared into a top-left-to-bottom-right box, so
  every line pointed the same way.
- **Curve** (*"Need more freedom with the curve tool"*): drag the line, then
  drag to bend it. The curve passes through the pointer. Drag once more for
  an S. Enter, Escape or a click finishes. Selected, its two ends (dots) and
  two bend points (diamonds) can be dragged anywhere. Moving an end takes its
  bend point along.
- **Pencil**: freehand, drawn smooth. Drawing tools stay picked after a
  stroke; the others go back to Select once placed.
- **Colours** (*"select the colours for the line and fill then place it
  with those ... stay persistent until i change them (please include an
  indicator so i know what i have selected)"*): the indicator shows the line
  colour (a ring, in front) and the fill (behind). Click one, then a swatch,
  **no fill**, or the rainbow for any colour. ⇄ swaps them. **Line width**
  is 1–10 px. The words underneath repeat what's picked. New things are made
  with these, and they stay picked across boards and restarts (localStorage
  `nn:boards:style`). With something selected, picking a colour or width
  changes it too.

**Typing in a text box** (Cam: *"when inserting a text box and clicking it i
cannot type anything it justs shows the placeholder text"*). Words used to
be changeable only in a dialog. Now a new text box has the cursor in it
straight away, as does a click on a selected text box, a double-click, or
Enter. Enter makes a new line; clicking away, Escape or Ctrl+Enter finishes.
A new box left empty is removed. **Edit** still opens the dialog, which also
sets the size.

Lines, arrows and curves are stored as their points (`pts`: two for a line,
four for a curve). Boards saved before are drawn exactly as they were, and
get points when opened, in memory like `repairIds`.
`test/test_boards_tools.js` drives all of this in the real editor.

**Photos come from the app's own library**, so a board can only hold a photo
that is already in Cam's Collective S.

**Pages** — a board is a stack of pages, and each page becomes one slide when
exported. **Snapshots** keep a copy of every page inside the board itself, so
they travel with it; restoring one is undoable.

**Exports.** *Export PNG* saves the page into the photo library as a real
photo (tagged `board`) — from there the viewer's own **Export** button saves
it to the desktop, which is the path that already existed rather than a
second one. *Export PowerPoint*, on the board list, makes one slide per page
across the boards you tick; it checks first whether this machine can write a
`.pptx` and says so plainly if not.

Each board is a file in `neuronet_data/notes/boards/` — beside the vault,
not inside it, so drawing data does not clutter the vault in Obsidian. Saving
is atomic, a board id can never write outside its folder, and a board that
cannot be read is listed with the reason rather than replaced.

`test/test_boards.py`, `test_boards_move.js` and `test_boards_tools.js` guard it.

## Scrapbook — Boards with materials, paper and a cover (1.0.7)

Cam (2026-10-02): *"Scrapbook, which should have the same toolbar as boards,
but also contain a collapseable scrapbook materials (this will have designed
coloured tapes, frames, stickers (Which i can make from any photo). Any other
common scrapbook materials you suggest) The paper will be selectable from
different colours and will allow each page to have a different type of paper.)
Furthermore it will have a cover which the material can be changed from wood,
fur, colour, metal, ect."*

**Creative → Scrapbook** (view `scrapbook:shelf`; under the Vault until 1.0.11). The shelf shows each book's
cover; New scrapbook picks a page size (12×12 or 8½×11), cover and first paper.

**One editor, not two.** A scrapbook opens in Boards' own editor
(`SS.BoardEditor.open(host, id, book, onBack, opts)`); the options add the
materials panel (`panel`), Turn / Paper / Cover (`bar2`), saving through
`scrapbooks_write` (`saveCall`), editing of materials (`editItem`), drops on
the canvas (`dropAt`) and photos kept at most 1400 px (`photoSrc`). Boards
passes no options and is unchanged. Every Boards tool works in a scrapbook,
and a fix to one is a fix to both.

**The materials** (`ui/scrapbook/materials.js`, `SS.ScrapArt`) are drawn as
SVG, with no image files: item kinds `tape`, `frame`, `sticker`, `emb` and
`word`, each with a `style` and its colour in `fill`, so the palette
recolours them. Boards' `itemSVG` hands these kinds to `SS.ScrapArt.itemSVG`,
so the screen, Export PNG and notebook prints all use one drawing. Any item
can carry `rot` (degrees), drawn turned about its middle.

**Paper per page.** `page.paper` and `page.paperColour`, falling back to the
book's `paper`. Scrapbook paper names never clash with Boards' grid, graph,
blank and colour. **The cover** is `book.cover = {material, colour, title}`,
drawn by `SS.ScrapArt.coverSVG`.

**Stickers from photos.** The sticker maker cuts a photo to a shape (circle,
heart, star and scallop come from the middle square of the photo) or *cuts
out* the subject: everything joined to the edge by colour close to the edge's
median colour is dropped (`cutoutMask`), specks are removed, and a white
border is grown round what's left (`grow`, a chamfer distance). The pixel
work is plain arrays, so it's tested without a canvas. Saved stickers are
PNGs in `notes/scrapbooks/stickers/` with `stickers.json`. A sticker placed on
a page is a copy, so removing it from the book never empties a page.

Each scrapbook is a file in `neuronet_data/notes/scrapbooks/`, kept like a
board: atomic saves, an id that can't leave its folder, and an unreadable one
listed with the reason, never replaced. Photo renames reach scrapbooks
(`_photo_ref_paths`), and a notebook can hold one (type `scrapbook`).
`test/test_scrapbook.py` (backend) and `test/test_scrapbook.js` (the page, in
the real app) guard it.

## Creative and Scribe — the menu, 1.0.11

Cam (2026-10-03): *"lets create new main section called Creative - Scrap book,
Boards, paper creator and assets can live in there (later a vector graphic
tool and Pixel art tool in the future). Then change main section vault to be
called scribe."* Creative is main section `creative` (icon `i-creative`,
accent #e0789e, first page the Scrapbook, key Super+Alt+B in
`system/hypr/bindings.lua.block`, the launcher, `neuronet-menu` and the Neuro
Guide). Its pages keep their views (`scrapbook:shelf`, `boards:list`,
`paper:make`, `assets:library`); `sectionOf()` files those prefixes under
`creative`. The Vault is renamed **Scribe** in name only: its key is still
`notes`, so prefs, hidden sections, Multitask and Super+Alt+N are unchanged. A
future tool is one more child here with its own prefix. `inSavedOrder` now
puts a section (or page) a saved menu order has never seen after the one it
follows in the usual order. test_paper_assets.py, test_scrapbook.py,
test_neuro_guide.js, test_quick_access.js and test_multitask.js check it.

## Vector — shapes, paths and lettering (1.0.13)

Cam (2026-10-04), after an honest answer (a home-built tool covers the
everyday 80%; Inkscape the rest): *"please get started on the vector tool in
Neuronet"*. So it reads and writes plain SVG, and Inkscape is the next step up.

**Creative → Vector** (view `vector:studio`, `ui/vector/vector.js|css`,
`SS.Vector`). The drawing is plain JSON, all its maths in
`ui/vector/vectorcore.js` (`VectorCore`, no DOM, tested in node): layers
(bottom first) of items -- `path` {subs:[{nodes, closed}], rule}, nodes with
ABSOLUTE handle points (ix,iy / ox,oy; equal to x,y = no handle) so every
transform is one function over points; `text`; `image`; `group`. Paint is
null, a colour, or a gradient {type, angle, stops}. Shapes (rect with round
corners, ellipse as four smooth nodes, polygon, star, line), transforms (strokes
scale with shapes; text keeps its own size and angle), exact bounds (cubic
extrema), freehand smoothing (Ramer-Douglas-Peucker then Catmull-Rom), smooth/
corner nodes, align, distribute, and `docSVG` -- the one SVG that is drawn (with
`ids` for hit-testing), saved and exported.

**Paper.js** (v0.12.18, MIT, `ui/vector/vendor/paper-core.min.js` + its
licence; loaded by `ensurePaper()` the first time Vector opens, never with the
app) does what needs real curve maths: combining shapes (`combine`: union,
intersect, exclude take all chosen; subtract = Illustrator's Minus Front, the
result keeping the back shape's look), simplify, add-node (`divideAt` nearest),
and reading SVG (`importSVG`: groups, transforms baked into points, clip masks
dropped, fill/stroke/opacity/dash/caps, gradients, text, embedded pictures).
Loading it with the app broke every jsdom page test (Paper takes jsdom for node
and calls `require`); test_vector.js loads it by hand with a dummy `require`.

Hitting things on the canvas is the browser's own: each item is a `<g
data-id>` (plus an invisible wide stroke so thin lines can be clicked);
handles are `data-h`, nodes `data-node`, handles of nodes `data-hd`. Undo
stores the drawing as JSON (80 steps). A drawing is an asset (kind `vector`):
its picture is the SVG itself, its design the drawing; saving, in progress /
completed and autosave work as in Pixel art. Exports go through
`creative_save_file` (which Pixel art's `pixel_save_file` now calls);
`vector_open_svg` reads an SVG file. `test/test_vector.js` guards it.

## Pixel art — sprites and game assets, Aseprite-style (1.0.12)

Cam (2026-10-04): *"Create a pixel art creator in the creative section as well
where i can make game assests think asesprite style with the side bars,
layering, animation, colour palettes (default and ability to create or import
palettes. Also the ability to export to asesprite or png. I can choose to save
them as in progress or completed works. Please provide starting pet templates i
can build off as well"* -- and *"add all game assets into assests sub section
now. Also create a folder for in progres"*.

**Creative → Pixel art** (view `pixel:studio`, `ui/pixel/pixel.js|css`,
`SS.Pixel`). All picture work is `ui/pixel/pixelcore.js` (`PixelCore`, no DOM,
also `require()`-able): RGBA `Uint8ClampedArray`s; tools (dab with size and
mirror, Bresenham line, rect, ellipse, 4-way fill, shift, flip); projects
`{kind:"pixel", w, h, layers (bottom first) [{id,name,visible,opacity}],
frames [{dur}], cels {layerId: [img|null per frame]}, palette}`; layer/frame
operations; `serialise` (cels as base64, empties null). **Files are written
here, byte by byte**: `png()` (stored deflate blocks, CRC32, Adler-32) and
`aseprite()` per Aseprite's published spec — 128-byte header, colour depth 32,
first frame carries the palette chunk (0x2019) and the layer chunks (0x2004),
every frame one raw cel (0x2005, type 0) per non-empty layer, cropped. An
independent reader (npm `ase-parser`) reads them back in test_pixel.js when
it's installed. Palettes: built in (`PixelCore.PALETTES` + a NeuroPets palette
built from petart's colours), Cam's own in `neuronet_data/assets/palettes.json`
(`pixel_palettes`, `pixel_palettes_save`); `parsePalette` reads .gpl, .hex,
JASC .pal and Paint.NET .txt, `paletteFromImage` a picture; changing a built-in
makes a copy, "My …". Exports go through `pixel_save_file(name, b64)` (save
dialog). **Templates**: `templates(PetArt, PetCore)` = every NeuroPets sprite
(NeuroNet's page loads `ui/pet/petart.js` and `petcore.js` for this);
`fromTemplate` makes pets a four-frame idle on Colour / Outline / Face layers.

A sprite is an **asset** (kind `pixel`): its picture is frame 1 enlarged to at
least 256 px (crisp on a page), its design the serialised project, stage
`wip` or `done`. Once saved it saves itself 1.2 s after each change. Assets has
**In progress** and **Completed works** folders (`stage`, paper_assets.STAGES;
a category lists its completed works) and **Game assets** (category `game`),
whose built-ins are the NeuroPets templates ("Open in Pixel art").
`test/test_pixel.js` (engine + page + Assets) and `test/test_paper_assets.py`
(stages, palettes, export files) guard it.

## Paper creator — paper and notebook covers (1.0.10)

Cam (2026-10-03): *"please create me a paper creator. This is a simple tool
which will print my selected paper at my selected size. Also it will have a
cover creator. Borrowing the tools from scrapbook i can create a cover in my
selected size A5 - A4 or custom size (i create pocket notebooks). I want to be
able to design them within our app."* His reference pictures (in
`~/Pictures/Paper tool`) were square grid, dot grid and lined paper.

**Creative → Paper creator** (view `paper:make`, `ui/paper/paper.js|css`,
`SS.Paper`), two halves: Paper and Covers (the half shown is remembered in
`nn:paper:tab`).

**Paper** is drawn in millimetres: `paperSVG(design)` is an SVG whose viewBox
is the page in mm (lined, grid with bold every N squares, dot grid,
isometric dots, Cornell notes, music staves, blank; spacing, margin, line
weight, colours, margin line, title-and-date line). Each page's lines or dots
are ONE path (a dot is a zero-length round-capped stroke), so a 200-page print
stays small. Sizes: A4, A5, A6, B6, pocket (3½ × 5½ in), passport, traveler's
notebook, Letter, half letter, custom; landscape swaps the sides. The design on
screen is remembered (`nn:paper:design`); **My papers** are saved to
`neuronet_data/notes/paper/designs.json` (`paper_designs`, `paper_designs_save`).

**Printing** (`printHTML`, through `open_print_document(html, "paper")`): the
print view's `@page` is the exact size, so the page prints at its own size —
or on A4 / A3 / Letter sheets with as many as fit (`layout`), with a 6 mm edge
for cut marks when that loses nothing, or edge to edge when that fits more (two
A5s or four A6s on an A4), in which case the cuts are faint dashed lines
between the pages. The view says to print at Actual size / 100 %. The sheet's way up
is a choice (1.0.10.1, Cam: *"have ability to print it landscape as well for
both paper tool and scrap book"*): `layout(pw, ph, sheet, orient, fit)` with
`orient` auto | portrait | landscape; `fit` puts one page to a sheet, shrunk
(never enlarged) when it is bigger. `SS.Paper.printDialog` is the one print
dialog for covers and scrapbooks; the Scrapbook's Print… measures its pages as
12 in square or 11 in along a letter page's long side (`pageMM`), and new
scrapbooks can be 11 × 8½ landscape.

**Covers** are the Scrapbook's editor with its whole materials panel
(`SS.Scrapbook.makeKit`), on a board measured at `PX_PER_MM` (5). A cover's
`spec` is {size, w, h, landscape, layout: front | wrap, spine (mm, 0 for a
stapled pocket notebook), bleed (0 or 3 mm), material, colour}; `coverGeometry`
turns it into the trimmed size and the board's pixels. The material is drawn
behind everything by the editor's background hook
(`SS.BoardEditor.addBackground("cover", ...)` → `SS.ScrapArt.materialSVG`, the
scrapbook covers' textures without their binding or label). Fold, spine, trim
and safe-area guides come from the editor's `overlay` option: on screen only,
never in Export PNG or a print. Size & material can be changed later
(`respec` moves everything with the cover's middle). A second page is the
inside of the cover. Covers print at their real size the same way as paper
(kind `"cover"`). Each is a file in `neuronet_data/notes/covers/`
(`covers_list/read/write/delete`), and photo renames reach them.

`test/test_paper.js` (the page, the mm geometry, sheets and cut marks, covers
end to end) and `test/test_paper_assets.py` (backend and wiring) guard it.

## Assets — clip art, stickers, backgrounds and more (1.0.10)

Cam (2026-10-03): *"lets add a new feature called assets, This is where i can
go in and upload new assets into their respective categories or create them.
So for example all the assets used in scrapbook and boards (These assets can
then be used in projects straight from the app."* And: *"At a later date i
will purchase some digitally and provide it to you to add."*

**Creative → Assets** (view `assets:library`, `ui/assets/assets.js|css`,
`SS.Assets`). Categories (the same list in `paper_assets.CATEGORIES` and the
page): Clip art, Stickers, Backgrounds & papers, Borders & frames, Tapes &
ribbons, Words & labels, Other. Each shows **Yours**, the **Sticker book**
(stickers made from photos) and **Built in** — the clip art and every
Scrapbook material, so this is the one place to see what there is.

**Built-in clip art** (`ui/assets/clipart.js`, `SS.ClipArt`): 62 original
pieces in six groups, each drawn in one colour plus white highlights. On a
page they are item kind `clip` (`art`, `fill`), drawn by `SS.ScrapArt`, and the
palette recolours them whichever well (line or fill) is chosen. Bought clip art
is NOT added to this file: it goes into Assets as files.

**Your assets** live in `neuronet_data/assets/` (`paper_assets.py`):
`assets.json` plus each picture exactly as it came (`<id>.png|jpg|webp|gif|svg`,
25 MB each at most), and `<id>.design.json` for one made in NeuroNet. Add them
by Choose pictures, **Import a pack of files** (a native dialog taking any
number at once — for bought packs; non-pictures are listed as skipped), From
your Photos, or by dropping files on the page. **Create one** opens the
Scrapbook's editor on its own canvas (see-through unless it's a background,
`addBackground("asset", ...)`); it saves itself as you go (the editor's `save`
option) as a PNG trimmed to what's drawn, with its design, and Edit opens it
again. The list carries no pictures; each is fetched once, when on screen
(`SS.AssetStore.data/thumb`).

**Using them.** The materials panel (`SS.Scrapbook.makeKit(key, defaults)`)
has an *Assets & clip art* group with a category filter and search, in the
Scrapbook, Covers, the asset maker and — folded away at first, its state kept
apart in `nn:boards:panel` — Boards. An asset goes on a page as a copy of its
picture (item kind `asset`, no sticker shadow), so deleting it from Assets
never empties a page; a background fills the page and goes to the back; very
large pictures are kept at 2400 px (PNGs stay PNG).

`test/test_assets.js` (the page, uploads and drops, creating, use in a
scrapbook and a board) and `test/test_paper_assets.py` (backend) guard it.

## Notes: choose and press Delete (1.0.10)

Cam (2026-10-03): *"in notes in neuronet i want to be able to select a note
and press delete to delete it."* A click in the Notes sidebar chooses the item
(and opens it, as before) and leaves the keys with the sidebar; Ctrl+click
chooses more; Escape clears. Delete asks the same "can't be undone" question as
the right-click Delete (several are asked about once), and Delete while
renaming is just typing. Right-clicking one of several chosen offers to delete
them all. `test/test_notes_module.js` guards it.

## Cells — spreadsheets of their own

**Notes → Cells.** The same grid as inside a note, on a page of its own:
formulas, fill down and series, sorting, filtering, number formats, bold and
colours, conditional rules and charts — all of it the code Grid already uses,
not a second spreadsheet that can drift.

**Import** a `.csv`, `.tsv` or `.xlsx` and it becomes a sheet named after the
file. Cells keep the text they held, so an imported `=B2*5` is still a formula
and this grid works it out.

**Export .csv / .xlsx** saves to the desktop. Exports carry the VALUES you see,
worked out by the same engine that draws them — a formula pointing at cells
another program does not have would arrive broken. A second export never
overwrites the first, and `.xlsx` says plainly if openpyxl is missing.

Sheets live in `neuronet_data/notes/cells/`, beside the boards and the vault,
one file each, saved atomically. A sheet that cannot be read is listed with
the reason rather than replaced.

`test/test_cells.py` guards it.

## Grid — a spreadsheet in a note

The **Grid** button in Notes' bottom toolbar, beside Table. It inserts a
spreadsheet and switches to View, where a grid works.

Formulas (`=B2*5`, `=SUM(B2:B10)`, AVERAGE, MIN, MAX, MEDIAN, COUNT, ROUND,
IF and more), fill down and series with **Ctrl+D** / **Ctrl+R**, sort,
filter, bold and italic, fill and text colours, number formats, rules that
colour cells automatically, and bar or line charts. Copy and paste works with
Excel, including cells holding tabs or line breaks.

**A grid lives inside the note**, as a ```grid block of plain text — one row
per line. The vault stays readable in Obsidian, and a grid is saved, autosaved
and undone exactly like any other edit.

Some rules it keeps, which are the easy things to get wrong:

- **Sorting** keeps the header in place, puts blanks last, and moves each
  row's formulas and colours with it, so a total still reads its own row.
- **Filtering only hides rows.** It says how many are hidden and never
  deletes one.
- **A gap in a chart breaks the line** rather than dropping to zero, and bars
  are measured from zero, so lengths stay honest.
- **A fill with no text colour** gets dark or light text by the fill's
  brightness — every combination is above the AA contrast standard, selected
  or not.
- **A grid block that cannot be read is left exactly as it is**, with the
  reason shown. Nothing is ever saved over it.

`test/test_grid_engine.js` (88 checks) covers the calculating;
`test/test_grid_notes.py` covers how a grid sits inside a note — including
three separate defences that stop a note ever being rebuilt from a grid
alone. Each was shown, on its own, to prevent that.

## Where your data lives

Everything is inside the app folder, together:

    NeuroNet/
      neuronet.py
      ui/ ...
      neuronet_data/
        neuronet.json       the photo library
        photos/ ...
        chords/              music
        cranium/             saved games
        training/            coaching document, prefs, backups
        notes/
          vault/             your notes and PDF textbooks
          prefs.json

This reverses an earlier choice. The folder used to live *beside* the app,
so that replacing the app folder could not delete it. Keeping everything
together is Cam's call and a reasonable one — but it moves the danger
rather than removing it. So:

## Moving from SynapSoul to NeuroNet — the one-off rename

The app used to be called SynapSoul, and everything in it was named to
match: the folder, `synapsoul.py`, `synapsoul_data/`, the marker file
inside it, and the settings file. All of those changed at once.

**The simple way: rename your existing folder.** Rename
`/mnt/Cams_Collective/SynapSoul` to `/home/tarumbra/DataDrive/NeuroNet`,
unzip this version over the top, and point the launcher at the new path.
Your `synapsoul_data/` comes along inside it, and NeuroNet renames it to
`neuronet_data/` on first launch.

**Or unzip NeuroNet beside the old folder and leave SynapSoul alone.**
NeuroNet looks for the old library in a sibling `SynapSoul/` folder too,
and takes it on from there. The old folder is left where it is.

Either way: the folder is **renamed, never copied and never deleted**, so
there is no moment where the library exists twice or half of it has moved.
If the rename cannot happen — a different disk, a permission — the old
folder is used exactly where it is, under its old name, and the reason
goes in `neuronet.log`. If a real `neuronet_data/` already exists, the old
one is not touched at all. Your settings (`synapsoul_prefs.json`) come
across the same way, so the theme, text size and hidden subsections are
as you left them.

`library_path.txt` outranks all of this. If you pointed the data at an
external or synced folder, that is used and nothing is moved.

## Updating NeuroNet — read this before you do it

**Unzip the new version over the top of the existing folder.** Let it
overwrite the app files. Your data survives, because update zips never
contain a data folder — `package.sh` refuses to build one that does.

**Never delete the old NeuroNet folder and drop in a new one.** That
deletes `neuronet_data/` with it: photos, music, saved games and all your
training.

If you would rather keep the data somewhere safe from that entirely — an
external drive, a synced folder — put a path in `library_path.txt` beside
`neuronet.py`. NeuroNet will use that folder and will not move it.

## First launch after this version

NeuroNet moves things into place itself, working on your real folders:

- An existing `neuronet_data/` **beside** the app is **moved** inside it.
  On one disk that is a rename, which is atomic — the folder is wholly in
  one place or the other, never split. If the move cannot happen (a
  different disk, no permission), nothing is copied or deleted: the folder
  is used where it is, and the reason goes in `neuronet.log`.
- KinCrux's training is **copied** in from `../KinCrux/kincrux_training/`.
  The original is left untouched. The copy only happens into an empty
  training folder, so a later launch can never overwrite your work with
  KinCrux's older copy.

## Pictures, and why the app stopped lagging

Cam: *"The app has become unresponsive it lags when i move around the app,
especially when loading the album sub section found under the music main
section."*

Every picture in this app — a photo, an album sleeve, a track's small
icon — is base64 text handed across the bridge between the interface and
Python, one call at a time. That is fine for a few and ruinous for
hundreds, and music was asking for hundreds. Measured in a real browser
against 400 tracks and 25 albums:

| | before | after | coming back |
|---|---|---|---|
| Music → Library | 400 calls | 5 | **0** |
| Music → Albums | 25 calls, page blank throughout | 15, page drawn in 93 ms | **0** |
| Home → Dashboard | 6 calls | 0 | 0 |

Three things did it, and they live in one place (`SS.Art` in
`ui/app.js`) rather than once per module:

- **Nothing is fetched twice.** Leaving a section and coming back costs
  nothing, which is most of what "lags when I move around" was.
- **No more than eight calls are ever in the air.** The bridge answers
  one at a time, so flooding it is what made the window itself stop
  responding.
- **A page draws itself before its pictures.** The album shelf used to
  wait for every cover before writing any markup — so it was blank for
  the whole round of calls. Now the cases appear at once and the sleeves
  arrive into them, only for the ones near the window.

The photo library had all of this already; music had none of it. Rather
than a second copy with its own bugs, the machinery moved up and both use
it. `test/test_perf.js` checks all of it by breaking it.

## The top bar's player, from anywhere and from a cold start

Cam: *"the chords mini player in the top bar only works when clicked while
Music main section is open, it doesn't work when i am in any other main
section."*

The cause was not what it looked like, and finding that out took measuring
rather than reading. **The buttons were wired everywhere.** In both renderers —
headless Chromium and real WebKitGTK 2.52 — a click at the button's own
coordinates reached its handler in every section of the app, and with a queue
loaded it skipped tracks from Photos, Games, Divination, Notes, Cells and Home
just as well as from Music.

What stopped was what the handler then did:

```js
function next(auto) { if (!queue.length) return; ... }
function toggle()   { if (!cur()) return; ... }
```

**The queue is empty until something is played from inside the music section.**
So the bar did nothing everywhere — including in Music — until a track was
started there, and did everything everywhere afterwards. From outside, that
reads exactly as "it only works in Music". And every fresh launch reads that
way again, because the queue lives in memory and starts empty.

Pressing play on a music player's bar should play music. So it does now: with
nothing queued, play starts your library, from any section, on a cold start.
Next and previous do the same. With no music at all it **says so** — silence is
the one answer that leaves you wondering whether the button is broken, which is
how this got reported in the first place.

One thing deliberately left alone: a track *ending* never starts the library.
An album finishing has to stop, not quietly begin playing everything you own.

### The queue popover, same shape of fault

Cam, once the buttons worked: *"please fix this mini pop up, it only opens when
in music main section."*

`#cc-queue-pop` was the first child of `#ch-shell`, and the router hides every
element whose id ends in `-shell` the moment you leave its section. **A child of
a hidden element cannot be shown, whatever class you put on it** — so the
popover was told to open, took the class, computed `display: block`, and still
measured 0×0. Measured exactly that: 330×526 in Music, 0×0 everywhere else,
hidden by `ch-shell [hidden]`.

It lives in `#ss-topbar` now, with the bar it belongs to. The styles for that
placement had already been written and had never matched anything — `topbar.css`
carries both `#ss-topbar .cc-queue-pop` and its `.open` rule.

Moving it broke its looks before it fixed anything, which is worth recording:
every one of its inner rules was written as `#ch-shell .ccq-…` and stopped
matching, so it arrived in the bar with its glass panel and none of its
contents — unstyled grey rows in a cramped column. `topbar.css` is **generated**
from the music styles by `make_topbar_css.py`, and that generator's filter
matched `cc-queue` (the box) but not `.ccq-` (everything in it). Fixed in the
generator and regenerated, so a later run cannot undo it. Verified identical in
Music and outside it, down to the padding.

## Template boards were frozen

Cam: *"when working with a mindmap template in boards i cannot move the boxes
around? Is this and intended feature?"*

It was not. Everything on a board is found **by its id**: the drawing carries
`data-id`, a click reads that attribute back, and the move looks the item up by
it. The templates built their shapes without an id, so every shape in a mind
map, a SWOT or a Kanban rendered as `data-id=""` and the lookup that followed
found nothing. Selecting, moving, recolouring and deleting all quietly did
nothing at all. Only a Blank board worked, because you draw its shapes yourself
and drawing assigns an id.

Measured before the fix: seven shapes on a new mind map, every one with an
empty id, and a 120-pixel drag that moved the box exactly zero pixels.

Fixed in both directions, because only one of them would have left Cam's
existing mind map just as stuck:

- a new board gives every shape an id as it is built
- **opening** a board gives an id to anything that has not got one, so boards
  saved before this are repaired the moment you open them. The repair is in
  memory and is written out with your first real edit, so merely opening a
  board never rewrites it.

The old test passed through all of this. It read the source for `k: "rect"` and
concluded templates were "ordinary items, not a special kind" — true, and
useless, because being an ordinary item is not the same as being a usable one.
`test_boards_move.js` asks the question the other way round: it builds every
template **through the app's own function** and drags something. That detail
matters — the first version of the test wrote the id-assigning line out again
itself, and passed happily with the bug put straight back into the app.

## Books: anything in Notes, as one document

*Now called **Notebooks** (Cam: "rename the sub section books to notebooks"). The
view is still `books:list`, so favourites and a saved menu order still find it.
Printouts and exports are on the shared letterhead with the notes mark
(`icons/notes.png`, from Cam's "Notes Icon.jpeg"): NeuroNet left, the
notebook's name centred, the mark right, headings in the letterhead green. Word
draws the letterhead itself (`html_to_docx(html, letterhead=...)`), since a
converted page loses pictures. Guarded by `test_books.js` and `test_books.py`.*

Cam: *"a book feature for the Notes subsection where I can add any type of
note from a subsection to it and then export or print. The feature is already
present in Training."*

**Notes → Books**, built like Training's: a cover, an ordered contents list you
reorder and remove from, and one document at the end. A book can hold a vault
note, a canvas, a PDF, a board, a sheet or a guide — every kind of thing the
section has.

**A book holds references, not copies.** Edit a note and every book containing
it prints the new version, which is what a manual reprinted each term wants.
The price is that renaming or moving something breaks the reference, so that
case is the one most of the testing is about. A broken reference is marked in
the contents list *and* prints as a labelled gap in the document. The
unacceptable outcome is the quiet one: a chapter silently absent, or the wrong
chapter in its place.

**Each kind is rendered by whatever already owns it.** A note goes through the
Vault's own markdown renderer, a sheet through the grid engine, a board through
the same picture the editor draws and the `.pptx` export uses. A second
renderer would mean a printed total that disagrees with the one on screen —
the kind of thing you only find out about from someone else.

A PDF is the one thing that cannot be poured in, so it prints as a labelled
reference rather than vanishing. A canvas prints what its cards say, and says
outright that its arrangement did not survive the trip to paper.

**Print** opens the document to print or save as PDF. **Export** writes `.html`
always, and `.docx` when python-docx is present — asked about rather than
assumed, so a button that could only fail is never shown. The `.docx` is built
from the same HTML the print view uses, so the two cannot drift apart.

The converter is a small HTML-to-Word reader in `neuronet.py`, and it has been
wrong twice, both times silently: `<meta>` and `<link>` send no end tag, so
counting start tags to skip `<head>` made the counter climb and never come
down — the whole book converted to an **empty document**. And collapsing
whitespace threw away the space before an inline tag, so "The **plan**" came
out "Theplan". Neither raised anything. Both are checked now.

## Notes has a handbook, and it cannot go stale

Cam: *"integrate a guides subsection in notes ... Inclusive of a cells
formula cheat sheets like how to do SUMS in the cells feature, all the
markdown text for vault."*

**Notes → Guides**, laid out like Training's guides because that is what was
asked for and because it is already familiar: a search over a list of cards,
each opening a page of prose. Five guides — what the three tools are for, the
complete Vault markdown reference, the Cells formula cheat sheet, getting
around a vault, and Boards.

They ship with the app rather than being records, so there is nothing to set
up, nothing to save, and nothing lost by replacing the folder.

**The part worth knowing about is `test/test_guides.js`.** A handbook that has
quietly drifted out of date is worse than no handbook, because it is believed.
So nothing in that test checks the guides exist or are long enough. It checks
them against the code, in both directions:

- Every worked formula is **read out of the guide** and run through the real
  grid engine. Change the page to claim `=SQRT(81)` is 8 and the test fails.
  (An early draft kept its own copy of the answers, which passed happily while
  the page said something else — so it reads the page.)
- Every function the engine has must appear in the cheat sheet, and every
  function the sheet names must exist. **Add a function to the grid and forget
  the guide, and this goes red.** Same for the error codes and the tool list
  in Boards.
- Every piece of markdown syntax is rendered by the real Vault renderer and
  must produce what the guide says it produces — including the single
  underscore that deliberately does nothing.

It caught a mistake in the guide on its first run: the average of 20, 45 and 5
is shown to ten decimal places, not nine.

## A sheet takes the whole pane

Cam: *"increase the size of the workspace for cells."*

Measured before: a pane of 1014×824 holding a sheet of 922×546 — ninety pixels
of width and two hundred and seventy-eight of height sitting empty beside and
below a spreadsheet, with the grid stopping at column H and row 20.

Two causes. The height cap was `calc(100vh - 210px)`, and `100vh` is the
**window** — a sheet lives in a pane under the top bar, above the location bar,
between two sidebars. The arithmetic was close at one window size and wrong at
every other. Nothing is calculated now: the page is a column, the grid is the
part that stretches, so the sheet is as big as the room it is given whatever
the window and whatever the sidebars are doing.

The second was the sheet itself. A new one started at 8 columns by 20 rows — a
small rectangle in the corner of a large empty page, where reaching column J
meant pressing "+ Column" twice first. A new sheet is **40 columns by 120
rows** now, which covers a maximised window with room to scroll and costs about
12 KB of empty strings.

## The album page, and which renderer you are running

Cam: *"Album page still lags when scrolling. I even tried it without a
cover and it still lags so it isnt the image."*

Right on both counts. This was measured in **real WebKitGTK 2.52 with the
GPU turned off** — the engine and the mode the launcher actually runs, not
a stand-in — scrolling an album of 100 tracks:

| | frame time | late frames |
|---|---|---|
| the library, 600 rows | 16 ms | 0 of 24 |
| the open album, 100 rows | 55 ms | 24 of 24 |
| the same, with no artwork at all | 57 ms | 24 of 24 |

The library, with six times the rows, was smooth. So it was never the
pictures and never the row count — it was **what scrolls**. The album page
scrolled the sleeve, the album information and the track list as one page,
so every frame of a scroll redrew all three, and with no GPU "redraw"
means the CPU doing it by hand sixty times a second.

Now the page holds still and the track list scrolls inside itself: a frame
redraws track rows and nothing else. **55 ms down to 44.** The sleeve also
stays on screen while you look through the tracks, which is what an album
page should do anyway. The now-playing hero came off this page as part of
it — on a page that no longer scrolls it cost about 250 px, five tracks on
screen instead of nine, and the top bar already carries the same controls
everywhere.

That is a real improvement and an honest one: it is not a cure. Which
brings us to the launcher.

### `--gui` now does something

The launcher has said `--gui qt` for a long time. `main()` never read its
own command line, so pywebview picked its own default — GTK, meaning
WebKitGTK. **The renderer was never Qt.** It is honoured now, and if the
one you ask for will not start, NeuroNet says so and names what to
install rather than failing with pywebview's own message about a word you
never typed.

NeuroNet also prints the renderer it is using on startup, so the question
"which engine am I actually on?" never has to be guessed at again.

### `WEBKIT_DISABLE_DMABUF_RENDERER=1` is the expensive part

That variable is the usual cure for a black window on Linux, and it works
by **turning off accelerated rendering**. Everything above — every blurred
shadow, every gradient, every scroll — is then drawn by the CPU. It only
affects WebKit; it does nothing at all under `--gui qt`.

If the window is fine without it, dropping it is very likely the single
biggest thing you can do, and much bigger than anything in this file. The
startup line says when it is set.

Measured here, `--gui qt` with software rendering forced was **no faster**
than WebKit (the library went 16 ms to 44 ms), so Qt is not a magic
answer on its own — the machine this was measured on has no GPU, so the
accelerated case could not be tested. What changed is that trying it is
now possible.

## The workspace follows the sidebars

Cam: *"i want the workspace to be responsive to the sidebars ... At the
moment i have to scroll sideways to see all my table that i inserted in
Vault."*

Collapse either sidebar and every section takes the width back — measured
across all 26 of them, 1014 px to 1328 px in a 1440 px window.

One thing did not, and it was the one Cam was looking at. A table whose
columns you have dragged remembers those widths in pixels, and a fixed
number does not reflow: it sat 2381 px wide whether the pane around it
was 984 px or 1328 px. It is capped at the pane now, and the columns keep
the proportions you dragged — squeeze it and they all give way together,
give it room and they grow back towards the widths you set. A table can
still be wider than the pane, but only down to the point where the
longest word in each column stops fitting; below that it scrolls, because
the alternative is chopping your words in half.

**Launch NeuroNet before you update KinCrux.** The training is copied
*from* the KinCrux folder. Replace KinCrux first and that copy is gone
before NeuroNet has read it. Once your sessions and circuits show here,
`KinCrux/kincrux_training/` can be deleted.

## Tests

    cd test
    for f in *.js; do node "$f"; done     # needs jsdom: npm install jsdom
    for f in *.py; do python3 "$f"; done

The five `test_training_*` files moved here from KinCrux with the module;
`test_notes_module.js` was copied and ported, and `test_notes_vault.py` is
new. `test_perf.js` is the one worth reading: every check in it was proved
by breaking the thing it guards and watching it go red, including the
self-deadlock that cost an afternoon — a fetcher that asked the cache for
its own key waited on itself, silently and forever, and took a bridge slot
with it.
None of them touches real data. Every Python test's first statement points
`NEURONET_PATHS` at a file that can't exist, so `data_dir()` never reads this
computer's `~/.config/neuronet/paths.json` (which names the real data folder,
and is read before anything a test patches). Child processes inherit it.
`test_test_isolation.py` fails if any test doesn't start that way. A NEW
Python test must start with the same two lines (copy them from any test).
Learned the hard way on 2026-10-01, when a full run wrote junk into Cam's
library and emptied the photo index.

## App stats

**Settings → App stats** breaks down what is in NeuroNet and how it is used:
recipes, tracks, photos, sessions, circuits, programs, exercises, notes and the
rest; puzzles completed; time in the app, per section and per day; time music
played; and everything printed, by kind.

Two kinds of number, and the panel says which is which:

* **What is in the app** is counted fresh from the data files every time the
  panel opens, so it is exact and covers everything ever made.
* **How it is used** — time, music and prints — was never recorded before, so
  it counts from the day App stats arrived, and the panel names that day.
  Puzzles completed come from the Puzzles section's own history, so they go
  back further. Time counts while NeuroNet is in use and stops after five
  minutes without a click, key or scroll; music counts whenever it plays.

**Export to Excel** (a summary sheet with the numbers as real numbers, and a
Charts sheet of real Excel charts) and **Export to Word** save to the Desktop.
**Send to Boards** makes a board — headline numbers, charts as Boards' own
graph items, and every figure — which Boards' **Export PowerPoint** turns into
slides.

The usage record is `neuronet_data/usage.json`. Every print button tells the
backend what it is printing, and that is what the print counts are made of.

**Print** (or Ctrl+P on the panel) prints it on the shared letterhead —
NeuroNet's mark top left, like every other printout.

`test/test_app_stats.py` and `test/test_app_stats.js` guard it.

## Multitask

The **Multitask** button at the top right of the bar splits the workspace
into two sides. Drag a main section from the left-hand menu onto a side to
open it there (or click a section and it opens in the highlighted side).
Drag onto a side a section that is already on the other one, and the two
sides swap.

* The side you are working in is the **active** side: pressed anywhere, it
  takes a 1px outline in the theme's accent, and the shared right-hand menu
  and the crumb follow it.
* Each side has no left-hand bar of its own, but a **collapsed strip of its
  own subsections** down its right edge. **F8** hides the active side's
  strip, and only that side's. **F9** hides every other bar, as always.
* The sides are **independent**: changing a subsection or a section on one
  side never redraws the other, so whatever you were doing there stays put.
* Drag the **divider** to resize (double-click to even it up). Each side lays
  itself out for its own width — the dashboard and calendar stack, music's
  album pages go to one column, Training's list and record stop sitting side
  by side on a narrow side, exactly as they would in a narrow window.
* **Two parts of one main section can sit side by side** — an ebook on one
  side and the Vault on the other (Cam: "so i can take notes at the same
  time"), or Cells beside Boards. What can't be in two places is one
  *module*, because it has one shell and one state: Training twice, or
  Divination beside Mindfulness (one module). A link to a screen of the module
  open on the other side goes to that side. Dropping a section onto a side
  when its usual screen is already on the other side opens the part of it you
  used most recently instead, and only a section that is one module all
  through swaps sides. (`mtClash` in app.js.)
* The button again leaves Multitask on the active side; pressing it later
  brings the last layout back beside whatever is open.

`test/test_multitask.js` drives all of it.

## Stuff

A main section of its own for inventories and the database of all our media.

**Media** is what Personal Effects was — the same file
(`neuronet_data/personal_effects.json`), every item already in it, and every
format it had (DVD, Blu-ray, VHS, CD, cassette, books, vinyl, the consoles…)
plus any you add under **Formats**. Each item has a title, a **By** (director,
artist, author), a year and notes. An old link or favourite to Personal
Effects opens here.

**Inventories** are lists of your own — the garage, the camping gear. Make
one on the **Inventories** page and it joins the Stuff menu by name, with its
own categories, and a quantity and a place for each thing. They live in
`neuronet_data/stuff.json`.

Everything is **alphabetical, everywhere**: formats and categories by name,
items by title (ignoring capitals, reading "Rocky 2" before "Rocky 10") — on
screen, in the file, on paper and in every export. The same title twice under
the same format warns before adding; under a different format it is simply a
different thing.

**Print…** and **Export…** ask what to include — tick DVD and CD, say, and
leave the rest — and remember the choice. Printouts use the shared letterhead
(NeuroNet top left, the list's name in the middle, the **collection** mark
top right). Export writes **Excel** (a combined sheet plus a tab per section,
filterable, on the same letterhead) or **Word** (same letterhead, numbered
lists per section), or sends the list to **Cells** as a sheet of its own.

`test/test_stuff.js` and `test/test_stuff.py` guard it (they replace the old
Personal Effects tests).

## Letterheads in Word and Excel

`print_header.py` draws the one letterhead three ways: for printing
(`header_html`), for Word (`docx_letterhead`) and for Excel
(`xlsx_letterhead`) — NeuroNet's mark on the left (`icons/neuronet-mark.png`
for Word and Excel), the title centred, the section's mark and name on the
right, the green rule beneath. Coach Cam's Word exports use it too, with the
new **coach cam** mark (`icons/coachcam-192.png`); the section marks are made
from Cam's artwork — emblem only, deep green on a transparent ground, so they
print cleanly on white.

## Ebooks and Bookmarks

Cam: *"add a new sub section called ebooks. This should be an ebook library and
reader. It should have a bookmarks feature as well and a bookmarks sub section.
Further i want a tool where i can highlight over an ebook if possible."*

**Notes → Ebooks** is the library: every book with its cover, alphabetical (a
leading "The", "A" or "An" ignored), how far through you are, and *Continue
reading* for the last book you had open. **+ Add ebooks** takes EPUB, PDF and
plain text; each file is **copied** into `neuronet_data/ebooks/files/`, so
moving or deleting the original loses nothing. The same file added twice is
turned away. Removing a book removes the library's copy, never your original.

**The reader.** EPUB and text come a chapter at a time as clean HTML
(`ebooks.py` drops the book's own styles and anything that could run), set in
a size and paper (Paper, Sepia, Night, App) you choose and that are
remembered. Contents, ‹ ›, and links inside the book (the contents page,
footnotes) all work. PDFs are drawn by the pdf.js Notes already ships, a page
at a time as they come into view, with pdf.js's text layer on top so their
text can be selected. Your place is saved as you read, and when you leave.

**Bookmarks and highlights.** ★ Bookmark saves the place you're at. Select
text and a small bar offers four colours, a note, or Copy. Or pick up the
**highlighter**: then every selection is highlighted in the current colour
until you put it down. Click a highlight to change its colour, add a note or
remove it. Your place, your bookmarks and your highlights are kept separately,
so reading past a bookmark never moves it. In an EPUB a highlight is kept as
its place in the chapter plus its words. If its place ever shifts, it is found
again by its words, and if it can't be found it is left out rather than
painted over the wrong words. **Notes → Bookmarks** lists every bookmark and
highlight, book by book, with Open to go straight there.

Books converted from Kindle files by Calibre point each contents entry at the
end of the *previous* file. `ebooks.py` spots this, so chapter names line up.

Ebooks can't go in a notebook, on purpose: an ebook is someone else's whole
book, not one of your notes.

`test_ebooks.py` covers the library and the EPUB and text reading (and your two
real EPUBs when they are on the machine). `test_ebooks.js` covers the shelf,
the reader, bookmarks, highlights and the Bookmarks page. The PDF text layer and
highlighting were checked in real Chromium, because jsdom can't run
pdf.js.

## Puzzles' dialogs were drawing off the bottom of the window

Cam: *"When clicking add to book it doesn't work. Nothing pops up."* Every
Puzzles style is scoped to its shell (`#cr-shell #cr-modal-veil`), but the
dialog, confirm and toast elements sat *after* the shell in `index.html`, so
none of those rules applied. Add to book did open its dialog, just unstyled and
below the bottom of the window, and "Added to …" toasts were lost the same
way. They now live inside `#cr-shell`, as Celestial's already did.
`test_scoped_css.py` now fails on any `#shell #id` rule whose element isn't
inside that shell. Four older Chords and Vault rules are named there as known
and not yet looked at.

## Stuff → Shelf (now Media's covers -- see "Media: Shelf and Media as one page")

> **Moved to NeuroStream on 19 November 2026 (vote V31).** NeuroNet no longer has this; it's kept here as history. See ~/Work/NeuroTV (NeuroStream) for how it works now.


Cam: *"a new sub section called Shelf ... select a type of media and it will
be presented on a shelf ... as the cover image for the DVD, VHS or Bluray ...
search ... a page where i can edit and add movie blog, year, reflections and
general notes. Also a star to add to favourites and a play button."*

The Shelf is your **Media list shown by its covers**. It's the same items as
Stuff → Media, not a second list. Pick a format (films come first), **Everything**,
or **★ Favourites**, and search by title, year, who made it, or anything you've
written. The cases are drawn to scale for their format: DVD, Blu-ray (with its
blue band) or VHS. **▶** on a cover means the film is in your Movies folder.

Open one for its page: **Year**, **Movie blog**, **Reflections** and
**Notes**, all saved as you type; **☆/★** for favourites; and **▶ Play**.

**Covers:** click the cover to choose a picture, drop one onto it, paste one
(Ctrl+V), or take a **still from the film**. Covers are small JPEGs in
`neuronet_data/media_covers/`, not inside the Media file.

**Playing.** Films go in **`Movies/` inside the NeuroNet folder** (`movies`,
`Movie` or `Films` work too), loose or in folders of their own. The Shelf matches a
film to its entry by the title and year in the file or folder name, e.g.
`The Ninth Gate (1999) [2160p]…/…mkv` or `Send_Help_2026_1080p….mkv`. If a
name gives nothing away, choose the film on the entry's page. Play opens the film in **mpv**
(full screen, subtitles next to it picked up automatically), or VLC if mpv
isn't there. It deliberately doesn't use a player inside the app: most films
are HEVC, often 10-bit, in .mkv, and NeuroNet's web engine can't decode them.
That's the fault that kept Cam's Cinema shelved for eighteen versions.
`package.sh` never puts the Movies folder in an update.

**Media keeps the Shelf's fields.** Editing a film in Stuff → Media used to
rebuild it from the four fields Media shows, which would have wiped its review,
star and cover. It now keeps everything it doesn't edit. Every Media save takes
those fields from the file as it is now, and every Shelf save re-reads the file
and changes only its one item. So Media and the Shelf side by side in Multitask
can't undo each other.

## Media: Shelf and Media as one page (2026-10-02)

> **Moved to NeuroStream on 19 November 2026 (vote V31).** NeuroNet no longer has this; it's kept here as history. See ~/Work/NeuroTV (NeuroStream) for how it works now.


Cam: *"Lets combine the media and shelf, this will make it so there is only one
add button and menu"*, *"Need to have cover allocation for media items handled
in the add media menu not the shelf. Plus the handling of images should be with
in built photos app"*, *"Shelf needs the covers to be responsive to the types of
media, so a CD needs to be the same shape of that from albums. Albums added to
Albums in music sub main section should ask if we want to add them to shelf,
then they auto add including the songs."*

- **One page.** Stuff → Media opens on its covers (what the Shelf was) with a
  **Covers / List** switch (List is the plain list, for print, export and quick
  edits; the choice is kept in `localStorage` `nn:media:view`, and in memory if
  storage refuses). Both have Media's one **+ Add**, Formats, Print and Export.
  Shelf is gone from the menu; `stuff:shelf` is in `MOVED_VIEWS`. An entry's
  page has **Edit details…** (the same dialog). Opening an entry (Random movie)
  always shows the covers view (`SS.Shelf.hasOpen`).
- **Covers live in Photos.** The Add / Edit dialog has the cover: **Choose from
  Photos…** opens a picker INSIDE the dialog (pickFromLibrary's own dialog would
  replace the half-filled form -- there is one dialog layer), opening on Photos →
  Covers, type to search all of Photos; **New picture…** adds a file to Photos →
  Covers first. On the entry page the cover menu does the same, plus a **still
  from the film** (`media_film_still`, full size, into Photos) and paste / drop
  (into Photos). The item keeps `coverPhoto` (the library photo); the shelf's own
  small copy in `media_covers/` is made from it (`media_cover_from_photo`).
  `SS.shared.addToPhotos({path|dataUrl, folder, tag})` is the one way in (Capture
  uses it too). Covers from before move into Photos → Covers once
  (`adoptOldCovers`, by `coverPhoto` missing).
- **Cases by format** (`shelf.css`): CD, PS1 and vinyl square like an album
  sleeve (a CD with a jewel-case hinge), DVD 135x190, Blu-ray / PS3-5 / Xbox One
  135x171, VHS, Switch / PSP narrow, books 2:3, cassette J-card, SNES / N64
  landscape boxes, DS / Game Boy small.
- **Music's albums are CDs.** Once, as Media is first read (`effects_load` ->
  `media_shelf.albums_onto_shelf`, flag `albumsOnShelf`, file backed up to
  `personal_effects.json.before-albums-onto-shelf`): every album becomes a CD
  with its name, artist (the songs' when blank), year and cover; a CD already
  there by that title is linked instead (`albumId`), keeping what was written.
  `effects_save` keeps top-level keys the page doesn't send, so the flag
  survives and an album taken off the shelf stays off. A NEW album in Music
  asks "Put it on the shelf too?" (`offerShelf` -> `SS.Stuff.media.addAlbum`).
  A CD's songs are read live from its album (`SS.Music.albumSongs`), listed on
  its page, and play from any of them (`SS.Music.playAlbumAt`; the index counts
  only playable songs). Album covers are NOT copied into Photos (227 sleeves
  would bury the photos).

`test/test_shelf.js`, `test/test_stuff.js`, `test/test_media_albums.py`.

## Random movie (dashboard)

Cam: *"a new widget called Random Movie, this will bring up a random movie
from the shelf presented upside down so you dont know what it is, but when
clicked it flips over an presents the movie cover. When movie cover is clicked
it opens the shelf entry for the movie."*

A DVD, Blu-ray or VHS off the Shelf, dealt face down. Press it and it turns
over to show the cover and title. Press the cover to open its Shelf entry.
**Another** deals a different film, face down again.

`test_shelf.py` (finding films, matching titles and years on real download
names, playing, covers) and `test_shelf.js` (the Shelf, an entry, Media keeping
Shelf fields, the widget, and puzzle printouts) guard all of this.

## Puzzle printouts on the letterhead

Cam: *"fix the print feature for puzzle books/sheets to have this icon and fit
the same design as the rest."* Puzzle books and printed word searches now use
the shared letterhead: NeuroNet on the left, the book or puzzle name in the
middle, and the puzzles mark (`icons/puzzles.png`, from Cam's "Puzzles
Icon.jpeg") on the right. The book's cover lists its puzzles, headings are in
the letterhead green, and each heading has the two-tone rule. The old Cranium
brain and pink are gone. The puzzles and answer keys are unchanged.

## Settings → Export & import

Cam: *"a setting to export and import data. It will export all the data except
for music, movies, videos or anything large, It will export the photos and
ebooks. This will make it easier to move to another system."*

**Export** writes one `.zip`, saved wherever you choose. Before anything is
written, the page lists every place your data lives and how big each is. That
matters because it isn't all in `neuronet_data/`. The calendar, contacts and
family photos (`camily_data/`), the recipes (`cookery_data/`) and Money
(`kincrux_money/`) live wherever the Kitchen found them, and on this machine
that's beside NeuroNet, not in it. Settings (`neuronet_prefs.json`) go too —
since 29 Sep 2026 they live inside `neuronet_data/`, so they go with it.
Photos and ebooks are included. Left out, by kind rather than by size, so a
big photo is never dropped: audio and video anywhere (music, meditation
recordings, films), caches the app rebuilds, and Training's rolling
`.backup-*` copies. The page says what was left out and where the music is,
so you can copy it across yourself.

**Import** reads an export, shows where each part will go on this computer (its
own locations, not the old one's), and asks first. It adds and replaces but
never deletes, so the new computer's music is untouched. Any file it replaces
is copied first into `neuronet_data/import-backups/<date>/`, and files that are
already identical are skipped. A name in the zip that would land outside its
place is refused. NeuroNet reloads when it's done.

`data_transfer.py` does the work; `_transfer_areas()` in neuronet.py lists the
places. Guarded by `test_transfer.py` and `test_transfer.js`. On 2026-09-26 a
real export was 271 files, 485 MB, leaving out 10.2 GB of music and
recordings, and it imported into a fresh layout byte for byte.

## Everything inside NeuroNet

Cam: *"migrate all the data so it lives within the NeuroNet directory, my goal
is to fully replace camily and all other apps with this one, so it needs to be
standalone."*

Three parts of the data came from other apps and used to be *searched for*:
beside the app, one level up, in a sibling Camily folder, and in the home
folder. On Cam's machine that meant `Camily/camily_data` (calendar, contacts,
family and recipe photos), `Camily/cookery_data` (recipes) and
`NeuroNet/kincrux_money` (Money). They now have fixed homes inside the data
folder:

    neuronet_data/family/    camily.json, photos/
    neuronet_data/kitchen/   cookery.json
    neuronet_data/money/     cashbox.json

`kitchen_backend.ROOT_PROVIDER` is set by neuronet.py, so the Kitchen, Home and
Money never look anywhere else. (Without it, as in the older apps that share
the file, the search is unchanged.)

**The move happens once, when NeuroNet starts** (`adopt_at_startup()` in
`main()`, before the window opens, never on merely importing neuronet.py).
Each old folder is **copied** in, checked file by file (names and sizes), and
only then put in place. Camily's folders are left exactly as they were. The
old `kincrux_money/` was NeuroNet's own and would ship in update zips, so it is
moved into `neuronet_data/adopted-originals/`. What was done is written to
`neuronet_data/adopted.json` and the log. A part already home is never copied
over again, so changes made in NeuroNet are never replaced by the old app's
copy. If a copy fails, that part is used where it is for that session (never an
empty calendar), and the next launch tries again. It only runs for the real
library inside the app folder.

After this, the old Camily app and NeuroNet no longer share data. Changes made
in Camily won't appear in NeuroNet.

Moving to another computer is now one folder, `neuronet_data/` — the
settings (`neuronet_prefs.json`) live inside it since 29 Sep 2026, moved there
from the app folder on the first launch after (Settings → Export & import
carries it). `package.sh`
excludes the old folder names too. Guarded by `test_standalone.py`.

## Music tagging brought in from Cam's Collective (2026-09-26)

> **Moved to NeuroStream on 19 November 2026 (vote V31).** NeuroNet no longer has this; it's kept here as history. See ~/Work/NeuroTV (NeuroStream) for how it works now.


Cam: *"take the data from Cams Collective Chords for the music main section in
Neuronet as Chords has all the artist and albums already assigned."* A one-off
merge of `cams_collective_v283/chords.json` into
`neuronet_data/chords/chords.json`, run while NeuroNet was closed. All 406
music files now have an artist and album, in 27 albums, and the 32 missing
album covers were copied from v283's `images/`. NeuroNet's own corrections
won wherever it had them: "Ed Sheeran", "The Collection", restored apostrophes,
"(Explicit)". The exception was "Easy Steps", which NeuroNet had shortened by
reading the 8 as a track number; it is back to "8 Easy Steps". Albums were
matched by their songs, so none was made twice. Play counts took the larger
of the two, and the Upbeat playlist was kept. The file as it was is
`chords.json.before-v283-merge`, and the script that did it is
`neuronet_data/chords/merge_from_v283.py`.

## Divination brought in from Cam's Collective (2026-09-28)

A one-off import of `cams_collective_v283/cards.json`, run while NeuroNet was
closed: 12 decks (7 Tarot, 4 Oracle, 1 Lenormand) and 5 readings, into
`neuronet_data/cards/celestial.json`. v283's `meaning` / `reversedMeaning` /
`synopsis` became Upright / Reversed / Card Synopsis. (v283 kept rich text as
lists of `[text, [styles]]` runs; the first import copied those lists, and 522
fields in six decks drew as runs joined by commas. They were flattened to
plain text the same day -- `celestial.json.before-richtext-fix-20260928` is
the file before -- and Divination now flattens any that come back.) All 724
divination
images went into Photos, in folders **Divination → Tarot / Oracle / Lenormand
→ each deck**, tagged. The cards use copies in `cards/images`, the same as
cards set by hand. v283 is untouched. The files as they were are
`*.before-v283-divination-*`, and the script is
`neuronet_data/adopted-originals/import_v283_divination.py`.

## Exporting a guidebook as a PDF

Cam: *"add the ability to print full guidebooks and select pages of guide
books"*, then: *"Printing guidebook from a tarot deck gets stuck on
preparing, change to export to PDF then i can just print that PDF."*

**Export PDF…** in a deck's guidebook, or **Export the Guidebook** on the
deck's popup, asks what to include: the whole guidebook, the card on screen,
or chosen cards (tick them one at a time, or a suit at once). Then it asks
where to save the PDF, makes it, and opens it in your PDF viewer to print.

A page is a card. The picture sits top left with Upright, Reversed and
Synopsis wrapping round it and then using the full width, so a long synopsis
fills the page instead of running onto the next. Empty sections are left
out. With more than one card there's a cover (the deck's cover art) and a
contents page in three columns. Every page has the shared letterhead with
the divination mark on the right (`icons/divination.png`, made from Cam's
artwork the same way as the other marks). The pages are A4.

Why it used to stick: the page was built in the web page, which fetched every
card's picture over the pywebview bridge and then sent the whole ~16 MB
document back. Now `guidebook_pdf.py` builds it in Python from the files on
disk, and only the deck and the chosen cards cross the bridge. Chromium
renders it (about a second and a half for 78 cards); without Chromium, the Qt
web engine NeuroNet runs on does it in a separate process. Card art comes
from 1000 px copies kept in `cards/print/`, since the thumbnails print soft.
Exports of your data skip that folder because it is rebuilt from the
pictures.

`test/test_guidebook_pdf.py` guards it.

## The Vault's import buttons

**Import**, **Import folder** and **Import PDF** at the foot of Notes → Vault
did nothing. Notes has its own backend, and its file dialogs open on a window
that `main()` never gave it, so each one failed on `None`, and the page never
showed the error. `main()` now hands it the window, and a picker that fails
shows a message instead of going quiet. Inserting a photo into a note had the
same fault and is fixed too.

`test/test_notes_import_buttons.py` guards it.

## Mindfulness → Journal

Cam: *"the journal will act as a place i can write anything, that note
section will be more personal and i should also have the ability to add
photos to jounral entries."* It began under Notes, then: *"fully migrate the
journal to live in mindfullness, change the name from thought journal to
just be journal."* So it replaced Thought Journal and took its view
(`mind:journal`). A favourite, saved menu order or last view of Thought
Journal, Notes → Journal or Divination → Readings all open it. Anything
written in Thought Journal is brought in once (`journal.migrate_thoughts`);
on 2026-09-28 it was empty.

Entries are listed newest first, with a search that also finds a reading by
its deck, spread or cards. An entry has a date, an optional title, its words,
and photos, added **from Photos** or **from the computer**. Ctrl+Enter
saves. Leaving an entry that has changed asks first.

**Readings live here now.** Divination → Readings is gone. **Save to Journal** at the end of a
pull saves the spread with your reflection. The cards are drawn at the top
of the entry, reversed ones upside down, with what each means the way it
fell under "What the cards say". The 5 readings Divination had are brought
in the first time the Journal opens. They stay in `celestial.json`, unused,
as the record of what moved.

The store is its own (`journal.py`): `neuronet_data/journal/journal.json`
plus `journal/images/`. It isn't vault notes, because an entry carries photos
and upside-down cards, which markdown can't draw. Every picture in an entry
is the journal's own smaller copy: a reading keeps its cards after the deck
is deleted, and a photo survives being tidied out of Photos. Pictures no
entry uses are swept away, but not until a day old, so one added to an entry
still being written is safe. A journal entry can also go in a **Notebook**
(it prints with its cards and photos). App stats counts journal entries and
readings.

`test/test_journal_backend.py` and `test/test_journal.js` guard it.

## Random pull (dashboard)

Cam: *"a random pull widget for the dashboard, where i select the type of
deck and it pulls a random card. Have the card presented like the random
dvd, where it is upside down then i click to flip (it can be either upright
or reversed. From here i can add a quick journal entry."*

Add it from **Edit layout → + Add a block**. The tabs pick Tarot, Oracle or
Lenormand, and the widget remembers the choice. It deals one card from a
random deck of that kind, face down (the deck's own card back if it has one).
Pressing it turns it over. It's upright or reversed at an even chance, and a
reversed card lands upside down. It shows what the card means that way up,
and a box for a quick journal entry. **Save to Journal** puts the card and
your words in Mindfulness → Journal. **Another** shuffles again, and asks first if
you've started writing.

`test/test_journal.js` guards it.

## New albums fill themselves in

Cam: *"when creating an album in the music album section, have the cover and
track auto fill if the songs are already assigned an album and a cover."*

Name a new album with a name your songs already carry (it's suggested as you
type) and the dialog says how many songs it found. **Create** adds them in
track-number order, with the cover most of them share and their artist when
they all have the same one.

`test/test_journal.js` guards it.

## Press and sweep to select (Music and Photos)

Cam: *"a click and drag feature when in the select tool so i dont have to
click every one individually, please also have this feature in photos when
in select mode."*

In select mode, press on a track or photo and move across others.
Everything from the one you pressed to the one under the pointer takes the
state the first one took. A sweep that starts by selecting selects, and one
that starts on a selected track clears. Near the edge of the list it
scrolls. It is one helper, `sweepSelect` in `ui/app.js`, used by both.

In **Photos**, a sweep starts from an **unselected** photo. Pressing a photo
that's **already selected** still carries the selection, so you can drag
the ticked photos onto an album in the menu as before. Clicking one un-ticks
it.

`test/test_journal.js` guards it.


## Music in the Omarchy top bar

> **Moved to NeuroStream on 19 November 2026 (vote V31).** NeuroNet no longer has this; it's kept here as history. See ~/Work/NeuroTV (NeuroStream) for how it works now.


Cam: *"is it possible to make companion style omarchy plugins, like a top
bar music player for NeuroNet? That uses the music library file from
neuronet?"* ... *"yes build option 1 with a bar widget"*

**NeuroNet tells Linux what it's playing.** While it's open, NeuroNet shows
up as a music player (MPRIS) called NeuroNet. So Omarchy's audio panel and
track popups show its songs, and the keyboard's media keys control it.
`mpris.py` does this, started by `main()`. It never plays anything itself.
Every button goes back through `SS.Music.remote` to the app's one player,
so the queue, play counts, shuffle and repeat stay the same wherever you
press them.

**The bar widget** is the plugin `neuronet.music`. It's installed in
`~/.config/omarchy/plugins/neuronet.music/`, and a copy is kept here in
`omarchy-plugin/`. It sits on the right of the bar, next to the tray.

- The bar shows a note, and the song and artist while something plays. The
  note is dimmed when NeuroNet is closed.
- **Click** opens a card with the cover, song, progress (click it to jump),
  shuffle, previous, play/pause, next and repeat. Below that are your
  **Albums** and **Playlists** with their covers, read straight from
  `neuronet_data/chords/chords.json`. The card updates when that file changes.
- **Pick an album or playlist** and NeuroNet plays it. If NeuroNet is
  closed, the widget opens it and plays your pick once it's up.
- **Middle-click** plays or pauses. **Scroll** skips tracks.

If NeuroNet's data ever moves, set the library path with
`omarchy bar set neuronet.music library /path/to/chords.json`. After editing
the plugin here, copy it back into `~/.config/omarchy/plugins/`. The shell
reloads it by itself.

`test/test_mpris.py` (the bus side, on a private bus) and
`test/test_mpris.js` (the page side) guard it.

## Albums by artist

Cam: *"make the album sub section in the music main section more usable
with an artist selector, this can be by a drop down and then it only
displays the albums from the selected artists (should be able to select
multiple)."*

Music → Albums has an **All artists ▾** button beside **+ New Album**. It
lists every artist with a tick box and how many albums they have, plus a
search at the top. Tick one or more and the shelf shows only their albums,
with a line saying how many are showing. **Clear** shows everything again.
The choice stays while NeuroNet is open, including after opening an album
and coming back.

An album's artist is the one it was given. The albums made before that
field was filled in take the artist on most of their songs. Spellings of
one artist ("blink-182" / "blink‐182") count as one.

Holding a sleeve to reorder still works with the filter on. It moves albums
by which album they are, not by their place on the filtered shelf.

`test/test_album_artists.js` guards it.

## Shuffle several albums together

Cam: *"select multiple albums and click play, this will add all albums
tracks selected to a playlist and shuffle all the tracks."*

On Music → Albums press **Select**. A click on a sleeve then picks it
instead of opening it, and press-and-sweep picks a run of them, as in the
Library. The bar at the top counts the albums and songs picked and offers:

- **Shuffle play**: every song on the picked albums, shuffled, straight into
  the queue (Up next). A song on two of them, such as a best-of and its
  album, goes in once. Missing files are left out.
- **Save as playlist**: the same shuffled mix, kept under a name. The name
  is suggested from the albums, and it can play straight away.
- **Select all shown** (works with the artist filter), **Clear** and **Done**.

While picking, holding a sleeve doesn't reorder the shelf.

`test/test_album_shuffle.js` guards it.

## Fleeting note and Photo frame, outside NeuroNet

Cam: *"create another top bar widget that will allow me to type a fleeting
note, also would it be possible to create a desktop widget where i can use
my photo frame feature?"*

Two more Omarchy plugins, installed in `~/.config/omarchy/plugins/`, with
copies kept in `omarchy-plugin/`. Neither needs NeuroNet to be open.

**Fleeting note** (`neuronet.fleeting`, a top-bar icon left of the music
widget). Click it, type, then **Ctrl+Enter** or **Save**. The note becomes the
next `Fleeting note N.md` in the vault's Fleeting folder, the same file
`fleeting_add` would write, so Notes → Fleeting shows it. Esc closes it and
keeps what you typed. The tooltip says how many notes are waiting.

**Photo frame** (`neuronet.frame`, on the desktop behind windows, bottom
right). It's a slideshow read straight from `neuronet.json`. It uses the
frame-sized copies in `photos_frame/` where they exist and the originals
otherwise. **Left-click** shows the next photo. **Right-click** opens the
settings:

- which photos: My photos (everything except the Divination cards, the
  default), everything, an album, a folder or a tag
- how often it changes, from 5 s to 5 min
- the size and corner
- fill the frame or show the whole photo
- the caption

The settings are kept in `~/.config/omarchy/neuronet-frame.json`. The frame
never writes to NeuroNet's data.

## Daily cards in the top bar (Tarot; Oracle & Lenormand)

Cam: *"build a top bar tarot tool like the Ominity that is already
installed. When you build and ship the one you build to my system please
remove the Ominity plugin."* Then (2026-09-29): *"for the card pull, please
seperate into 2 tools. Keep the current one for tarot but also make one for
both oracle and lenormand as well. This way i can pull one of each cards
each day, then present them side by side on the desktop."*

Two bar tools, side by side on the bar (copies in `omarchy-plugin/`):

- `neuronet.tarot` (**✦**) pulls from the tarot decks.
- `neuronet.oracle` (**☾**) pulls from the oracle and Lenormand decks. Its
  **Oracle / Lenormand** buttons switch between the two. A ✓ marks the ones
  already pulled today.

**They are one file.** `Service.qml`, `BarWidget.qml` and `journal_add.py`
are identical in both folders. Each copy works out which tool it is from its
own folder name (the `tools` table at the top of Service.qml).
`test/test_daily_cards.py` checks the copies are identical, so edit one and
copy it to the other.

- **Click the glyph** and today's card lies face-down. Click it or press
  **Space** to turn it over. Cards are reversed half the time, as in NeuroNet.
- **One card a day of each kind**: a tarot, an oracle and a Lenormand card.
  Each is kept until **Draw again**. A glyph is dimmed until all of its
  kinds are pulled, and its tooltip names today's cards.
- **Draw from**: any deck or one deck, chosen separately for each kind.
- **Save to Journal** puts the pull, the card picture and an optional note
  into Mindfulness → Journal as "Daily card · <deck>". It goes through
  NeuroNet's own `journal.py` (`journal_add.py`), so it's safe with NeuroNet
  open or closed.
- **Past pulls** shows the last dozen of that tool's kinds. Click one to see
  it again.
- **Right-click the glyph** or **Show on desktop** puts today's cards on the
  desktop, bottom left, in a row: the tarot card first, then oracle, then
  Lenormand. The oracle tool reads the tarot tool's state file to know
  whether to leave room for the tarot card. Clicking a desktop card opens
  its reading.
- For a shortcut:
  `qs ipc -p /usr/share/omarchy/shell call neuronet.tarot toggle` (or
  `neuronet.oracle`).

The plugins only read the decks. Their own state is in
`~/.local/state/neuronet-tarot/state.json` and `neuronet-oracle/state.json`.
The old one-card-a-day file keeps its tarot card and history, and its
non-tarot pulls drop out of the tarot tool. Ominity was removed on
2026-09-28, and its draws are still in `~/.local/state/ominity/`.

## Desktop widgets — removed (3 November 2026)

Cam: "Lets remove the widget functionality completely." The desktop widgets --
the board (clock, Today, music, recipes, bookshelf, drop zone, sticky notes,
training viewer and builder, puzzles...), the photo frame, the NeuroNet logo on
workspace 1, today's cards on the desktop and Edit desktop (Super+Alt+L) -- and
their own Quickshell (`neuronet-desktop.service`, ~480 MB) are gone, with
`neuronet-shell` (Super+Alt+W), `neuronet-desk-edit`, `desktop_widgets.py` and
`bookshelf.py`. The bar widgets (launcher, music, fleeting note, game mode,
tarot / oracle / Lenormand, the dock) stay. `install.sh` switches an old
computer's desktop service off and takes it out; the three plugins are
`retired` in `shell.neuronet.json`. Settings → Desktop widgets is now
Settings → Screensaver. Older sections below that mention the desktop
widgets are history.

## Music keys

> **Moved to NeuroStream on 19 November 2026 (vote V31).** NeuroNet no longer has this; it's kept here as history. See ~/Work/NeuroTV (NeuroStream) for how it works now.


Cam: *"a shortcut to pause and play the music without having to click mini
player in top bar and pause (maybe a next and previous shortcut as well)"*.

| Keys | |
|---|---|
| **Super+Alt+\\** | play / pause |
| **Super+Alt+]** | next track |
| **Super+Alt+[** | previous track |

`neuronet-music play-pause|next|previous` always talks to NeuroNet's player
(`org.mpris.MediaPlayer2.neuronet`, `mpris.py`), not "whatever is playing",
as Omarchy's media keys do, so a video in the browser can't take the key. If
NeuroNet isn't running it starts it, hidden, first.

## Colours follow Omarchy

Cam: *"Colours follow omarchy is a wicked idea for greater integration with
the system."*

Settings → Appearance → **Follow Omarchy** (first in the list). It's on
since 2026-09-29. NeuroNet takes its colours from the Omarchy theme in use
(`~/.local/state/omarchy/current/theme/colors.toml`), worked out by
`omarchy_theme.py`:

- Surfaces are the theme's background stepped towards its foreground, so
  light and dark themes both work.
- Text is the foreground stepped back. Muted text stays readable (4.5:1).
- The accent is the theme's. Text on it is whichever of the theme's
  background and foreground reads better. A pale accent on a light theme is
  deepened until it can be seen.
- Good / danger / star come from the theme's green / red / yellow, but only
  when those really are green, red and yellow. Harbor Dark's "green" slot is
  red. Newer themes name their colours and older ones number them; both are
  read.

When the Omarchy theme changes, `~/.config/omarchy/hooks/theme-set.d/neuronet-theme`
(copy in `integration/omarchy-hooks/`) asks a **running** NeuroNet to look
again (`Do theme.omarchy`). It never starts NeuroNet. A closed NeuroNet reads
the colours when it starts, and the last ones seen are kept in localStorage
so the first paint is already right. The logo stays NeuroNet green: that's
the brand colour, set on the logo itself. Tests: `test_omarchy_theme.py`
(every Omarchy theme installed, for readable text) and
`test_omarchy_integration.js` (the repaint).

## Capture into Photos

Cam: *"the capture staight into photos genius idea"*.

**Super+Alt+X**: drag a box on the screen. The picture goes straight into
Photos, in a **Captures** folder, tagged Capture, captioned with the date and
time. `neuronet-capture windows` takes a window, `fullscreen` the whole screen
(both are in the Omarchy menu too). `neuronet-capture` uses Omarchy's own
region picker, saving into a private folder under `$XDG_RUNTIME_DIR`, not
~/Pictures, so there's no second copy. It hands the picture to NeuroNet
(`neuronet-call photo.add`), which stores and saves it like any photo it
adds, so the library in memory and on disk agree. NeuroNet is started,
hidden, if it isn't running. A notification shows the picture; clicking it
opens Photos.

## NeuroNet in the Omarchy menu

Cam picked idea A: *"Omarchy menu search for NeuroNet"*.

**Super+Alt+A** opens the Omarchy menu on NeuroNet. Type a few letters, then
Enter. The rows are:

- every NeuroNet tool, and the whole app;
- **Play an album** (every album, with its artist, so typing an artist works);
- **Play a playlist**;
- **Open a note** (every note in the vault, except the Fleeting queue);
- **Open a recipe** (every recipe, searchable by tag);
- Capture to Photos, and today's tarot and oracle cards.

Omarchy's menu can't run a program to fill a list, so `neuronet-menu`
writes the rows into `~/.config/omarchy/extensions/omarchy-menu.jsonc`,
between two marker lines, leaving everything else in the file alone. The menu
reloads the file by itself. The systemd user unit `neuronet-menu.path`
(copies in `integration/systemd/`) reruns it whenever the music library, the
recipes or the notes vault change. The last row, **Refresh this list**,
reruns it by hand. Notes and recipes open through `neuronet-open`: the popup
shows the tool, then NeuroNet opens the item (`open.note` / `open.recipe` in
`SS.boardDo`; `CC.Shell.openNote`, `CP.Cookery.openRecipe`).

## The class timer on the bar — removed

**Removed 29 Sep 2026** (Cam: *"remove the class timer in neuronet i dont use
it"*): the `neuronet.training` widget, its Super+Alt+E and the Today card's
Timer button. The Training section inside NeuroNet is untouched. A computer
that still has the widget has it switched off and set aside by
`system/install.sh` (and the migration tool) — the notes below are its history.

Cam picked idea B: *"Training on the bar -- today's session and a timer"*.

`neuronet.training` (**󰔛** on the bar, right of ☾; **Super+Alt+E**; copy in
`omarchy-plugin/`). Click it for:

- **Today**: today's classes from the Training calendar;
- **Circuit or session**: search all of them. The chosen one's stations are
  listed and ride along while the clock runs ("Now: Goblet Squats · Next:
  ...");
- **Format**: EMOM, AMRAP, Tabata, Intervals, For time, Rest, each with its
  own numbers (remembered), plus a lead-in ("Get ready", 10 s). Picking a
  circuit guesses the format from its name or type: "EMOM 2" → EMOM, "RFT 3"
  → For time, type AMRAP → AMRAP. A circuit whose stations carry their own
  work/rest times gets **Its own times**, run exactly as NeuroNet's Training
  timer runs them (`buildSchedule`). None of Cam's circuits have times yet.

While it runs, the bar shows the countdown, coloured by phase: accent for
work, green for rest, yellow for getting ready. **Right-click** pauses and
resumes. The popup has Pause, Skip, **+1 round** (AMRAP / For time), Stop,
and **Big clock**: a large clock at the top of the screen, for across a gym
floor. The beeps are NeuroNet's own: a tick for each of the last three
seconds, three long beeps at a changeover (high into work, low into rest),
and a long note at the end (`sounds/`, made by `make_sounds.py`, played with
`pw-play`). A notification gives the time and rounds at the end.

It only reads the training library. Its settings are in
`~/.local/state/neuronet-training/state.json`. IPC target `neuronet.training`
(toggle / open / close / start / pause / stop / big).
`test/test_home_screen.py` checks the steps each format builds.

## Quick access: NeuroNet as a popup

Cam: *"a plugin that can load my tools in Neuronet and make them appear as a
popup that i can do some quick work or viewing, rather then having to open
the whole app all the time. For some context my computer usage is all
centred around Neuronet."* He mostly uses Notes, Training, Photos and Music.

NeuroNet itself is the popup. Nothing is rebuilt or loaded twice.

| Key | Opens |
|---|---|
| Super+Alt+N | Notes |
| Super+Alt+T | Training |
| Super+Alt+P | Photos |
| Super+Alt+M | Music |
| Super+Alt+C | Cashbox (the Money section) |
| Super+Alt+H / Z / Q / D / I / R | Home, Mindfulness, Puzzles, Divination, Stuff, Kitchen |
| Super+Alt+O | the whole NeuroNet, in a normal window; press again to hide it |

A tool's key tucks NeuroNet into a Hyprland scratchpad (`special:neuronet`)
and floats it over whatever is on screen, at about three quarters of the
screen. It opens on the page last used in that tool, in a compact look with
no left menu (the top bar and the right-hand menu stay). The same key again
puts it away. A different tool's key switches tools. NeuroNet opens first if
it isn't running. The ⤢ button beside Multitask, or Super+Alt+O, returns it
to a normal window with everything showing.

The same list is on the bar: `neuronet.launcher` (the brain icon beside the
Omarchy menu; copy in `omarchy-plugin/`). Middle-click shows or hides the
popup.

How it fits together:

- `neuronet-quick` (beside `neuronet.py`) moves the window with `hyprctl`
  and tells the page what to show.
- `org.neuronet.App` (in `mpris.py`, on the same D-Bus connection as the
  music) has `Quick(section, compact)`, `Compact(on)` and `Raise`. It calls
  `SS.quickMode` in `app.js`.
- **There is only ever one NeuroNet.** Opening it while it's running hands
  over to the running one (`already_running()` in `main()`) instead of
  starting a second copy on the same data. `NEURONET_ALLOW_SECOND=1`
  overrides this, for tests only.
- The window's Wayland app id is now `NeuroNet` (it was `python3`).
- The keys are in `~/.config/hypr/bindings.lua`.

`test/test_quick_access.js` (the page), `test/test_quick_script.py` (the
script and the one-NeuroNet guard) and `test/test_mpris.py` (the D-Bus side)
guard it.

### Another app over the popup (2026-10-02)

Cam: *"If i click print the page attatchs to the tool so when i close the tool
it closes the document as well. I need any app opened while the tool is up to
remain seperate from the tool."* While the scratchpad has focus, Hyprland opens
every new window ON it, so Print's browser window (or a browser, or mpv) hid
with the tool. `quick_watch.py`, started from `main()`, reads Hyprland's event
socket and on an `openwindow` on special:neuronet that isn't NeuroNet runs
`neuronet-quick dock <address>`: the popup is put away and the tool and the new
app are tiled side by side on the workspace in front, the tool still compact.
A **floating** window (a file picker, a dialog) is left with the tool. Docked,
the tool's key tucks it back into the scratchpad, another tool's key switches
it in place, and Super+Alt+O makes it the whole app. `test/test_quick_watch.py`
(stand-in hyprctl; no real window moves).

### Starting hidden, at login (2026-09-28)

Cam: *"when i press Super+Alt+o again i want the window to rehide please.
Also can you make neuronet start automatically in the background when i
power on my system, this way the shortcuts will work straight away."* Also
*"the same popup style for cashbox"*. Cashbox lives in NeuroNet as Money
(`neuronet_data/money/cashbox.json`). The standalone Cashbox app's data
folder is empty.

- **Every NeuroNet window starts hidden**, floating in `special:neuronet`
  (a window rule in `~/.config/hypr/hyprland.lua`). `neuronet-quick` decides
  where it shows, so nothing flashes up when it starts.
- **At login**, `~/.config/hypr/autostart.lua` runs `neuronet-quick start`,
  so NeuroNet is running and hidden and the keys work at once.
- **The app icon** (`NeuroNet.desktop`, including the installed copy in
  `~/.local/share/applications`) runs `neuronet-quick show`: the whole app,
  here, starting it if needed. `neuronet-quick` itself starts `neuronet.py`
  directly, never through the desktop entry, which would call back into it.
  A lock stops two quick presses from starting two copies.
- `full` (Super+Alt+O) toggles: the whole app comes here, and pressing again
  while it's here hides it. `show` (the app icon, the ⤢ button, the bar menu,
  a second launch of `neuronet.py`) only ever brings it forward.

## Moving NeuroNet between computers

`/mnt/Cams_Collective/NuNt_migration_desktopintegration`: build a bundle
with `bash rebuild.sh --features` on the computer you worked on. Then, on
the other computer, run its own script: `migration_widgets_main` (this
desktop), `_fluffs` (the laptop), `_manthsmain`, `_manthslap` (not set up
yet), or `migration_widgets` for any computer (it asks for the folder). The
computers are listed in its `machines.conf`; its README has the rest.

## Desktop integration: the convention (so it migrates)

Everything NeuroNet adds to the desktop is carried to another computer by
`/mnt/Cams_Collective/NuNt_migration_desktopintegration` (its README has the
walkthrough). That only works if new integration follows five rules:

1. Omarchy widgets are named `neuronet.<something>`.
2. Hyprland additions are **one-line** statements that mention NeuroNet (its
   path, or a description starting "NeuroNet").
3. Settings kept outside this folder have `neuronet` in their name
   (`~/.config/omarchy/neuronet-...`, `~/.local/state/neuronet-...`).
4. Software a feature needs is added to `integration/deps.txt`.
5. Code in this folder finds its own location instead of writing
   `/mnt/Cams_Collective/...`.

## Random album (dashboard)

Cam: *"a random album player much like the random dvd"*.

A dashboard block (Edit layout → add **Random album**). It works like
Random movie. An album from Music is dealt face down: a square card with a
disc on its back. The first press turns it over to show the cover, the name,
the artist and how many tracks. Pressing the cover plays the album, through
the same `SS.Music.play` the music widget and the album shelf use.
**Another** deals a different album, face down. Empty albums are never dealt,
and the same album never comes twice in a row. It reuses the Random movie
card (`home.js`, `home.css`), made square.

`test/test_random_album.js` guards it.

## Sound starts from outside the window

Cam: *"now it even shows up in the player on the wallpaper but produces no
sound"*. The qt renderer is Chromium, and Chromium only lets audio start
after a click **inside** the page. A play asked for from outside (the
desktop board, the bar's music widget, the media keys) loaded the album and
was then refused at `audio.play()`: the track showed, Paused, and was
silent. `allow_qt_autoplay()` in `neuronet.py` turns that rule off for
NeuroNet's pages, the same way `fix_qt_permissions()` fixes permissions: by
wrapping pywebview's page class from here. `test/test_qt_autoplay.py` checks
it against the real engine: refused without the fix, played with it.

## Code → IDE (Algorithm, built in)

Cam: *"intergrate Algorithm found in /mnt/Cams_Collective into NeuroNet under
Code main section and be in IDE sub section, there will be more sub sections
later included guides, ebooks etc."*

**Code** is a main section (Algorithm's indigo, the `</>` icon) and **IDE** is
its first subsection: Algorithm, the code editor, moved across nearly whole.
Projects are real folders of real files in `neuronet_data/code/projects/`, so
anything else (python, git, another editor) can use them. You get an editor
that colours Python, JavaScript, Rust, HTML and CSS, tabs, find and replace
(Ctrl+F / Ctrl+H), search across a project, and a **guide** (PDF or markdown,
in `neuronet_data/code/guides/`) beside your code with the split button. The
**terminal** underneath runs commands in the project (Ctrl+Enter runs the
last one again, Ctrl+` shows or hides it). Saves are atomic, and a save stops
if the file changed on disk since you opened it. Anything unsaved is kept as a
draft (`neuronet_data/code/drafts/`) and offered back after a crash.

**How it's put together.** `code_ide.py` is Algorithm's back end
(`algorithm.py`), and `code_runner.py` is its runner. NeuroNet's Api answers
every `code_<name>` call with it (`CODE_IDE_CALLS` in `neuronet.py`). The
interface is `ui/code/`: Algorithm's four scripts, plus `ide.css`, and
`store.js` adds the `code_` prefix. It is drawn inside `#code-shell`'s
**shadow root**, because Algorithm and NeuroNet share ids (`#app`, `#toast`,
`#crumb`) and class names (`.sheet`, `.topbar`, `.pane`). In the shadow root
neither one's styles or lookups can reach the other, and NeuroNet's theme
still comes through: Algorithm's colours are NeuroNet's theme colours, with
darker syntax colours for the light themes. Like the other ported shells,
`#code-shell` is hidden when you leave, not destroyed, so open files keep
their undo history and a running command keeps running. Algorithm's keys act
only while the IDE is on screen. A command still running when NeuroNet closes
is stopped.

Fixed on the way in: Algorithm called `renderPdf` and `renderMarkdown` but
had neither, so its guides never opened. A PDF guide is now drawn by the
pdf.js Notes ships, page by page as it comes into view. A markdown guide is
escaped before it's formatted, so a guide can't run anything or navigate
NeuroNet's window away. Later subsections (guides, ebooks …) are new `code:<name>`
views in the Code section of `SECTIONS` in `app.js`.

**Super + Alt + E** (E for editor) opens Code as a popup, like every other
tool's key (`neuronet-quick code`; in the launcher too).

`test/test_code_ide.py` covers the back end through NeuroNet's Api: the
paths stay inside the project, a save stops on a changed file, drafts come
back, commands run, and runs are stopped at close. `test/test_code_ide.js`
covers the section, the shadow root, the keys, leaving and coming back, and
guides. The Neuro Guide has a Code page (`sections/code`, picture from
`SHOTS_ONLY=code bash system/guide-shots.sh`).

## Code → Guides, Research, Data Structures

Cam (2026-10-01): "Code mainsection is also going to have guides (built out
like Neuro guides ...). Algorthm research (new tool, where i can annotate,
highlight and make text boxes around a code base i wrote ...). Also then a
data structures sub section ... Think of it as an environment i can use to
learn not just programming but great software design. All guides, data
structures ect. Need to have the ability to add more."

Three more Code subsections, drawn as ordinary NeuroNet screens (not in the
IDE's shadow root):

* **Guides** (`code:guides`) — the Neuro Guide's layout: guides grouped by
  topic on the left (searchable, with topic chips), the guide on the right.
  Each guide is markdown. Code blocks are coloured by Algorithm's highlighter,
  have Copy, and a fence written as `python run` or `js run` gets a **Run**
  button.
* **Data Structures** (`code:structures`) — each structure explained (what
  it is, a table of what each operation costs, the design lesson in it)
  beside its implementations, with language tabs and **Side by side**. Every
  implementation checks itself when run.
* **Research** (`code:research`) — a code review of a folder you choose:
  select code (or click line numbers, shift-click for a range) to
  **highlight** exact characters, add a numbered **note**, or draw a labelled
  **box**. Each study has an **overview** and exports as one markdown review.
  The folder is only read. Each mark keeps the text it was made on, so when
  lines move it moves with them. If its code is gone it is kept and flagged.

**Adding more.** Guides and structures have **New** and **Edit**. NeuroNet's
starter library is `code_library/` beside the code (14 guides; 11 structures in
Python and JavaScript). Cam's own items and edits live in
`neuronet_data/code/library/`, and his copy of an item wins over NeuroNet's,
so an update never overwrites his work. **Back to NeuroNet's** deletes his
copy. Deleting one of NeuroNet's only hides it (`hidden.json`; **Show
hidden**). Any structure can take more languages (TypeScript, Rust, Go, C,
C++, Java). Run uses whatever compiler is installed, in a fresh temporary
folder with a 15-second limit. Research studies are
`neuronet_data/code/library/research/<name>.json`.

**How it's put together.** `code_library.py` is the back end, answered as
`code_lib_<name>` (its `CALLS`, registered in `neuronet.py` beside the IDE's).
The interface is `ui/code/library.js` (the bridge `CL.call`, markdown, code
blocks with Copy/Run, a Tab-aware code textarea), `guides.js`,
`structures.js`, `research.js` and `library.css`. `SS.Code` (end of
`ide.js`) hands these three views to `CL.mount`. Research draws highlights
with the CSS Custom Highlight API, so the highlighted code's markup is never
cut. It tints whole lines where that API is missing (jsdom).

`test/test_code_library.py` covers the back end. It also runs **every**
built-in implementation and every `run` snippet in the built-in guides, so
the library can't teach broken code. `test/test_code_library.js` covers the
three screens: markdown safety, Run and Copy, adding and editing, drafts
surviving a trip to another screen, making each kind of mark, and marks
finding their code again.

## The desktop Bookshelf, NeuroNet's reader and Money books (2026-10-02)

Cam: *"Now adding a bookshelf widget for the desktop, this will present covers
and i can read within the window or click again to enter reading mode. This
will be a great idea for quickly reveiwing programs, notes, ebooks etc."* and
*"The bookshelf with dekstop widget needs to have the ability to zoom in as well
so i can focus in words."* On it (Cam's choice): Ebooks, the books NeuroNet
makes (Training, Puzzles, Notes' notebooks, the Kitchen's recipe books) and new
Money books.

**The reader** (`ui/reader/`, `SS.Reader.open(kind, id, {reading})`) shows a
book's OWN printed document -- what its Print button opens -- in an iframe
`sandbox="allow-same-origin"` (nothing in it runs; the page can still reach in
to zoom it and catch a double-click). Each section hands its document over
without printing: `CF.Books.document` (Training; Python
`training_document_html` lays the page out), `CR.bookDocument` (Puzzles;
`printBook` split into `bookDocument` + print), `SS.Notebooks.document`,
`SS.KitchenBooks.document`, `SS.MoneyBooks.document`. Ebooks open in their own
reader (`SS.Ebooks.openBook`). Paper Day / Sepia / Night (filters on the frame,
pictures turned back for Night; the overlay's attribute is `data-tone` -- a
`data-paper` on it caught every click), zoom 50-300% (A- A+, Ctrl+wheel,
Ctrl +/-/0), both kept in `localStorage` `nn:reader`. ✕ or Esc closes; a book
opened from the desktop (`{fromDesktop: true}`, via open.book) then calls
`quick_hide`, back to the desktop (Cam: "when closing a book i want it to return
to the desktop by default and not keep the notes tool open"); an ebook from the
desktop does the same from its reader's back button only. Reading mode (full
screen) was built and REMOVED the same day -- "it doesnt allow me to scroll or
anything. Lets just remove it." Don't bring it back without a scroll fix.
Print prints the same document with the section's print kind.

**The list of books** (`bookshelf.py` -> `neuronet_data/bookshelf.json`), kept by
a watch started from `main()` (every 20 s, written only when it changes): kind,
id, title, subtitle, section colour and print mark, and for an ebook its cover as
a file (`bookshelf_covers/`; the library keeps covers inline). Reading only.

**The card** (`neuronet.board/BookshelfCard.qml`, catalogue id `bookshelf`, also
in `desktop_widgets.BOARD`): two columns, covers on planks, two rows then it
scrolls. A click -> `neuronet-open book <kind> <id>`. `neuronet-open` shows the tool with the new `neuronet-quick open
<section>`, which never hides -- a second note, recipe or book opened while the
popup was up used to put NeuroNet away.

**Money books** (Money -> Books, `money.js` renderBooks / bookDialog /
moneyBookDocument): a book keeps its make-up (months or fortnights From -> To,
Calculation sheet yes/no, Savings goals yes/no) in `cashbox.json` `books`
(`kitchen_backend.normalize_money` keeps them -- without it a save dropped the
key), and reads Money as it stands. Its pages are Money's own printouts bound
behind a cover with the Cashbox letterhead; each printout's styles are scoped to
its part (`scopeCss`; their `.totals` differ). Print kind `money-book`.

Tests: `test_reader.js`, `test_bookshelf.py`, `test_bookshelf_card.py`,
`test_money_books.js`, `test_money_books.py`.

## Rotate Left / Right on a right-click (2026-11-15)

Cam: *"Can you add a right click option for when i right click photos in the
file manager for rotate left and right so i dont need to open the photo to do
it please. I mean on omarchy as well not just neuronet."* One piece of code,
`photo_rotate.py`, turns the pixels themselves and sets the EXIF orientation
back to upright (so every viewer, and NeuroNet's thumbnails, agree): jpegtran
for an ordinary JPEG (lossless, EXIF kept), Pillow for anything else (PNG,
WebP, a sideways-tagged JPEG, a size jpegtran can't turn exactly). Moving
GIFs are left alone. Two ways in:

- **Omarchy's file manager:** `system/nautilus/neuronet-rotate.py`, a
  nautilus-python extension that `install.sh` copies into
  `~/.local/share/nautilus-python/extensions/`; it runs the `neuronet-rotate
  left|right FILE...` command (installed by `neuronet-setup`), which says
  in a notification if anything couldn't be turned.
- **Photos:** right-click a tile in the grid (`photoMenu` in `ui/app.js`,
  styled like the Snip button's menu); the backend's `photo_rotate` turns the
  library file and remakes its thumbnail. Picture addresses now carry the
  file's mtime in nanoseconds, so a square photo turned twice in one second
  still gets a new address.

Guarded by `test/test_photo_rotate.py`.

## Photo files named like the photos (2026-10-02)

Cam: *"when naming a photo or if it has been named within Neuronet application
please make the name in the file explorer match now. It is difficult to find the
photo i am looking for when browsing the files on the PC."* A photo's file in
`neuronet_data/photos/` is its name (`Dad Mum and Milly.jpg`), not a random one:

- **Rename** (the viewer) already moved the file, thumbnail and frame image; it
  now also fixes every reference -- the Kitchen's own photos and recipe pictures
  (`kitchenDoc`, saved from the page; the old loop looked at an empty
  `data.recipes`), then Media's `coverPhoto` and the boards on disk
  (`Api.photo_refs_rename`, exact values only). A scan of Cam's data found no
  other file naming a library photo (Training, Divination, Puzzles and the
  Journal keep copies). A NEW place that stores a photo's storedName must be
  added to `renameRefsElsewhere` (page-held) or `_PHOTO_REF_FILES`.
- **A photo named as it comes in** (`addToPhotos`, `addPhotoFromDataUrl`: covers,
  captures, board exports) gets the file name straight away.
- **Once** (pref `photoFilesNamed`), 4 s after start, the page names every named
  photo's file: backup first (`photo_names_backup` ->
  `neuronet_data/backups/photo-names-<time>/`, with `renamed.json` old -> new to
  undo by), saved every 50 so a stop part-way leaves the references matching.
  Photos with no name keep their file name. `fromKinCrux` is left alone (the
  merge's own record).

`test/test_photo_names.py`, `test/test_photo_names.js`.

## M&T: Music and Stuff as one main section (2026-10-02)

> **Moved to NeuroStream on 19 November 2026 (vote V31).** NeuroNet no longer has this; it's kept here as history. See ~/Work/NeuroTV (NeuroStream) for how it works now.


Cam: *"remove the requirement for double album storage locations. Lets move the
music player into the main section where i store lists of the media, however
lets rename stuff to M&T short for (Media and Things). This is where the sub
subsections from both music and stuff will now live ... a more central
location."* The section's KEY is still `stuff` (old prefs, favourites, links,
hidden sections and navOrder keep working); its name is **M&T**; its menu is
Music's pages (`lead` in SECTIONS, kept first when stuff.js sets its children)
then Media, each inventory, Inventories. `sectionOf` files `music:*` under
`stuff`, so the menu, colour and crumb follow; pages are still routed by their
module's VIEWS, so Music draws Music. **Super+Alt+M** opens M&T on its music
pages and **Super+Alt+I** on its media pages, each on the last page used there
(`QUICK_HALVES` in SS.quickMode). The bar launcher has one M&T entry; the
Omarchy menu has "M&T: Music" and "M&T: Media"; `neuronet-path hidden music`
counts as M&T; App stats folds old "music" time into M&T; the Neuro Guide has
one M&T page. Multitask still blocks the same MODULE only, so Music beside Media
works.

## Vault and Notes swapped (1.0.6.1, 2026-10-02)

Cam: *"swap the names for Notes and Vault over, it would be better suited that
way."* The main section `notes` is named **Vault**; its page `notes:vault` is
named **Notes** (as are the Notes handbook guides). Keys and views are
unchanged, so links, favourites and prefs all still land. The launcher, the
Omarchy menu, the Super+Alt+N description and the Neuro Guide follow; "Vault
root" (the top folder of the notes on disk) keeps its name.

## Cam's bug and change list (1.0.7, 2026-10-02)

Ten items from a Fleeting-note list. Each is guarded by the test named.

- **Files that appear after the shell starts.** Quickshell 0.3 never watches
  a file that is missing when the shell starts, not even once it's made. On a
  fresh install (the ISO laptop) the card tools' state files, the shared
  layout `neuronet-desktop.json` and the board's settings didn't exist yet. So
  the board never saw an Oracle/Lenormand pull: it kept removing the card's
  spot while the card tool kept putting it back (the flashing), and the
  Today card's slot stayed empty. And every widget kept a private layout,
  which pushed widgets about. Every such `FileView` now has `gone` set on
  `loadFailed`, and one timer per plugin reloads it every 3 s while it's
  missing (DeskSpace, Board, BriefCard, Service). `system/install.sh` also
  seeds the files. **A new watched file needs the same.** Guard:
  `test_desktop_late_files.py`, which runs the real Board and Service in a
  throwaway `qs`; against the old code it shows both bugs.
- **Settings → Desktop widgets takes at once.** The board's own
  `neuronet-board.json` wasn't watched at all. It is now.
- **Hidden widgets give up their spots.** `plan()` in Board.qml drops
  `board.*` spots not in `shown` and the frame's spot while it's hidden or
  off. A leftover spot was invisible but still pushed others out of the top
  left.
- **Daily cards are off the desktop until "Show on desktop"**
  (`desktopCard === true` in Service.qml, Board.qml and `desktop_widgets.py`
  alike). A card tool only places its own card when there's no board.
- **Closing a daily card's reading goes back to the desktop**: Service.qml
  notes whether NeuroNet's popup was up when the reading opened, and puts it
  away again (`neuronet-quick hide`) if it came up meanwhile. The music bar
  widget starts NeuroNet hidden (`neuronet-quick start`) to play.
- **Scrapbook photos** (`test_scrapbook_photos.js`). The editor sees a
  double-click itself: two presses on one spot within 450 ms, let go without
  moving. The first press redraws the board and replaces the element under
  the pointer, so the browser's `dblclick` often never came. Photos panel at
  the top of the materials (newest 24, or search via `SS.shared.photoSearch`;
  click: into the chosen frame or onto the page; drag `nn-photo:<stored>`:
  onto a frame fills it). Photo position: `fx`/`fy` (0..1) and `zoom` on the
  item, with `nw`/`nh` the photo's natural size. `photoGeo`/`photoImage` in
  editor.js draw it, for Boards photos and Scrapbook frames (`photoBox`). Older
  items without `nw` draw as before. Right-click = move mode
  (`startReframe`/`panPhoto`/`onWheel`/`endReframe`, one undo).
- **Enter answers the box on top** (`enterAnswersBox` in app.js, a
  window capture listener; `test_enter_confirms.js`). The box is any
  `.open > .modal` or Training's open `.sheet`. Its main button is
  `[data-act|data-a="yes"]`, else the last
  `.btn-primary/.btn-save/.btn-danger/.primary-btn`. A focused button in the
  box is pressed itself. In a field, the field's own Enter runs first. A
  textarea keeps Enter.
- **App stats** (`test_app_stats.js|py`): time counts only while the window
  has focus (`document.hasFocus()` and blur/focus); the popup is hidden on a
  special workspace the page never hears about. **Reset stats** →
  `Api.usage_reset` → `app_stats.reset` (old file kept as
  `usage.json.before-reset-<when>`).
- **Fleeting**: Copy on the desktop viewer (`wl-copy`, the text on stdin;
  `test_fleeting_viewer.py`). **Export all to PDF**: `fleeting_pdf.py` +
  `Api.fleeting_export_pdf`, rendered by `guidebook_pdf.html_to_pdf`
  (`test_fleeting_pdf.py`).
- **Screensaver** (`screensaver.py`, `test_screensaver.py`). Omarchy's
  screensaver plays `~/.config/omarchy/branding/screensaver.txt`;
  NeuroNet's art is `system/omarchy/branding/screensaver-neuronet.txt` (block
  letters drawn like Omarchy's logo). The previous text is kept as
  `screensaver-omarchy.txt` and restored by "Omarchy". The installer
  switches only over Omarchy's untouched logo. Settings → Desktop widgets →
  Screensaver.

## Glowing window borders, the widgets' slider, the Training viewer (1.0.8)

Cam (2026-10-02): the NeuroNet theme's lit-up border in every theme, with a
switch; an opaque/transparent slider for the desktop widgets; and *"the
session/circuit viewer with print feature as a desktop widget ... with the
respective colours"*.

- **Window glow** (`window_glow.py`, `test_window_glow.py`,
  `test_settings_glow.js`). The look is the NeuroNet theme's `hyprland.lua`:
  a 45° two-colour active border, a glow (shadow, range 14) in the first
  colour, a dim inactive border. `system/omarchy/glow-themes.json` holds the
  supported themes: all 38 on Cam's desktop on 2026-10-02, two colours each,
  from the theme itself (its border gradient, else its accent and its cyan).
  It was made once with `python3 window_glow.py --build`; don't rebuild it
  unless the list of supported themes should change. The switch (Settings →
  Appearance) writes `~/.local/state/neuronet/glow.lua` and runs
  `hyprctl reload`. The NeuroNet block in `hyprland.lua` `dofile()`s it,
  after the theme. That's `dofile`, not `require`: the bootstrap only clears
  `default.hypr`/`hypr`/`omarchy.current.theme` modules between reloads. The
  Lua reads the current theme's name itself, so switching theme needs nothing
  from NeuroNet. A theme not in the table gets two colours hashed from its
  name, by the same rule in Lua and Python (`name_colours`), so Settings
  shows what the border does.
- **Widgets' background** (`desktop_widgets.get/set_opacity`, Settings →
  Desktop widgets → Background): `~/.config/omarchy/neuronet-widgets.json`
  `{"opacity": 0..1}`, read and watched by DeskSpace.qml (`glassOr(own)`).
  Board cards (0.78), the frame (0.72) and the daily cards (0.78) keep their
  own until it's set; Reset removes it.
- **Training viewer** (`neuronet.board/TrainingCard.qml`, board id
  `training`, span 2; `test_training_card.py`). It reads
  `training/coach_cam.json` and never writes it. Sessions are grouped by
  block in Training's block colours (the `--block-*` values of
  `ui/shared.css`, copied into `blockRgb`; the test checks they match).
  Circuits are numbered in Training's gold. ‹ › steps through them by name,
  and List picks one. Print runs `print_training.py`, which makes the app's
  own sheet (`training_documents.print_page` + `_session_html` /
  `_circuit_html`), opens it with `open_print_document` and counts a
  `print:training-<kind>`. NeuroNet needn't be running.

## Training viewer settings + notes, the Session builder (1.0.8)

- **Viewer settings** (TrainingCard.qml). Open them from the title's
  right-click → Settings…, or ⚙. Card.qml's `ownSettings` /
  `settingsWanted` let a card offer its own panel instead of the board's.
  Settings are text size (`textScale`) and how solid the box behind the
  session is (`solid`), saved in `~/.config/omarchy/neuronet-training.json`.
  The panel is its own Top-layer window beside the card, like the Clock's.
- **Note**: a few words, saved by NeuroNet (`training.note` → `trainingFromDesktop`
  in app.js) into that session's or circuit's `notes`, dated, under what was
  there.
- **Session builder** (BuilderCard.qml, board id `builder`;
  `test_builder_card.py`, `test_training_desktop.js`). It searches Training's
  exercise library, and blocks carry on as Training's own `nextBlock` /
  `nextLetter` do. Rows are edited in place: a new list on each keystroke
  rebuilt the rows and lost the typing focus. Save goes through
  `training.session.add`, which builds the record as `editSession` does and
  pushes it into `CF.Store`'s document (the copy Training on screen holds).

## Code → Web playground (1.0.8)

`ui/code/web.js` (CL.Web, view `code:web`) + `code_web.py` (pages in
`neuronet_data/code/web/<id>.json`, by id only); `test_web_playground.js`,
`test_code_web.py`. HTML and CSS tabs on the left, the page on the right, live
(250 ms) or Ctrl+Enter / Refresh; saved as you type; Export .html. The preview
is `<iframe sandbox="">` given `srcdoc` with its own CSP
(`default-src 'none'; style-src 'unsafe-inline'; img-src data: ...`): no
scripts, its own origin, no forms or pop-ups, nothing fetched. Never loosen the
sandbox; `draw()` sets it again every time.

## Security: no remote code execution (1.0.8)

Cam: *"take the perspective of a senior cyber security expert to ensure there
is no chance for remote code execution within the application. This is as a
whole as well."* `test_security.py` guards every point.

The threat: NeuroNet's page holds the bridge to Python (`window.pywebview.api`),
and the IDE's runner can run commands. Any foreign script in that page would
be code running on the computer.

1. **Where the window may go** (`navigation_verdict`, `lock_qt_navigation` in
   neuronet.py). **pywebview serves `ui/` from its own server on
   `http://127.0.0.1:<random port>`**, not `file://`: "ours" is exactly that
   origin, taken from the window's `real_url`. The main frame may only show
   ours. A clicked http(s)/mailto link opens in the browser; anything else is
   refused (logged "NeuroNet: refused to go to …"). Frames may show about:,
   data:, blob: and ours, never the web. New windows (pywebview's
   NavigationHandler) only hand http(s)/mailto to the browser. Before this,
   the page's bridge went to any page the window loaded.
2. **pywebview's HTTP bridge** (`POST /js_api/<uid>`, CORS *, a uuid1 name) is
   sealed: `BottleServer.js_callback` is always empty. Nothing registered
   behind it for Qt, but a website in the browser could otherwise post to it
   if a pywebview update ever did.
3. **Content-Security-Policy** on index.html: scripts only from `'self'` /
   `file:` plus the UI-scale snippet's hash. `'unsafe-eval'` is there because
   pywebview builds its bridge with `new Function`. So no injected `<script>`,
   no `on…=` handlers, no `javascript:` links. **Changing the inline snippet
   means changing its hash.**
4. **PDFs**: `isEvalSupported: false` in every `getDocument` (CVE-2024-4367;
   the vendored pdf.js 4.10.38 is already past it).
5. **Imported content**: EPUB goes through an allow-list cleaner
   (ebooks.py `_Clean`), notes' markdown is escaped, and links out of notes
   open only if they're http(s).
6. **Frames**: the reader is `sandbox="allow-same-origin"` (no scripts); the
   playground preview is `sandbox=""`.
7. **Local**: the media server listens on 127.0.0.1 only, with a secret
   token, read-only. JavaScript that Python sends to the page always goes
   through `json.dumps`. `shell=True` appears only in the IDE runner (Cam's
   own commands). There's no eval/exec/pickle of data. `neuronet-quick dock`
   takes only a hex window address.

It was checked on the real app (offscreen, temp data, CDP). Injected
`<script>`, `onerror=` and `javascript:` were refused; `Page.navigate` to a
website and to another local port were aborted by the lock; the preview's
scripts were blocked and its contents unreachable; the bridge still worked.

## Recipes widget, favourites, the modern Kitchen; the new visualizers (1.0.8)

- **Recipes widget** (`RecipesCard.qml`, board id `recipes`, span 2;
  `test_recipes_card.py`). It reads `kitchen/cookery.json` and never writes
  it. Pictures (the library's own `photos_thumbs/<stem>.thumb.jpg`) or Words,
  plus text size (`~/.config/omarchy/neuronet-recipes.json`). Search covers
  names, tags and ingredients. A recipe opens inside the widget. ♥ goes
  through `recipe.favourite` and Print through `recipe.print`, both in
  `app.js` `boardAction`.
- **Favourites**: `r.favourite` on the recipe (absent = not). The Kitchen and
  the widget sort favourites first, then A–Z, case-insensitive.
  `CP.Cookery.refresh()` redraws the Kitchen after a desktop change.
- **The Kitchen's look** (`cookery.js` renderRecipes / renderRecipeSplitView,
  `.rk-*` in cookery.css; `test_recipes_app.js`):
  - photo cards (`<img class="rk-img">`, not a background: jsdom drops long
    background data URLs);
  - the recipe page has its photo across the top, ingredients to tick off and
    numbered steps;
  - `#cc-content` / `#cc-split-pane` finally have a layout: the list on the
    left, the open recipe on the right (a sheet on narrow windows). Before,
    the pane rendered under the whole list.
- **Visualizers** (`ui/music/nnviz.js`, identical to
  `neuronet.board/nnviz.js`; `test_visualizers.py` / `.js`). There are six
  styles (ribbons, silk, bars, dots, pulse, waves) and palettes (neon, aurora,
  sunset; "theme" from the accent). The code is plain ES5, so QML's Canvas
  imports the very same drawing.
  - In the app, `CH.Visualizer` decodes the track on a NEVER-connected
    AudioContext (the playback path stays untouched) and works out a 32-band
    spectrum at 20 fps: an FFT done in slices, each band scaled to its own
    96th percentile but never below a quarter of the loudest band. It's
    stored as one character per level.
  - The Music widget's ≋ (`MusicCard.qml`) asks `music.viz` every 90 s.
    While asked, NeuroNet writes the song's spectrum ONCE per song to
    `$XDG_RUNTIME_DIR/neuronet/viz.json` (`Api.music_viz_publish`). The widget
    draws it at the MPRIS position, only when the published title matches the
    playing one.
  - Widget settings (`neuronet-musicviz.json`): Small / Medium / Large = span
    1 / 2 / 3, plus the style and palette.
- **Session builder**: every search match, in a list that scrolls (six rows
  high).

## Widgets that stop taking clicks; Super+Alt+W; ♥ songs; the card guide (1.0.8)

- **Why the widgets could stop taking clicks** (`test_shell_restart.py`).
  The board, frame, logo and daily cards are each a full-screen Bottom-layer
  window that takes clicks only over its widgets (`mask`). While something is
  dragged, its window takes the WHOLE screen, so a fast drag can't slip off.
  A release the window never hears about left that in place: an invisible
  layer over the widgets took every click, until a workspace switch re-made
  the windows. Now:
  - a drag that hasn't moved for 3 s is let go where it is (`dragSeen`,
    `letGo`, `dragEnd`);
  - the mask is laid again every 4 s while nothing is dragged
    (`remaskNow`);
  - each window answers `qs ipc -p /usr/share/omarchy/shell call
    <neuronet.board|frame|home|tarot|oracle|lenormand> state|heal`.
- **Super+Alt+W = `neuronet-shell restart`**. It first writes a report
  (`~/.local/state/neuronet/shell-reports/`, the last 20: each window's state,
  `hyprctl layers`, the workspace, the cursor), then `omarchy restart shell`.
  `neuronet-shell report` and `neuronet-shell heal` do just those. If it
  happens again, the newest report says which window had taken the screen.
- **♥ songs and "add to a playlist"** (`test_music_favourites.js`,
  `test_mpris.py`, `test_visualizers.py`):
  - `tracks[file].favourite` in `chords.json`, via
    `CH.tools.chords.isFavourite / setFavourite / favourites / playlistList`;
  - the page tells MPRIS `favourite`, which goes out as `xesam:userRating`
    (1.0 / 0.0) and counts as a Metadata change;
  - the app has ♥ and + in the top-bar player (`#cc-mini-fav`,
    `#cc-mini-add`); `CH.PlaylistMenu` is a small menu by the button that
    closes on a pick, Esc or a click outside; and Playlists starts with
    ♥ Favourites (`__favourites`, made from the flags);
  - the desktop Music widget and the bar's Music widget call
    `music.favourite` / `music.playlist.add`, and their ♥ reads userRating.
- **The card guide** (`Service.qml`, all three tools; `test_card_guide.py`):
  right-click a turned card in the reading. `guideFlip` turns it again, to a
  face with a gradient (#5a2a9c at the top, #3b1670 at 90%, black at 100%):
  the name, kind / suit / deck, upright and reversed (the one drawn marked)
  and the synopsis. It scrolls with the wheel; a click turns back.
  `plainGuide()` on open / redraw.
