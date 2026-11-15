"""The dashboard as a tool: dragging blocks, and starting music from it.

Cam: "lets modernise the edit layout of the dashboard to make it a better
tool to use. I would like the ability to drag and drop when editing the
layout, also please add a music widget where i can select music to play in
the form of saved playlists or albums, this way when i first open the app i
can start music quicker in less clicks."
"""
import os
# Never Cam's real data: since the 1.0.2 install ~/.config/neuronet/paths.json
# names it, and data_dir() reads that before anything a test patches. A file
# that can't exist means "no config" here and in every process a test starts.
# test_test_isolation.py checks every test does this first.
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
UI = os.path.join(os.path.dirname(HERE), "ui")
passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1; print("  ok    " + name)
    else:
        failed += 1; print("  FAIL  " + name + ("\n          " + str(detail) if detail else ""))


read = lambda p: open(os.path.join(UI, p), encoding="utf-8").read()
print("\nThe dashboard\n")
home, css, chords = read("home/home.js"), read("home/home.css"), read("music/chords.js")

# ---- every function Home calls must exist in it -------------------------
# The scan that lifted Home out of KinCrux matched "function x(" and missed
# every "async function x(" -- including saveBlocks, so ADDING, REMOVING or
# REORDERING a block threw and nothing about the layout was ever saved.
# Whether every function Home calls actually EXISTS is checked by running the
# dashboard in test_dashboard_blocks.js, not by reading the source here. A
# regex sweep was tried and abandoned: Home is full of nested template
# strings, and stripping them well enough to tell a call from a word in a
# string is the same work as parsing JavaScript. Running it answers the
# question outright -- a missing function throws.
ok("  and saveBlocks actually persists the layout",
   re.search(r"async function saveBlocks\(\)\s*\{[^}]*setPrefs\(\{dashBlocks\}\)", home, re.S) is not None)

# ---- dragging blocks ----------------------------------------------------
# No longer draggable="true": HTML5 drag gives a ghost image and a drop
# target, which is the wrong shape for placing on a grid. Pointer events let
# the block follow the pointer and show the square it would take.
ok("blocks are dragged while editing",
   "function wireBlockDragging(" in home
   and "if (dashEditing) wireBlockDragging(page);" in home
   and "setPointerCapture" in home)
ok("  the up and down arrows are gone", "data-move=" not in home and "dash-grip" in home)
# Placing is a column and a place in it now, so these ask about that. (They
# replaced checks about a drop line, and before that a free-grid square.)
ok("  the column and the place under the pointer are both worked out",
   "function columnUnder(page, clientX)" in home
   and "function slotUnder(colEl, clientY, movingId)" in home)
ok("  and where it will land is shown",
   ".dash-block.drop-above" in css and ".dash-block.drop-below" in css)
# Three buttons in the corner sat ON TOP of the block's own heading.
ok("the block's controls have room of their own, not the heading's",
   re.search(r"\.dash-blocks\.editing \.dash-block \{[^}]*padding-top", css) is not None
   and re.search(r"\.dash-block-tools \{[^}]*position: absolute", css) is not None)

# ---- the music block ----------------------------------------------------
ok("there is a music block", '"Music"' in home and "function musicBlockBody(" in home)
ok("  offering playlists and albums", 'data-shelf="playlists"' in home and 'data-shelf="albums"' in home)
ok("  one click plays one", "data-play-id=" in home and "music.play(btn.dataset.play" in home)
# Reading and playing go through the music section's own functions.
ok("Music exposes its shelves to the dashboard",
   "shelves()" in chords and "getAlbums()" in chords and "playAlbumById(" in chords)
ok("  and an album is played the same way the Albums shelf plays it",
   re.search(r"playAlbumById\(id(, from = 0)?\)\s*\{[^}]*playAlbum\(a, (0|from)\)", chords, re.S) is not None)
# CH.tools.chords, not the right panel's own helper, which is out of scope here.
ok("  reached through the right object",
   "CH.tools && CH.tools.chords" in chords)
ok("  and the block reads them fresh each time it draws, so a rename shows",
   "music.shelves()" in home)

# Cam: "the album covers don't appear in the music widget."
#
# shelves() reports `art` as the STORED FILE NAME -- "album_al1.jpg" --
# because that is what an album record holds. The block put it straight into
# an <img src>, so the browser looked for ui/album_al1.jpg, a file that has
# never been there, and every cover came out blank. Measured in a real
# browser: four failed requests for exactly that path, six items, zero
# pictures.
#
# Album art lives in the data folder and can only be reached across the
# bridge, which hands back a data: URL. So the block draws its placeholder
# and asks, and fills each cover in when it lands.
ok("the music block never puts a stored file name into an img src",
   'src="${escA(it.art)}"' not in home,
   "ui/album_al1.jpg has never existed; that is what a bare art name asks for")
ok("  it asks for the picture instead, after it has drawn",
   'data-art="${escA(it.art)}"' in home and "music.artURL(" in home)
ok("  and Music offers that as a real, cached call",
   "artURL(name, edge)" in chords and "cachedThumbURL" in chords,
   "cached so a cover already fetched for the album shelf costs nothing here")
ok("  with the note placeholder still there when an album has no art",
   "dash-music-note" in home)

# ---- the chooser --------------------------------------------------------
ok("each block in the chooser has an icon and its own lines",
   "BLOCK_ICONS" in home and "dash-add-ic" in home and "dash-add-hint" in home)

# ---- the layout has to come BACK ---------------------------------------
# Cam: "when i edit the layout of the dashboard then exit the app, the changes
# i made are gone." saveBlocks wrote them faithfully; nothing ever read them,
# so every launch drew the defaults. KinCrux never read them either -- the
# comment claiming it happened "at boot" described nothing.
ok("the saved layout is read back", "async function loadBlocks()" in home
   and "prefs.dashBlocks" in home)
ok("  before the dashboard first draws, not after",
   re.search(r"async mount\(hostEl, which\) \{\s*(?:/\*.*?\*/\s*)?await loadBlocks\(\);", home, re.S) is not None)
ok("  and only once, however often Home is opened", "blocksLoaded" in home)
ok("  with the default layout if there are no prefs to read",
   re.search(r"catch \(e\) \{[^}]*default layout", home, re.S) is not None)

# ---- three columns, three widgets each ---------------------------------
# Cam: "maybe if we broke the dashboard into 3 collums with the ability to add
# 3 widgets into each collumn, i dont need a massive photo frame." The free
# grid before this was fiddly -- sizes to get right, squares to miss -- so a
# widget now belongs to a column and a place in it, nothing else.
css = read("home/home.css")
ok("the dashboard is three columns",
   "const DASH_COLS = 3;" in home and "const PER_COL = 3;" in home
   and re.search(r"\.dash-blocks \{[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)",
                 css, re.S) is not None)
ok("  a widget has a column and a place, and no size to get wrong",
   "b.col = " in home and "b.slot = " in home
   and "delete b.x; delete b.y; delete b.w; delete b.h;" in home)
ok("  every widget is the same height, so a photo frame cannot swallow the page",
   re.search(r"\.dash-block > \.panel,[^{]*\{[^}]*height: 300px", css, re.S) is not None)
ok("a column already holding three refuses a fourth",
   "const columnIsFull = (blocks, c)" in home
   and "columnIsFull(blocks, c)" in home and "is-full" in css)
ok("  and says which column would take it", ".dash-col.is-target" in css)
ok("dragging picks a column and a place in it",
   "function columnUnder(" in home and "function slotUnder(" in home)
ok("nothing is saved until the pointer is released",
   re.search(r"const up = async \(\) => \{.*?await saveBlocks\(\);", home, re.S) is not None)
# An arrangement made under the old free grid must not be lost.
ok("widgets saved with the old squares are moved into columns once",
   "const needsMoving = blocks.some((b) => !Number.isFinite(b.col));" in home)
ok("a narrow window falls back to one column",
   re.search(r"@media \(max-width: 900px\)[^@]*grid-template-columns: 1fr", css, re.S) is not None)

print("\n  %d passed, %d failed\n" % (passed, failed))
sys.exit(1 if failed else 0)
