# What's new in NeuroNet

The version is in `VERSION`. Each release has a section here, newest first,
written for the people using NeuroNet rather than for the code. The ISO and
the updater take the version from `VERSION`; a release is a git tag
`v<version>` on the NeuroNet repository. Before tagging, run
`python3 tools/make_starter.py` (the starter data below, 1.0.39) and push the
`starter-files-…` tag it names along with the release. Then `python3 tools/make_public.py` makes the public release: the same version without any of Cam's data (the starter), as one commit in its own repository (tools/public.json names it).
NeuroTrain's starter library (everything but programs) is made the same way: `node ~/Work/NeuroTrain/tools/make_library.js`, then commit `library/starter.json` in NeuroTrain before `tools/push_apps.sh`.

## 1.0.186 — Window snap, a ThinkPad workstation, a new ISO (16 November 2026)

- **Window snap, like Windows.** Drag a floating window (by its title bar on a floating workspace, or with Super + drag) until the pointer touches the edge of the screen: an outline shows where it will go, and when you let go it fills that space. Left or right edge: that half. A corner: that quarter. Up into the top bar: the whole screen. The bottom edge: the bottom half. Drag a snapped window away and it gets its old size back. Hyprland's own magnet snapping is unchanged, and tiled windows aren't touched.

- **More computers can be workstations.** The developer kit can now be made for a named computer (`tools/make_dev_kit.sh <folder> --name ThinkPad`): its own key on GitHub, its own note for Claude, and the standalone apps (NeuroCafe, NeuroCode, NeuroArcana, NeuroTrain, NeuroTV) come in the kit, so `enable-dev.sh` puts them in ~/Work and builds NeuroTV.

- **The ISO builds again.** Omarchy's ISO builder changed a lot since October (it now installs a ready-made system image); NeuroNet's ISO follows it, so a new computer installs the latest Omarchy and kernel with NeuroNet already in.

## 1.0.185 — NeuroTV, NeuroTrain's library, potions stay in hand, nine new decks (16 November 2026)

- **NeuroTV.** Super+Alt+W opens NeuroTV, the IPTV player: live channels with a guide, films and shows, and favourites, from an Xtream Codes sign in or an M3U playlist, plus NeuroNet's own films and shows under My Media. It has its own entry in the app menu.

- **NeuroTrain's starter library.** NeuroTrain 0.5.0 comes with the whole exercise library, the session and circuit templates and the rep schemes (never the programs). It only ever adds to yours.

- **NeuroTrain travels between your computers.** `neuronet-dev pull` (and `neuronet-dev data`) now keeps NeuroTrain's programs, library and PDFs in step between the PC and the laptop, like the notes and Collaboration. It leaves NeuroTrain alone while NeuroTrain is open, and says so.

- **NeuroCafe: potions stay in hand.** Pick a Quick, Sell or Fresh potion in the Bag and it stays in your hand after each use, so you can go stove to stove without opening the Bag again. Esc puts it away; it puts itself away after the last one.

- **Rotate Left / Rotate Right on a right-click.** In the file manager (Nautilus), right-click a picture (or a whole selection of them) and choose **Rotate Left** or **Rotate Right**: the picture turns in its own file, with no need to open it. The same right-click is in NeuroNet's **Photos** grid (on a ticked photo in Select mode it turns every ticked one). Ordinary JPEGs turn losslessly; the file manager picks it up the next time it opens.

- **Nine new decks.** **Necronomicon**, **Seasons Of The Witch - Autumn Tarot** and **Seasons Of The Witch - Winter Tarot** (tarot), **Under The Roses Lenormand**, and **This Might Help Oracle**, **Oracle Of The Divine**, **Enchanted Forest Oracle**, **Roots And Runes Oracle** and **Mayan Oracle** (whose cards carry their printed meaning) are in Divination, with their meanings left empty for the guidebooks, and in NeuroArcana, where Lenormand decks now play as oracle cards (so Lenormand Of Enchantment joins too). New scanned decks can go in the same way: `tools/add_scanned_deck.py` with a deck list in `tools/decks/`.

## 1.0.184 — Paste a cover, Media travels, a public release (15 November 2026)

- **Paste a cover in Edit.** With a film's (or album's) Add or Edit window open, copy a picture (in Brave, right-click the picture, Copy image) and press **Ctrl+V**: it becomes the cover, and goes into Photos → Covers. NeuroNet reads the clipboard itself when the window can't see the picture, and fetches a picture that comes only as its web address. Words pasted into the title or notes still go in as words. Save keeps it.
- **Drag a picture in.** Drag a picture from a web page or the file manager anywhere onto the Add or Edit window and it's the cover; the Photos import box no longer covers the window.
- **One place to change a cover.** The film's own page no longer has Change cover on its cover; everything is in Edit, including **Still from the film** and, for a CD from Music, **Album cover**.
- **Your Media travels with each release.** Every film, album, book and game, with its formats, notes, stars and covers, goes to your other computers with the release, like the recipes and Training already do. The films and songs themselves stay where they are. A title changed on the other computer keeps that computer's change; a new one arrives; one you deleted there stays deleted.
- **A public release.** NeuroNet can now be released without any of your data (no recipes, Training, decks, notes, Collaboration or Media): the same code, as its own copy, for anyone else.

## 1.0.183 — Scan a barcode into Media (15 November 2026)

- **Scan.** Media has a **Scan** button beside + Add (on the covers and on the List). Type the number under a barcode, or use a USB barcode scanner (it types the number and presses Enter for you), and NeuroNet looks it up: the title, who made it, the year, the format (DVD, Blu-ray, VHS, CD, vinyl, a game's platform, paperback...) and the cover. Check it, change anything, press Enter, and it's in Media, ready for the next one.
- **Where it looks**, all free: MusicBrainz for CDs, vinyl and cassettes, Open Library for books (ISBNs), and a UPC database for films, games and the rest (about 100 lookups a day), with Wikidata filling in a film's year and director. Only the number is sent.
- **Photos of barcodes work too.** **From photos…** reads the barcodes in pictures you choose, one after another. Or drop phone photos of the backs of cases into **Documents/NeuroNet Picture References/Art to Action/Barcodes** and press **Barcodes folder**: each one comes up to check, and once added its photo moves to the folder's Archive.
- **No double ups.** A barcode already in Media (or the same title) adds the new format to the one you have, and a cover you chose yourself is never replaced. A barcode nobody knows opens empty for you to type in, and the barcode is kept with it so it's found next time.

## 1.0.182 — NeuroNet Snips, Media Art and app cards (15 November 2026)

- **Snip, built into NeuroNet.** The scissors in the top bar (or Super+Alt+X) open Omarchy's own screenshot tool, with everything it does: drag a box, click a window or click empty space for the whole screen, then the floating preview with Pin, Copy and Edit, the annotation editor and the clipboard copy. Right-click the scissors for Region, Window, Full screen or Scrolling.
- **Every snip is named and kept twice.** It's saved as `YYMMDD - Snip N` (the number counts up for good, so "Snip 22" is always the same picture) in **Documents/NeuroNet Snips**, and in **Photos → NeuroNet Snips**. If you edit it in the preview and save, the edited picture replaces it under the same number.
- **Save as.** Straight after a snip (from the scissors), or by clicking the notification (from the key), NeuroNet asks for a name: `261115 - Snip 22 - (` what you type `)`, like "For Q22" or "New Numbers Feature". Rename in the photo viewer does the same for a snip later, in Documents and in Photos.
- **Archive.** Snips that have been used move into **NeuroNet Snips/Archive** (and Photos → NeuroNet Snips → Archive), so the folder holds only what's still waiting.
- **A Snip box on Collaboration questions.** Tick it on a question (or a play test item) to say there's a snip for it in the folder.
- **NeuroNet Picture References.** Snips now live in **Documents/NeuroNet Picture References/NeuroNet Snips** (the first folder moved in by itself). Beside it, **Art to Action/Media Art** is for photos of covers (DVD, VHS, Blu-ray, vinyl, CD, cassette...): drop them in and Claude reads each one, finds the film or album in Media (or adds it), tags the format and puts the picture on as its cover, then moves the photo to Media Art's Archive (`neuronet-media-art`).
- **App cards on the dashboard.** Home's dashboard opens with a card for every app in the sidebar, in the same order, each showing its first pages; a click opens the app. Edit layout can hide them.
- **Drag the page tabs into order.** Hold the left button on a tab above the page and drag it along the row; the menu on the right follows the same order. A click still opens the page.
- **Peg Solitaire and Mastermind are gone** from Puzzles.
- **Media keeps what's added elsewhere.** A film or album added while the Media list was open (a cover from Media Art, a CD from Music, the other side of Multitask) is no longer dropped by the list's next save.
- **The Photos menu looks like the rest of NeuroNet.** Folders are cards like everything else, set in under their parent. Names and counts no longer squeeze each other ("All ph…"), the chosen folder uses Photos' colour, and folded to icons every entry is the same centred tile, with no scrollbar over them.

## 1.0.181 — Media by type, Cinema in Media, and the team's ideas (15 November 2026)

- **Media is by type now, with formats as tags.** Add a film once, then tick the formats you own it on: DVD, Blu-ray, 4K UHD, VHS or Digital. Music has Cassette, Vinyl, CD, MP3 and FLAC; books and games have theirs. Adding the same film or album again offers **Add to it**, which puts the new format on the one you already have instead of making a double up. On the shelf, format chips (with counts) narrow each type, and the formats show on the covers, on printouts and in Excel, Word and Cells.
- **Your collection is converted for you**, once, the first time Media opens: each item becomes its type with its old format as a tag, and any double ups are joined (notes, stars, covers and linked videos kept). The file as it was is kept beside it.
- **Your films are in Media.** Everything in your Movies folder (GOAT, Faces of Death and the rest) comes in as a film tagged Digital and already linked, so it plays from Media.
- **Play from the cover.** The ▶ on a cover plays the film straight away; press anywhere else on the cover to open its page. A film tagged only VHS can still have a video linked to it, and its Play turns green.
- **Cinema's own player.** Films play inside NeuroNet: play and pause, a timeline you can click, skip back and forward, closed captions, a settings cog (captions, upload subtitles), theatre and full screen, and it works in split view. Its separate page and icon are gone; it opens from Media's Play.
- **From Cam's Collective** before it was retired (team vote V30): Solitaire (press and drag cards, they lift see-through), Pyramid and Colour by Numbers in Puzzles, puzzle pictures only from your Photos, and a recipe from a web link in the Kitchen (with a photo pasted from the clipboard as a placeholder).
- **Puzzles is leaner.** Lights Out and Hitori are gone, and the puzzle tabs wrap so every puzzle shows in a floating window.
- **Colour by Numbers** has a bigger, centred grid that the zoom grows, 24 to 48 colours, and two new sizes, Huge and Giant. A finished picture is saved to **Pixel art** (Assets, In progress) to change or redraw later, and **Open in Pixel art** takes you there.
- **NeuroTrain.** Super+Alt+T opens NeuroTrain where it's installed, with its own entry in the app menu; Training's Sessions, Programs and Calculators give way to it there, and NeuroNet's Training stays where it isn't.
- **The Claude dock** (Super+Alt+U) is part of NeuroNet.
- **Checked against the Omarchy 4.5 update**: the key list, the Guide's keys and the reader's zoom are right on the new version.

- **A rolling project for NeuroNet's future.** Scribe > Collaboration has a new project, **NeuroNet: Ideas and Plans**, where the whole team keeps ideas, optimisations and new features for NeuroNet as a whole, each saying who raised it. N95 explains how it works; the first review added eleven ideas (I13 to I23).
- **A pop-up when something new arrives in Collaboration.** When the team adds an idea while working, a desktop notification says what it is and who raised it. Click it to open that document in NeuroNet (`neuronet-open collab <code>` does the same).
- **What's new in Collaboration, in the app** (I20). A count on **Scribe** and on **Collaboration** shows how many documents are new or changed since you last looked, with a dot on each one and "· n new" beside its project. Opening one clears it, and **Mark all seen** clears them all. Your own documents and edits never count.
- **Either computer can release everything** (I14). `tools/push_apps.sh` is part of NeuroNet now, so a release from the laptop pushes NeuroCafe, NeuroCode and NeuroArcana too, and publishes NeuroCode's GitHub release when it has a new version.
- **Keys-only SSH for the PC in one step** (I17). `system/ssh-keys-only.sh`, run on the PC, turns passwords off (checking first that you have a key, so you can't lock yourself out). Chapter 6 of the Networking Handbook explains it; `--undo` puts it back.

## 1.0.180 — NeuroCafe half walls (8 November 2026)

- **Half walls in NeuroCafe.** A new **Build > Half walls** tab builds low walls on the *lines between tiles*, not on a tile, so you can run one round your kitchen and still put counters right up against it on both sides. Point at a line (the nearest one decides whether the wall runs across or down), click for one piece or press and drag for a straight run. Each piece costs 15 coins, and you get them back when you take it down: right-click a piece, or use **Take down** and drag along them. Customers can't step across a half wall, so the game won't let one cut a counter or the till off, or come between a seat and its table.
- **The dividers are half-wall styles now.** The white half-wall comes free with half walls at level 9. The low brick wall, folding screen, velvet rope, hedge planter, standing mirror, ivy trellis and banner barrier are bought once at the **furniture store** (its new Half walls page), at their old levels. Any dividers you had in storage are already yours as styles. Dividers are no longer in the Buy menu.
- **Chef Rosa explains half walls** the first time you open the tab, and the level-up card lists them.
- **Half walls come in colours.** Pick a style and its swatches show (the paints you own). Two-tone ones have two rows, like the brick wall's bricks and coping. New pieces are built in the colour you picked, and dragging over walls already built repaints them for free.
- **The railings are half walls now.** All the patio railings are in Build > Half walls too, after the dividers: the plain wood one free from level 12, the others bought once at the furniture store. The Patio railings option in Build > Walls is gone (the side door's arrows are still there). Your patio's railing is now half walls along its back edge, in the same styles, and the railings you'd bought are yours as styles.
- **Half walls outside.** Build them on the grass, along a pavement's edge or the café's open front edges, like a garden fence. People walking past go round them, and they move out with the café when it grows.
- **Right-click a half wall for its colours**, the way the old dividers worked: the pop-up shows its swatches (both parts on two-tone ones), and each piece keeps its own colour. It works while you play and in Build.
- **Fake grass**, a new floor (Build > Floors, level 5, 15 coins a tile): bright artificial turf with mower stripes, for inside the café.
- **Customers always go round half walls.** Anyone already walking when you build a wall across their way now takes the way round, instead of walking through it. A customer who can't reach a counter or the till without crossing one doesn't come in, and sitting down at a table never slips through a wall.
- **Swatches for the stove, the milkshake and sushi counters and the milkshake machine.** Right-click one (or pick it in Build) for its colours, like the furniture: the stove's cream enamel takes the same paints as the lamps, the milkshake counters' mint panels and the milkshake machine's pink body have their own colours (red, rose, plum, blue, sky, teal, mint, emerald, sage, mustard, terracotta, charcoal, cream), and the sushi counters' pine takes the wood finishes. The fish in the sushi bar's glass keep their colours. While you're holding a dish from the cookbook, a right-click on a stove still puts the dish back.
- **The milkshake counter blends.** Starting a shake at the milkshake counter plays Cam's blender recording: a short spin-up and whir that winds down by itself after a couple of seconds, instead of the stove's sizzle.
- **The velvet rope in two colours.** Its rope and its posts each have their own row of swatches: the rope in red, black, navy, blue, purple, rose, teal, emerald, mustard, charcoal or cream, and the posts in brass, gold, silver, copper, bronze or a paint. It works in the Half walls drawer and when you right-click a piece.

## 1.0.179 — NeuroCafe's diary and happenings (7 November 2026)

- **The café diary.** A new round button, **Diary** (or press L), opens a book like the cookbook with everything that's happened at your café, newest first: every box from Aunty with her note and each gift, every NeuroVale cart (who drove it, what they paid, what they left), your level rewards, lucky dips and the Halloween feast. Pick an entry to see exactly what came and what went. Closed a pop-up too quickly? It's all written down here. The tabs down the side show everything, or just the deliveries and visitors, the happenings or the level rewards.
- **A red count on the Diary button** shows how many entries you haven't read yet. Opening the diary reads them, and the new ones keep a red dot until you open it again.
- **Happenings.** Every hour or two something happens at the café, good or bad, and goes in the diary (a note pops up as it does). 22 of them: a customer gets food poisoning and you pay their bills; the mayor makes a donation; a stove breaks down mid-dish (that dish goes in the bin) and the repair man wants his call-out fee; a pipe bursts; a football through the window; mice in the store room; a table runs off without paying; a power cut holds the cooking up ten minutes; crows dig up a plot; a fox gets the eggs; the health inspector fines a kitchen full of dirty stoves or rewards a clean one; a food critic's review or a coach party brings a crowd; a busker gets everyone tipping double; the supplier sends a spare order; a lost wallet's owner sends a reward; a wedding party or a film crew books the café; a big tip in the jar; a herbalist pays with a potion; the neighbour shares seeds; a spring shower ripens a plot. Amounts grow with your level, and a loss never takes more than a third of your coins. Away from the café, only the one that was due happens when you come back. **Settings > Happenings** turns them off.
- **The Fresh potion is for the farm now.** Use it on a plot whose crop has gone over and the crop is ripe again, with its full time to be picked.
- **Dishes on the counters never spoil.** Spoiling was already switched off; now it's gone completely, along with the bin and the sandbox's spoiling buttons.
- The sandbox's dev tools have **Happen now** (any happening, or the one you pick) and **Let the field go over** (for trying the Fresh potion).

## 1.0.178 — NeuroCafe sounds and jazz (3 November 2026)

- **NeuroCafe has sound effects.** They're Cam's own recordings from NeuroArcana: the victory fanfare when you level up, a soft, quiet click when you click in the menus (never on the café itself), and the Moonstones chime whenever coins come in (the till, vending and coin machines, tips, entertainment, home deliveries, selling). You also hear a soft set-down when you place, move or store things, or sow; a light snap when you turn something, start cooking or gather eggs and crops; a page turning when a book opens or you change its tab; the shop bell for Buy and the Furniture store; a shimmer when you use a potion; a parcel tearing open for Aunty's delivery; a fanfare when the café or patio grows; a sparkle for a new mastery star, a lucky dip or a finished cart order; and two soft knocks when something can't be done. Each move plays one sound, the most important one, so a serve that levels you up plays the level-up. **Settings > Sounds** turns them on or off and sets their volume on its own, apart from the music.
- **NeuroCafe's own sounds.** Cam's café recordings are in too, sitting quietly under the music: a sizzle when a dish goes on the stove, a scrub when you clean one and a fork on a plate when you serve a dish (which used to be the soft set-down).
- **Jazz on the café radio.** Cam's café jazz joins the lofi on the radio, and the jukebox now has a **Café lofi** and a **Café jazz** station that play just that one song, round and round.

## 1.0.177 — NeuroNet rests when it's tucked away, a health card, NeuroCafe's Graphics setting (3 November 2026)

- **NeuroNet rests while it's tucked away.** Hidden in its pop-up space or left on another workspace, NeuroNet now tells its page it's out of sight, so animations stop and timers slow right down until you bring it back. Music keeps playing.
- **NeuroNet's health** at the top of Settings → App stats: how much memory NeuroNet is using now (the page, NeuroNet itself, graphics, helpers), how long it has been running, a line of the day so far, and whether it's steady or climbing.
- **NeuroCafe: Settings → Graphics** (Full, Balanced or Light). Balanced, the default, keeps the café moving while it's the window you're using and lets it rest while you work in another one; customers still come and go. Light is calm all the time: nothing bobs or flickers, and the machines' glows are off.
- Behind the scenes: a memory-growth check joins the tests, and the last pieces only the desktop widgets used are gone.

## 1.0.176 — Lighter and steadier: the memory audit, and the desktop widgets retired (3 November 2026)

- **NeuroNet no longer creeps up in memory.** The top-bar clock was building a new date formatter every second, and the app's browser engine never gave that memory back -- about 160 MB an hour, even while NeuroNet was tucked away. The clock now makes its formatters once and only ticks the seconds while NeuroNet is in front.
- **Pages let go when you leave them.** The picture loader in the Music library and Photos, Training's tag filter, drag-select, Music's playlists panel and the visualizer (which now rests in silence) no longer leave pieces behind each time you visit.
- **The desktop widgets are gone** (Cam: "remove the widget functionality completely"): the desktop board, the photo frame, the NeuroNet logo on workspace 1, today's cards on the desktop and Edit desktop. Their own shell used about half a gigabyte on its own; updating switches it off and removes it. Super+Alt+W and Super+Alt+L are free again.
- **The bar widgets stay**: the launcher, music, quick note, game mode, the tarot / oracle / Lenormand readings and the dock work as before.
- **Settings → Desktop widgets is now Settings → Screensaver** (NeuroNet's name or Omarchy's, and Preview).

## 1.0.175 — NeuroArcana: accessibility and reading, deeper card books, a kinder Library, a sharper skirmish (2 November 2026)

- **Settings > Accessibility & reading**: page colours for the books (parchment, sepia, night, or high contrast -- black with white text), reading text size, line spacing, a plain easy-read font, the whole game's text size up to 160% (now working inside NeuroNet too), high contrast everywhere, colour-blind friendly colours, wider letter spacing, a clear keyboard outline, and the animations switch.
- **The Major and Minor Arcana books go deeper**: every Major now has its old Marseille name and Crowley and Lady Frieda Harris's Thoth card (Lust, Adjustment, Art, the Aeon...); every Minor its Golden Dawn title, its Thoth title and its decan; and every card its numerology and astrology, with a table of correspondences at the foot of the page. A new page on Rachel Pollack joins the tarot's history.
- **The Library no longer interrupts**: new pages show as a count on the Library's icon instead of a pop-up. Turning a book's pages from the contents no longer reopens the book, and the page number sits after the writing.
- **The Altar rewards training**: a trained card gives much more XP (a maxed card several times its worth), and a trained card that isn't in your spread can be given whole.
- **Skirmish sharpens with your streak**: every win in a row makes the next foe a little stronger and keener, up to a limit.
- **Art and clipping fixes**: the painted icons (boosters, Moonstones...) lose the dark squares behind them; long deck names fit on their boosters and long card names on their cards; the Library's deck covers sit inside their frames; the Gilded Observatory's box lost a strip of stray pink.

## 1.0.174 — NeuroArcana: the decks' own guidebooks, cheaper deck boosters (2 November 2026)

- **The decks' own guidebooks** on a new shelf in the Library: one book for every deck -- the six tarot decks, the four oracle decks and the Gilded Observatory -- in that deck's own guidebook words, with the card beside its meaning, upright and reversed. **A card's page is found only when the card is yours**, one at a time, so the oracle decks' books fill in later in the game, once their decks are open. Each book wears its deck's box as its cover.
- **A deck's own booster now costs 800 Moonstones** (it was 1,500) -- 200 more than a Starlight Booster, for five cards all from the deck you want. Finishing a whole tarot deck by boosters takes a steady player about ten weeks instead of four months.

## 1.0.173 — NeuroArcana: the Library (2 November 2026)

- **The Library** (a new entry in NeuroArcana's menu, once the starting tutorial is done): twelve books and 139 pages of lore, all found by playing. When you earn a page a pop-up says so; it waits, sealed, in the Library until you break the seal, then goes into its book. Books you haven't found are question marks on the shelf; a book opens like an illustrated guide, contents on the left and the page on the right.
- **The books**: the Seeker's Guide (the tutorial as a book); the Major Arcana (a guide page for every Major, one added for each keeper you beat -- the Fool comes with the tutorial); the Minor Arcana (56 pages, each card found a different way: winning with it, beating it, pulling it from a booster, drawing it as your card of the day, laying it in a reading...); the Field Guide (which element beats which, the grounds, every deck's harmony and Full Spread, Seals, hunts and fears, keeper temperaments -- drawn from the rules as they are); the Gilded Observatory (the story of the Observatory and why it was built); and histories of the tarot, Pamela Colman Smith, Lenormand and cartomancy, Jung and the hidden mind, John Dee, Crowley's Thoth deck, and divination. The history books arrive slowly, over weeks of play.
- **New art**: painted covers for every book, and a painted back for cards you've never met in the Archive.
- **Achievements** for reading pages and finishing books.
- **Start over and delete**: Saves now lets you start the save you're in over from the tutorial at any difficulty you've opened (the old save is kept aside in the game's folder, not destroyed), and delete the save you're in. Settings has "Forget the Library and the Archive" for a fresh run at finding everything.
- Hard keepers now play a level higher only (the extra Spirit is gone).

## 1.0.172 — NeuroArcana: three difficulty layers, the Archive, the Scouting Tent; Scribe: an Archive, ticks and flags (2 November 2026)

**NeuroArcana**
- **Three difficulty layers.** Easy is the cards; Normal adds Deck Harmony, Full Spreads, fields, Seals and the Underdog; Hard adds signature cards, leans, hunts and fears, the keepers' own spreads and keeper temperaments. Normal opens when you beat The World on Easy, Hard when you beat it on Normal (counted across all your saves). Your saves keep their difficulty. New Game+ lets you choose the next one, and a duel with a friend (hot-seat or Play Nearby) can be played at any layer you've opened.
- **The Archive.** The Cards page is now an album of every card in the game: cards you own in colour, cards you've seen greyed, cards you've never met as a question mark, with deck tabs, an All tab and a search. Clicking a card (or right-clicking one anywhere) slides its page in from the right; what it shows grows as you face, beat and own the card, and what you learn is kept across every save. The old card pop-up is gone.
- **The Scouting Tent** (a spyglass in the menu): every keeper you've met, the ones who beat you first, with their field, temperament, what they bring, every card you've seen them play, and your saved spreads to bring against them. Challenge goes straight into the battle now.
- **The tutorial in chapters**, rewritten as a conversation: Chapter I after the starting tutorial, and Chapters II and III the first time you play Normal and Hard. Skip any of them, and replay them from Settings > The Guidebook.
- **Dice and coins on the board**: painted coins and dice, which stay until you click. Ten Majors now toss or roll (Justice, the Hanged Man, the Chariot, the Tower, the Moon, Temperance, the Empress, Judgement, the Devil, the Sun). On Hard, Wonderland's Full Spread is Mushroom Growth (a die each round: 4-6 gives your card +3 Power).
- **Balance**, measured with the team's new bench: the Full Spreads evened out; the Journey, Trinity and the Heralds trimmed; five or more of a suit doubles its combo; Mirror and Gale Seals toned down; levels 3 and 5 give +1 Power too; the Magician, Emperor, Queen and Page stronger; the Wheel is Epic. The Underdog gives double XP but no extra Might, Hard keepers play a level higher, and Hard pays 0.8x with one mulligan.
- **New art**: deck sigils on signature cards, hunt/fear marks, the painted coin and dice, and the scouting tent.
- Less text everywhere -- whatever the tutorial teaches, the pages no longer repeat.

**Scribe**
- **Scribe > Archive**: archived Collaboration documents and notes in one place, with search, a preview and Put back. A Collaboration document has an Archive button; a note or folder has Archive in its right-click menu (it moves to a hidden folder in its vault).
- **Tick and flag notes**: right-click a note or folder for ✓ Tick (done) or ⚑ Flag for review; the mark shows beside it in the sidebar and follows it when it's renamed or moved.
- **Collaboration**: play-test checks have a "? Not sure" answer beside "Didn't try".

## 1.0.171 — NeuroArcana: Rematch (1 November 2026)

- **Rematch, right from the result screen**: after beating or losing to a keeper on the Fool's Journey or the Veiled Pilgrimage, or a Page on the Apprentice's Circuit, press **⚔ Rematch** (under Continue) to fight the same one again straight away -- an easy way to farm a keeper for XP and Moonstones. A won keeper pays its replay price.
- It shows whenever the road still lets you face them: after losing to a main keeper (the Chariot, Temperance, the World...) the road starts again, so there's no rematch then.
- After a Gauntlet win the same button reads **Face the next foe**.

## 1.0.170 — NeuroArcana: a clearer spread builder (1 November 2026)

- **Cards already in your spread are marked** in the collection with a gold "✦ In spread" tag and a gold edge.
- **The swap pop-up shows the cards large**: the card coming in on the left, your eight below "Which card makes way?" big enough to read, and the one under your pointer outlined in red before you click it.
- **Right-click any card for its details**: in the collection, your spread, the swap pop-up, the trade screen and other players' collections (battle cards worked this way already).

## 1.0.169 — NeuroArcana: low-level cards earn their place (1 November 2026)

- **The Underdog**: in every battle, a card meeting a higher-level card gets +1 Might for each level it's below, up to +2 (shown on the clash screen). If it wins its clash it gets twice the XP for that round, so fresh cards catch up faster.
- **The Apprentice's Circuit** (Battle page, under the roads): seven Pages, new every Monday, one of every suit and each on its suit's field. Your spread's levels may add up to 12 at most (the Pages keep to it too), so it's the place for your Lv1 cards. Each first win pays more than the last (60 to 150 Moonstones), a replay pays 15, and a loss costs nothing. Beating the seventh brings a Seal and a card from the deck you're nearest to completing. Two new achievements: beat the Circuit, and beat it with eight Lv1 cards.
- **Make a humble spread**: one press builds your best spread within the Circuit's limit; your old spread is saved as "Before the Circuit" so you can switch back on the Cards page.
- **Two new combos** in a new "Humble Cards" chapter of the Combo Book: **Beginner's Luck** (four or more Lv1 cards: +2 celestials) and **The Novice's Road** (all eight cards Lv1 or Lv2: +1 Harm to every card). Keepers can wake them too.
- With the Underdog, when two cards are level on Might and Harm, the lower-level card's +1 now usually decides it.

## 1.0.168 — NeuroArcana: multiplayer stats, and a duel nearby pays the winner (1 November 2026)

- **Winning a duel nearby pays 20 Moonstones.** The loser loses nothing, and both players' cards still gain XP.
- **A Multiplayer section on your Profile**: duels nearby played, won, lost and drawn, knockouts (yours and against you), Moonstones won, trades (cards in and out), duels on one computer, and a line for each opponent with your record against them, how many trades you've made and when you last played. Opponents are listed from your next duel or trade.
- Duels moved out of the main "by mode" table into the Multiplayer section, so nothing is listed twice.

## 1.0.167 — NeuroArcana: player levels (1 November 2026)

- **You have a level now**: a gold circle on the top right of your picture shows it (in the sidebar, at the top, on your Profile and beside you in battle). Your Profile shows how close the next level is.
- **Every battle counts**: a win gives the most, a knockout a little more, and even a loss or a draw gives some. The Fool's Journey, the Veiled Pilgrimage and the Daily Trial count most; Gauntlet, Play for Keeps and duels nearby a little more than a skirmish; an easy skirmish less, a hard one more.
- **Each level brings Moonstones and one random card**, drawn like a booster's card, shown on the result screen.
- Your save starts at the level its past battles have earned (without paying out those earlier levels). Your level carries into New Game+, and in duels nearby you see each other's.

## 1.0.166 — NeuroArcana: card frames are optional (1 November 2026)

- **The painted frames around the cards are now off**: cards show their art larger, with a thin edge in their rarity's colour. To bring the frames back, open Settings (the sun button at the top right) and tick **Card frames**. It's saved with each save.

## 1.0.165 — NeuroArcana: knockout bonus, XP in duels nearby, a clearer trade screen, see each other's collections (1 November 2026)

- **Knockouts pay more**: win by emptying your opponent's Spirit (not on points) and you get +25% Moonstones, and every card that won its clash gets +1 XP.
- **Duels nearby now teach your cards**: every card you played gets 3 XP for a win, 2 for a draw and 1 for a loss, plus 1 more for a knockout. Each player's own cards gain on their own computer. Still no cards or Moonstones change hands. (Only duels with another player; battles against the game are unchanged.)
- **A clearer trade screen**: bigger cards, each with its name, deck, rarity and level, and what you'd have after the trade ("New to you", "you have 1", "your last copy"). Search by name or deck, filter by deck or rarity, or show only your spares.
- **See each other's collections**: on Play Nearby (and from the trade screen) press **Their collection** to see their record (battles, wins, streaks, duels nearby, cards owned, the roads), their spread, the cards they play most and every card they have. Tick "Only cards I don't have" to find what to ask for. Moonstones stay private.
- The Profile page's "Cards owned" now shows the right total.

## 1.0.164 — NeuroArcana: play nearby, trade cards and duel over the home network (1 November 2026)

- **Play Nearby** (Battle page): two computers on the same home network (the same router) can now trade cards and duel each other. One presses **Host**, the other presses **Find games** (or types the host's address) and joins.
- **Trading**: you each put up to 12 cards on the table. Lock your offer when you're happy; when both are locked, both confirm and the cards change hands on both computers. A Free (sandbox) save can only trade with another Free save.
- **Duels**: a friendly match with your own spreads. Each of you picks your card and celestials on your own screen; the round plays out when you've both chosen, and each of you sees the battle from your own side. Nothing is won or lost.
- Nothing leaves your home network. Only the **hosting** computer needs to let the game in, once: `sudo ufw allow from 192.168.0.0/16 to any port 47432 proto tcp comment 'NeuroArcana'` (Play Nearby shows this too). The computer that joins needs nothing.

## 1.0.163 — NeuroArcana comes to every NeuroNet computer (1 November 2026)

- **NeuroArcana, the tarot card battle game, is now part of NeuroNet**: open it with **Super+Alt+Y** or from the app launcher. Collect cards from ten tarot and oracle decks plus the game's own Gilded Observatory Tarot, build a spread of eight, and duel the keepers along the Fool's Journey and the Veiled Pilgrimage. Fields, Seals, Full Spreads, New Game+, several saves with Free, Easy, Normal or Hard difficulty, achievements, readings and a two-player duel are all there.
- Its saves live in `~/.local/share/NeuroArcana`, the same place as the game's own app, so a save carries between them.
- On the computer where NeuroArcana is made (its developer copy in `~/Work/NeuroArcana`), Super+Alt+Y keeps opening that copy.

## 1.0.162 — NeuroCafe: Halloween's farewell, the haunted house opens to the public, bigger cafés sooner, plays in a narrow window (1 November 2026)

- **Halloween's farewell**: when Halloween ends, the tarot reader draws the Death card and says goodbye till next October. Any candy you have left is baked into Halloween dishes, one serving for every candy, split between the Halloween dishes you unlocked in uneven lots (say 546 toffee apples, 450 spider cupcakes, 120 graveyard brownies…). They go out on your counters, or wait in the bag until there's room. The candy is gone after that.
- **The haunted house opens to the public**: outside Halloween, clicking the haunted house no longer shows a closed shop. For 650,000 coins you can open it to the public. Every night from 9 pm to 6 am visitors come in off the street, through your cobweb arch if it's near, walk up to the house and disappear inside, paying 20 coins each (about 1,620 visitors and 32,400 coins a night). It earns while you're away too. During Halloween it's the candy store, as before. The other event houses will get the same treatment later.
- **Bigger cafés sooner**: a new expansion every 2 levels to 10×10 at level 12 (was 25), 13×13 at level 22, then one every 4 levels or so to 30×30 at level 100. They're cheaper too: 600 coins for 5×5, 16,000 for 10×10, then 20% more each size (30×30 costs about 610,000, was about 1.4 million).
- **A narrow, tall window works**: the café window can now be made as small as 360 × 480. In a narrow window the top bar keeps your coins and candy in view (the café's name and the rush tag make room; the clock still says the rush), the clock moves clear of the menu buttons, and every book (the cookbook, Buy's catalogue, the Bag, Upgrades, the events book, the frame builder) shows both its pages at once, one above the other and each scrolling on its own, so the Cook / Buy / Unlock button is always on screen. The book's tabs sit in a row along the top that scrolls sideways, so none are cut off.
- **Super+Alt+Y no longer opens NeuroFarm** (NeuroFarm is moving into NeuroCafe); the key now belongs to NeuroArcana on computers that have it.

## 1.0.161 — NeuroCafe: Halloween runs 10 to 31 October (1 November 2026)

- **Halloween's dates**: the event now runs from 10 to 31 October (it was 1 October to 10 November). Candy, the haunted house and its unlocks all follow the same dates, so it's over for this year. Leftover candy keeps till next October, and everything you unlocked stays yours.

## 1.0.160 — NeuroCafe: Halloween furniture and Haunted Faves (27 October 2026)

- **Halloween furniture**: 13 new things to unlock with candy at the haunted house: a jack-o'-lantern table, a cobweb bistro table, a slimy table, a skull coffee table, a cobweb chair, a skull chair (turns four ways), a pumpkin armchair (four ways, bigger tips), a bat bar stool, a twisted stool, a spooky potted tree, a jack-o'-lantern lamp that lights the room at night, a haunted bookcase and a dead-tree coat stand.
- **Haunted Faves**: through Halloween, 16 dishes look spooky while cooking, served and burnt: the soups, potatoes, omelettes, pies, cheese board, fish, crab cakes, salmon and lobster. They go back to normal after Halloween.
- Every stool now uses the perched stool poses, and any chair turns four ways once both of its back pictures exist.

## 1.0.159 — NeuroCafe: tidy cooking times (26 October 2026)

- **Cooking and growing times read cleanly**: the cookbook said a mint choc chip shake took "3.3333333333333335 min"; times now show one decimal place at most (3.3 min, 1.5 h, 4 min).

## 1.0.158 — NeuroCafe: event frames for your own photos, night from 8 pm, safety checks (26 October 2026)

- **Event frames hold your photos**: once you've unlocked a frame from an event (the Halloween tarot frames so far), it's also in the furniture store's **Photo frames**, on its own tab down the **right-hand side** of the book with the event's icon. Pick one of your photos and hang it like any photo frame. A tarot frame with your photo in it shows the photo; right-click it and pick a card to put a card back.
- **Night comes at 8 pm** (it was 9).
- **Safer for shipping**: picture names read from a save can only be letters, numbers and dashes; the café camera only takes a few real corners; and a save damaged so it's nested thousands deep now falls back to the copy from before, instead of failing to load.

## 1.0.157 — NeuroCafe: a much lighter café to draw (26 October 2026)

- **Faster, especially big cafés**: the little bob-and-sway clock that makes bubbles bounce and people sway used to make the whole painted ground be redrawn four times a second. Now only the things that move are redrawn. A packed 30×30 café during a rush went from about 12 to about 43 frames a second on a computer drawing without a graphics card, and the main café uses less of the computer too. Everything still bobs and sways as before.
- **The water is still** (no more ripple), and **the hens stand idle** instead of pecking -- both were a large share of the drawing.

## 1.0.156 — NeuroCafe: sowing like the cookbook, plain milkshake and sushi counters, the bars as prep counters (26 October 2026)

- **Seeds stay in your hand**: sow a crop from Giles's book and you keep holding it, the way a recipe stays held from the cookbook. Click more empty plots to sow each one, or hold the button down and drag across the field to sow them all in one go (dragging over ripe plots picks them). Press Esc to put the seed down and open Giles's book again on it; the little cross on the "holding" card at the bottom puts it away.
- **A plain milkshake counter** (Buy > Kitchen > Milkshakes & sushi, from level 9): the milkshake counter's look with a bare top, with room for three different milkshakes side by side. Click it to see what's on it.
- **The milkshake counter is now a prep counter**, like a stove: it makes the shakes, and clicking a ready one serves it out -- onto a plain milkshake counter first (beside the same shake, or into a free place), then onto your other counters like any dish. Nothing is sold from its own top any more; shakes that were on it go out to your counters by themselves.
- **The sushi bar works the same way**: it's a prep counter now too, and its sushi goes out onto the new **plain sushi counter** (Buy > Kitchen > Milkshakes & sushi, from level 22) -- the sushi bar's look, its case of fish and lucky cat kept, with the plates and mats cleared off so three kinds of sushi sit along its front ledge. Sushi never goes on a plain milkshake counter, nor shakes on a sushi one; when they're full, it goes on your other counters like any dish.

## 1.0.155 — NeuroCafe: surprises -- question marks till things are yours, and the NeuroVale collection (25 October 2026)

- **What you haven't unlocked is a question mark**: in the cookbook (every tab and every cooker's own book) a recipe you haven't reached shows a question mark and the level it opens at, and its page keeps it a surprise. The same goes for Giles's seed book, and for everything in the Buy and Build catalogues: a locked card shows a question mark and "???", with the level it comes at.
- **The Halloween catalogue is full of surprises**: at the haunted house, everything you haven't unlocked is a question mark with its candy price. Unlock one and it turns over to show what it is, in colour. The Bag's Halloween collection shows them the same way.
- **The NeuroVale collection** (Bag > Collectibles > NeuroVale): all 52 mounted weapons and NeuroVale's keepsakes, question marks till you have them. The weapons are no longer bought from a list: fill a NeuroVale cart's order and the tutor may leave you one (about a third of the carts that don't bring a keepsake), with one in storage. Once you've won it, it's in Buy > Decor > Wall weapons to buy more of. (The sandbox still has them all.)

## 1.0.154 — NeuroCafe: shakes the right size, floor sitters a little bigger, quieter carts (25 October 2026)

- **Milkshakes are the right size**: on the milkshake counter, in customers' hands and on the tables, a shake was drawn about twice as tall as a plate. Tall glasses (shakes, iced coffee) are now drawn narrower, so they stand about as tall as a plate.
- **People sitting on the floor are a little bigger**: on cushions and at the readers' tables they were shrunk too much.
- **Collecting from a cart shows no message**: the coins float up from the cart itself instead of a message at the top.
- **Aunty's secret recipes still to come show a question mark** in the Bag's Collectibles, not the dish.

## 1.0.153 — NeuroCafe: the Bag is a book, a pantry cupboard, Aunty's box on the street, 6-hour dishes, lighter water (25 October 2026)

- **The Bag is a book** like the cookbook, with tabs down the left: **Potions** (pick one to read what it does and use it), **Items** (food from Aunty waiting for a counter, seed packets, and more later) and **Collectibles** (Aunty's secret recipes, with the ones still to come hidden, and everything from Halloween, yours or still to unlock).
- **Storage is in Build** (Build > Storage): everything you've stored, to put out again or sell.
- **The pantry is a cupboard** you place in the café. Click it to see your harvest and eggs, and which dishes each one goes in. Every café has one waiting in Build > Storage. It has a stand-in picture for now (the art prompt is N64), and takes swatches like the other furniture.
- **Aunty's box is on the street**: the Aunty button has gone. When her box arrives it sits on the pavement by the café's front corner. Click it to open it.
- **6-hour dishes**: the cabbage soup, porridge, hog roast and thyme-roast pork now take 6 hours instead of 8.
- **Water costs much less to draw**: its ripple swaps between its two frames every 1.5 seconds instead of fading, which redrew the ground on every frame. With a big lake the café now does about a fifth of the drawing it did while idle.

## 1.0.152 — NeuroCafe: zooming out no longer flashes, and wall lights stay inside (25 October 2026)

- **Zooming out is steady**: zooming used to flash the daytime ground through the night, or blank patches, and stretch the map for a moment. The map is no longer drawn as one big picture that gets thrown away and redrawn after every zoom, so the night stays put. Panning costs a little more work, but stays smooth.
- **Wall lights stay inside**: a wall light near the end of a wall glowed out over the pavement past the corner. Its glow now stops at the café's walls.

## 1.0.151 — NeuroCafe: the menu in the top left, books that don't flash, and garden things without their grass (25 October 2026)

- **The menu is in the top left**: Buy, Build, Farm, Upgrades, Cookbook, Bag, Aunty and Settings are see-through round buttons down the top-left corner, like the eye at the top right, instead of tabs along the bottom. Hover one to see its name; the one that's open is lit, and the Bag, Farm and Aunty still show their counts. The Buy and Build panels still open along the bottom.
- **Books and pop-ups don't flash when you click in them**: clicking a recipe in the cookbook (or anything in the catalogues, Upgrades, the seed book, the Bag and the rest) used to make the whole book pop in again. Now only what changed changes.
- **The garden things stand on your ground**: the ponds, fountain, bird bath, wishing well, bridge, gazebo, pergola, rose arch, sundial, gnome, angel statue, bird house and stone lantern no longer have a patch of painted grass under them, so they sit on whatever ground is there.

## 1.0.150 — NeuroCafe: carts can be clicked (25 October 2026)

- **Clicking a cart or the cinema works**: clicking one outside Build mode did nothing, so its coins couldn't be collected. Now a click takes its coins, or restocks it when it's run dry.

## 1.0.149 — NeuroCafe: carts say what they're doing, and people walk round water (25 October 2026)

- **Carts and the cinema always show what they're doing**: a label above each says **Selling…**, when it opens (for example **Opens 6 am**), its coins, or the red sign when it needs restocking. The cinema shows **Films 7, 9, 11 pm** or **Film on**. Hover a cart for its hours and what it earns. (A cart's first coins come after 5 minutes of selling, and the coffee cart sells from 6 am to 6 pm.)
- **People walk round water**: lake and deep water painted in Build > Terrain is walked round like a pond. A garden bridge laid over it is the way across.

## 1.0.148 — NeuroCafe: Farmer Giles's seeds are a book (25 October 2026)

- **The seeds are a book now**, like the cookbook, the catalogues and Upgrades. Click an empty plot and Farmer Giles's seed book opens. Tabs down the left are for vegetables, fruit and grain. The crops are pictures on the left page, with Giles under them, and a green dot shows the ones you can sow now. Pick one to see it on the right page: how long it grows, what a plot costs and gives, its XP, how long you have to pick it, how many you have in the pantry and which dishes it's for. Then **Sow**, or double-click a crop to sow it straight away.

## 1.0.147 — NeuroCafe: refills, carts and an outdoor cinema, milkshakes and sushi, a garden, and water to dig (25 October 2026)

- **Patio railings line up with the patio's edge**: every painted railing now stands along the pavement edge and ends at the patio's corner, instead of floating off it or running onto the grass.
- **Make things bigger**: in Build, press **=** to make something a size bigger and **−** to make it smaller again. Plants (outside and the potted ones) go up to four sizes bigger; every other street thing and indoor thing goes up to three, from trees and lamps to jukeboxes and stoves. Chairs, tables, counters, benches, room dividers, fences and buildings stay one size. It works while you're placing a thing, moving it or have it picked, and there are Smaller and Bigger buttons too. A bigger thing outside takes more room, and people walk round it; inside, it keeps its one tile.
- **The rocking chair and doll** start a size smaller.
- **The map ends where you can build**: the ground used to run on past the edge you could build to, so zoomed out you could see ground but not build on it ("That's too far out").
- **Growing the café or the patio pushes things out with it**: everything outside past its front edges moves out by as much as it grew, including street things, tiles laid outside, painted ground and plots. Your garden keeps its shape, and nothing goes into storage.
- **The cobwebs have no magenta left on them**: the wall webs, the giant web, the cobweb tree and the cobwebbed lamp post are clean grey silk.
- **The ceiling lights have no magenta left on them**: their glass is clear and the pink glow round them is gone.
- **The farmhouse has its bottom back**: its front corner was cut off.
- **The round low table's top is whole**: two notches were cut out of it. The pouf is cleaner too.
- **The floor cushion takes swatches all over**: its shaded sides kept their ochre colour before.
- **A double buffet against the patio's brick wall** stays behind the wall now, instead of poking through it. A buffet can't be put across the wall (half in the café, half on the patio) any more, and one already placed that way is turned to run along the wall.
- **House orders see what's on your counters straight away**: a serving that a customer who'd just come in had already claimed didn't count until they picked it up. Now everything on the counters counts. A delivery takes the unclaimed servings first, and a customer whose serving went in a delivery leaves without it. The request cart counts the same way.
- **Upgrades is a book now**, like the cookbook and the catalogues: tabs down the left for stoves, outdoor cooking and counters, your pieces on the left page (a tick when everything is fitted, a green dot when you can fit something), and the one you pick with its upgrades on the right. It stays inside the screen however small the window is.
- **A recipe stays in your hand**: cook something from the cookbook and it stays picked. Click more free stoves, or drag across them, to cook the same dish on each one without opening the book again. A card at the bottom shows what you're holding. Press **Esc** to put it down and go back to the book on that recipe, where **Cook it on your stoves** picks a recipe up without choosing a stove first. Build mode or a potion puts it down too.

- **Everything that takes coins needs refilling** (V26): vending machines, coin machines, games and the readers' tables run for 3 hours of opening (a closed café doesn't use them up), then show a red refill sign and take nothing more. Click one to refill it: its coins come out to you, less 20% for the refill (at least 5 coins; with fewer than 25 in it, the 5 comes from your purse). Vending machines now fill by the clock only while you're open.
- **Carts** (Buy > Outside > Stalls): a coffee cart (level 10, 3,000), an ice cream cart (level 14, 4,500) and a popcorn cart (level 16, 2,500) stand anywhere outside and sell on their own in their hours: coffee 6 am to 6 pm (busiest 7 to 10), ice cream 10 am to 8 pm (busiest on summer afternoons), popcorn 4 pm to midnight. Their coins wait in them, up to 400. A cart shows closed outside its hours or when it needs restocking. You can have one of each, and another every 15 levels.
- **The outdoor cinema** (level 28, 12,000): it shows a film at 7, 9 and 11 pm, and its screen lights up after dark. Each film brings 4 coins for every place to sit within 4 tiles (a bench seats 2, a picnic table 4, up to 12), and 2 more a place with a popcorn cart or machine nearby. A reel lasts three films.
- **New machines**: a milkshake machine (level 8, sells for 5), an energy drink machine (level 12; people come for it more often, and it sells for half again after dark) and a popcorn machine (level 16, a bag for 3).
- **The milkshake counter and the sushi bar** (Buy > Kitchen > Milkshakes & sushi; levels 9 and 22): each is a stove and a counter in one. Make a dish from its own book (8 shakes ready in 1 to 4 minutes, 8 sushi dishes in 5 to 20 minutes), then click it to put the dish on its own top. It never burns and never needs cleaning.
- **The espresso machine** (Upgrades, for a serving counter; level 7, 1,500): whenever the counter's top is empty, it brews 6 coffees onto it (one of 8), at most every 15 minutes. Its beans last 3 hours of opening.
- **The Head cashier** (Upgrades > Cash register; level 40, 250,000): every 10 minutes it brings the coins from your carts, the cinema and the popcorn machines into the till. It never refills them.
- **The garden** (Buy > Outside > Garden): four ponds, a fountain, a bird bath, a wishing well, a garden bridge, a gazebo, a pergola, a rose arch, a sundial, a gnome, an angel statue, a bird house and a stone lantern. They all come in sizes (= and −). People walk round the ponds, and over the bridge and through the arch.
- **Water, a shovel and a level** (Build > Terrain): paint lake water (level 3) and deep water (level 6), which ripple. The **shovel** digs the ground lower, with a shaded bank round it, so water painted in the hollow makes a lake. The **level** fills dug ground (and the water in it) back in.
- **Buy > Decor > Event**: every event decoration and painting you've unlocked is here now, instead of a separate Events tab. Unlocked event games (the fortune teller, the claw machine and the rest) are in Fun with the other machines. Outside has an Event category too.

## 1.0.146 — NeuroCafe: outdoor cooking on the patio, and people walk round houses (25 October 2026)

- **Outdoor cooking** (Buy > Kitchen > Outdoor cooking): five appliances that go only on the patio. They are the barbecue grill (level 12), pizza oven (18), tandoor (24), rotisserie spit (30) and smoker (40). Each works like a stove: cook, serve onto a counter, then clean it. Each cooks only its own dishes. You can have one of each, and one more every ten levels after it opens. The self-cleaning upgrade fits them too.
- **Their cookbooks**: each appliance has its own book of eight dishes, 40 in all. Each book is a tab in the cookbook with the appliance's picture on it. Click an appliance and the cookbook opens on its book. A stove can't cook outdoor dishes, and an appliance can't cook the café's dishes; the cookbook tells you which one cooks a dish. Delivery orders, the request cart and Aunty's food gifts only ask for outdoor dishes once you have the appliance. The pictures are placeholders until the painted sheets arrive.
- **People walk round houses**: anyone walking along the street goes round a house, fence or tree standing in their way (for example a house placed on the pavement with free placement), instead of walking through it. A person in front of a house is drawn over it, and a person behind it is hidden by it.
- **New painted art**: the five outdoor appliances and all forty of their dishes (cooking, served and burnt), the patio's railings and floors, and the garden's rocks, plants and trees. The six homes are painted too, and each house's footprint now matches its painting, so people walk round the house itself.
- **Two more patio railings**: bamboo (level 22), and a black iron railing with pumpkins on its posts, unlocked with Halloween candy at the haunted house.
- **Halloween's candy store**: once everything in the Halloween catalogue is yours, a Candy store page opens in the haunted house's book. It sells dear potions for candy: Golden tips (every tip doubled for an hour), a Crowd potion (twice the customers for 15 minutes), a Chef's potion (everything cooking is ready now) and a Mastery potion (every dish cooking counts twice towards its stars). It also has a Lucky dip and the everyday potions.
- **Eating on the floor**: low tables, floor cushions and a pouf (Buy > Dining > Low tables & cushions). Customers sit cross-legged at them, and a cushion only seats someone at a low table. Halloween has its own low table and bat cushion.
- **Readings**: a fortune teller's table and a tarot reader's table, each with its reader. Customers come in, sit on the floor for a reading and pay 15 or 20 coins.
- **Tarot frames**: right-click one to choose which Major Arcana card it shows, taken from your own decks in NeuroNet's card library. The card pictures stay on your computer and are never copied into the game. There are also cobwebs and a broom for the walls, and 16 new Halloween things for the town.
- **Halloween guests**: Dracula, Frankenstein's monster, the Witch and Pumpkinhead, unlocked with candy. From then on they visit at dusk and after dark all year round, and pay 3 coins more.
- **The dirty smoker** now faces the same way as the clean one.
- **New painted art**: the ceiling lights; low tables, cushions, the pouf and the two readers; the four Halloween guests (standing, sitting, cross-legged on the floor and on stools); everyone sitting cross-legged; 16 Halloween town things, cobwebs, a broom and the tarot frames.
- **More floors, wallpapers and railings**: 16 café floors, 16 patio floors, 8 wallpapers and 8 patio railings.
- **Painted at last**: the wall lights and light switch, richly detailed clocks, the dartboard, mirror and teacup shelf, the potted lavender, wildflowers and ferns, and the Witch and Pumpkinhead walking away.
- **Wall lights show whether they're on**: a click switches one off or on, as before, but now you can see it at any time of day. Off is dimmed and grey and on has a soft glow, and a short message says which.
- **The fortune teller's and tarot reader's tables** are a little smaller, so the readers are the size of the café's customers.
- **The pouf and the round low table are whole**: their tops were cut off. The pouf's swatches now cover it evenly too.
- **The fog machine** is smaller and puts out a bank of purple mist.
- **Little lights**: the turnip lanterns, skull candles, pumpkin patch and cobwebbed lamp post glow after dark, and the Halloween low table's candle lights the room.
- **Tarot frames stand tall** like the cards, and the furniture store's frame builder has four portrait photo frames too.
- **Night covers the whole map**: part of the far ground used to stay in daylight.
- **Potted lavender, wildflowers and wild ferns** for indoors (Buy > Decor > Plants), with swatches on their pots.
- **Swatches now work** on the floor cushions, the pouf and the low tables.
- **NeuroCafe runs much lighter**: moving and zooming the view no longer redraws the whole café at every step, so the GPU spikes are gone (drawing while dragging went from about three CPU cores' worth to a few percent). The game stops redrawing when nothing changes (it was redrawing about 60 times a second because of the jukebox's glow), and stops drawing altogether while it's tucked away. No memory leaks were found. The full report is in Collaboration (N59).
- **The Buy and Build menus are always one size**: they span the screen and are always as tall as the tallest tab, whatever is in them, so they no longer grow or shrink as you change tabs.
- **The patio's railing runs only along the pavement side**, like the café's own walls, which are only at the back. The front and far side are open, so the railing never shows through or cuts across tables and chairs at the patio's edge. Railing styles and laying them a panel at a time work as before, on that side.

## 1.0.145 — NeuroCafe: the patio, Build > Select, a long table and counters that join up (25 October 2026)

- **Long table** (Buy > Tables, level 5, 260 coins): the square table made a tile longer, so it covers two tiles. It turns two ways, and a chair at either half is a seat at it, so four to six people can eat at one table.
- **Counters join up**: serving counters and buffet counters put side by side in a row, facing the same way, now join into one long counter with no gaps. That works with any paint or counter style. The dishes stay on their own counters, as before. Counters at a corner, facing different ways, stay separate.
- **Just look**: a see-through eye at the top right of the screen hides the game's details: dish counts, the fridge badges under the servery, money and candy bubbles, timers, the top bar and the buttons. That leaves just the café to look at. Press it again to bring everything back.
- **Photos of your café**: while you're looking, a little camera appears under the eye. Press it to take a photo of the inside of your café, whatever part of the street you've scrolled to. The street and the people outside aren't in it. Photos are saved as pictures in Pictures/NeuroCafe.
- **The patio** (Build > Expansions, level 12, 6,000 coins): an outdoor eating area along the café's front-right side, 3 tiles deep, with a side door into the café and a railing round it. Anything that goes inside can go out there. Customers order inside, then walk out through the side door to a patio seat, and patio tables tip a coin more by day. It grows with the café (everything on it moves out with the café's edge) and gets deeper with its own expansions: 4 tiles at level 18, 5 at 24, 6 at 30. Street things in its way go into storage.
  - **A low brick wall** between the café and the patio (the low brick wall divider), so it doesn't block the view, running on as one wall along the ground, its near end behind the railing, with an open doorway: a wooden door frame set into the bricks. Right-click it for its swatches: the bricks and the coping take paints, like the low brick wall. People sitting just inside stay behind it. A chair on the patio can't sit at a table inside through the wall (it could at first).
  - Things on the patio are always drawn over its railings, so a railing never cuts through a piano or a bookshelf in a corner.
  - **Railings**, like wallpaper (Build > Walls > Patio railings): plain wood, white picket, black wrought iron, glass panels, rope and posts and a low hedge planter, bought once and laid all round or a panel at a time. The side door moves along the café's edge with the arrows there.
  - **Outdoor floors** for it (Build > Floors): decking, flagstones, brick paving and patio gravel. The café's floors go there too.
  - (The railings and floors are stand-in drawings until they're painted. The outdoor cooking appliances and their cookbooks come next.)
- **Build > Select**: drag a box over the ground outside to select everything in it: street things, fences, farm things, buildings, plots, outdoor floor tiles and the painted ground. The menu says what's selected. Then:
  - **Move**: drag the selection and everything comes along: plots with their crops, the coop with its hens, the painted ground. While you drag you see it where it would go, and the box turns red where it can't (on the road, the pavement's middle, or the café).
  - **Duplicate**: drag a copy to where it goes. It costs what buying it all would, and it asks first. One-of-a-kind things, and plots past what your level allows, aren't copied; it tells you which.
  - **Delete**: asks first. Street things go into storage, plots are filled in (half their price back), and the ground goes back to grass.
  - Undo works for all three. Esc or Clear lets go of the box.
- **People walk round things outside**: fences, hay bales, flower planters, street lamps, bike racks, trees, buildings and the rest are solid now. Anyone walking to a bench, a picnic table or a home's door goes round them, or through a gap you leave. A seat fenced in all round is left empty. Tables, benches, archways, bushes and things flat on the ground (stepping stones, pebbles, wildflowers, tall grass, ferns, mushrooms) can still be walked through.
- **Duplicating shows its price**: while you drag a copy, its price is on it, and placing it always asks first, with the price (or that it's free).
- The Build and Buy menus are at least as wide as the tab bar above them.
- **Fix: counters in a row lined up badly** when some faced one way and some the other: a joined row now always uses the same painting.
- **Fix: chairs at a two-tile table**: a chair facing the far half of a two-tile table didn't count as a seat.

## 1.0.144 — NeuroCafe: every book like the cookbook (25 October 2026)

- **The furniture catalogue and the Events book match the cookbook**: tabs with just an icon run down the book's left edge, one for each section or event. The left page shows that section's things as pictures, and clicking one shows everything about it on the right: its paints and counter styles to buy, or how to unlock, buy, hang or place it. The contents page and the page-turning arrows are gone; the tabs do that job.
- **Fix: NeuroVale's cart order**: the dish rows (name, how many loaded, the Load button) slipped out of the order window and sat over its left edge. They're back inside it, between the visitor and what the order pays.

## 1.0.143 — NeuroCafe: world building -- painted ground, free placement, gardens, homes and deliveries (24 October 2026)

- **Paint the ground**: Build > Terrain has ten grounds: dirt, garden soil, gravel, sand, rocky ground, bark mulch, moss, mud, paving stones and cobbles. Pick one and a brush size, then drag across the ground outside. It isn't tied to the grid, and the edges blend softly into the grass like in the Sims. Grass rubs it out, and it's free. Paving stones and cobbles let you lay your own streets and paths.
- **Free placement**: a "Free placement" switch on the Outside, Farm and Buildings menus works like the Sims' move-objects cheat. Things go exactly where you click, off the grid, and can overlap each other for layered gardens. They still can't go inside the café. The game remembers the setting.
- **Garden beds**: flower beds, bushes, rocks, plants, lamps and every other small thing outside can now sit right up against each other or overlap, with or without free placement. Only buildings keep their room. Free placement is on by default; switch it off to snap things to the quarter-tile grid.
- **A garden to build**: Outside now has categories (Street, Rocks, Trees, Plants) with lots of new things to place:
  - **Rocks**: pebbles, small rocks, flat stones, round rocks, mossy rocks, a rock pile, a standing stone, a boulder and stepping stones.
  - **Trees**: a stump, a fallen log, two dead trees, a pine, an apple tree, a cherry blossom, an autumn maple, a weeping willow and a cypress.
  - **Plants**: wild ferns, tall grass, wildflowers, lavender and mushrooms.
- **Homes for your street**: Build > Buildings has six homes: a cottage, a bungalow, a terraced house, a townhouse, a stone farmhouse and a corner shop.
- **Deliveries**: every home asks for food. A bubble over the house shows the dish and how many servings, and it glows green when you have enough out. Click it to deliver: the servings come off your counters, you're paid one and a half times their price plus XP, and someone from the café walks it round to their door. Each home asks again 10 to 60 minutes after an order is filled, up to 10 orders a day.
- **Fix: picnic tables**: people sat on the wrong side of the table, past its ends. Now two sit on each bench, facing each other across the table.
- **Fix: park benches**: people on a bench turned away from you now sit behind its backrest, and everyone sits on the seat rather than beside it.
- **Fix: food left on the ground**: people eating outside hold their plate on their lap on a bench, or put it on the picnic table, instead of it floating by a lamp post.
- (The ground textures, rocks, trees, plants and homes are stand-in drawings until they're painted.)

## 1.0.142 — NeuroCafe: a new cookbook, menu tabs, customer rules, benches and glows (24 October 2026)

- **Ceiling lights**: the light fittings are now 99% see-through all the time, so you'll barely see them. Their light is what shows: a warm glow and a pool of light on the floor whenever they're switched on, by day as well as at night. The switch by the door still turns them all off and on.
- Their light falls on the floor of the café, a soft pool under each one, rather than glowing in mid-air.
- While you're putting one up or moving it, its pool of light shows where it is: green where it would go, blue for the one you've picked.
- **Windows at night**: in the evening and at night every window shows a dark night sky with a few stars, and the trees outside become dark shapes. Curtains and blinds work the same, since each comes with its window. By day they look as before.
- **More glowing machines**: pinball, the Time Crisis light-gun game, skee-ball, basketball, karaoke, air hockey, whack-a-mole, the claw machine, the fortune teller and the haunted house game each glow in their own colour. The dance machine cycles through the rainbow like the jukebox. At night every machine's glow lights the floor round it.
- **Customers sit at the table**: a customer who can reach a table now takes any free seat at it, sliding into the chair. Before, a chair hemmed in by the table and other chairs was never used.
- **A new cookbook**: it's now a book. A tab for each menu sticks out of its left edge with that menu's picture, so the Halloween tab no longer runs off the screen. The left page shows every dish of the menu as a picture: locked ones greyed with their level, a star row on ones you've mastered. Click a dish to see everything about it on the right page: time, cost, XP, takings, ingredients and mastery, with a Cook button when you came from a stove. Double-click a dish to cook it straight away.
- **The cookbook stays one size**: every menu tab opens the book at the same size. A long menu scrolls inside its page.
- **Menu tabs along the bottom**: the round buttons are gone. A row of tabs sits along the bottom of the screen: Cookbook, Build, Buy, Bag, Upgrades, Farm, Aunty and Settings. Point at one and it rises to show its picture; click it to open. The open one stays raised, and while Build or Buy is open the tabs sit on top of it. The keyboard shortcuts work as before.
- **New customer rules**: there's no longer a cap of 15 customers a minute. Instead, every part of what draws them rises more slowly the more you have, so the first few of anything count most:
  - **Variety**: different dishes out.
  - **Stock**: full counters.
  - **Food quality** (new): the mastery stars of the dishes out.
  - **Comfort** (new): every seat by its comfort. A stool counts 1, a chair 2, an armchair 4, a sofa 3.5 a place.
  - **Looks**: decorations, things outside, wallpaper, floors and counter styles.
  - **Entertainment**: the machines. A second of the same kind counts half.
  - **Lighting** (new): after dark, a café with too few lights on loses customers (up to 1.5 a minute), and a well-lit one gains one. About one light for every ten floor tiles is right.
  - Food in a counter's fridge doesn't count, only what's out.
  - You always get at least 3 a minute while there's food out, so starting out isn't slow.
  - A mid-game café now draws a bit less than before, and a big, well-made late-game café draws well past the old cap: about 21 a minute at level 45. More customers can be inside at once with more seats and machines.
  - Hover the customers-a-minute bubble at the top to see each part.
- **Jack-o'-lanterns light up**: the jack-o'-lantern pile and the scarecrow's pumpkin head glow orange after dark (the indoor jack-o'-lantern already lights as a lamp). The pink fringe round the Halloween pictures (pumpkins, witch sign, hay bale, coffin and the rest) is gone.
- **Life outside: benches and picnic tables**: some takeaway customers walk out to a free park bench or picnic table to eat, sit a while, then head off down the street. People passing by stop for a sit now and then too. A bench seats two and a picnic table four, facing each other across it.
- **Fix: a thin dark line down the screen at night**: the night dimming of the café left a thin dark line running down from the café's right corner on some graphics cards. It's drawn a different way now, and the line is gone.
- **No more food in customers' bellies**: customers no longer hold their dish in front of them as they walk (it looked like it was inside them). Their plate shows on the table while they eat.

## 1.0.141 — NeuroCafe: lights, and the café dims at night (24 October 2026)

- **The sofa sits straight**: its pictures were drawn turned a little too far round, so it never lined up with the floor. It now runs square with the tiles in all four turns, and the two people on it sit along its seat.
- **Lamps switch on and off**: click a lamp (its pull cord) to turn it off or back on. A lamp that's on glows softly by day and lights the room after dark.
- **Wall lights**: five sconces (brass candle, globe, lantern, fan and a swing-arm light) in Buy > Lighting > Wall lights. They hang on a wall panel like a painting. Click one to switch it.
- **Ceiling lights**: eight to choose from in Buy > Lighting > Ceiling lights: an LED ring, a paper lantern, an industrial cage pendant, halogen wire lights, a glass globe, an Edison bulb cluster, a Tiffany pendant and a crystal chandelier. Each hangs over a floor tile without taking it up. They are almost invisible (97% see-through), so they never hide the café or its labels, but their light is as strong as ever. Clicks go through them to the café below. While you're on the Ceiling lights page they turn solid and the café goes faint, so you can pick one to move, switch, take down or sell.
- **A light switch by the door** turns all the ceiling lights off or on.
- **The café dims at night**: in the evening and at night the inside of your café gets darker too (before, only the sandbox did). Every light that's on lights a pool round it, so a well-lit café stays bright.
- **Glowing machines**: the arcade machine's screen gives off a faint blue glow, and the jukebox glows in a rainbow that slowly changes colour. Outside, the Halloween lantern glows purple. All three glow brighter after dark.
- **Fix: crops on the field**: on a field far from the café, some plots showed bare soil even though they were planted (the soil was drawn over their crops). Every planted plot now shows its crop.
- (Lights count towards your café's looks, like paintings. The sconces and ceiling lights are stand-in drawings until they're painted.)

## 1.0.140 — NeuroCafe: the event houses (24 October 2026)

- **The haunted house**: the haunted mansion has a new look, a crooked purple house with glowing green windows, a porch and a jack-o'-lantern. It works as before: click it for the Halloween catalogue and spend your candy there.
- **Three more event houses** in Build > Buildings: **Santa's house** (Christmas), a **rabbit warren** (Easter) and a **Norse longhouse** (Midsummer). Each can be built while its event is on, one of each, and stays on your street all year. Click one and the Events book opens at its event. (Those events are still coming, so their pages say so for now.) In the sandbox you can build them any time.
- All four turn four ways and snap flush against the pavement, lined up with the furniture store.

## 1.0.139 — Notes in step on both computers (24 October 2026)

- **The notes that ship with releases are the same on both computers**: the list of notes and notebooks ticked "Ship with releases" now travels with each release and joins up with the other computer's ticks, so a release made on either one carries them all. (1.0.138, made on the laptop, kept the notes from the release before.)
- This release brings today's Collaboration notes: the PT56 play test, the art workflow note (N53), the art list (N54) and the jukebox question (Q8).

## 1.0.138 — NeuroCafe: Halloween and candy, the Events book, a jukebox, floors outside, paints for frames and the till (24 October 2026)

- **Eight new games** (Buy > Fun > Games): skee-ball lane (level 17), basketball hoops (19), karaoke machine (20), foosball table (22), light-gun arcade (25), air hockey (28), dance machine (32) and whack-a-mole (36). People come in to play them and pay into them, like the arcade; karaoke singers drop coins in when they get up from a seat. Each turns all four ways.
- **Room dividers** (Buy > Decor > Dividers), levels 9-22: a white half-wall, a low brick wall, a folding screen, a velvet rope, a hedge planter, a standing mirror, an ivy trellis and a banner barrier. They turn two ways and take swatches like the other furniture.
- **Windows, curtains and blinds** (Buy > Decor), hung on a wall panel like a painting: eight windows (a sash window, a porthole, stained glass, a bay window seat...) and eight curtains and blinds, each with its window. They count towards how good the café looks.
- **Clocks and wall things**: a station clock, a cuckoo clock, a sunburst clock, a pendulum clock, a tin clock, a dartboard, a gilded mirror and a teacup shelf.
- **Wall things sit on the wall properly**: windows, curtains, blinds, clocks, the fire kits and the rest now lie at exactly the wall's angle and stand out from it in 3D, like the paintings, on both walls. Dividers join up end to end in a row.
- **Wall weapons hang in mounts**: each sits on an oak or walnut plaque, a shield board, a driftwood plank, a shadow box or a gilded frame, to suit it.
- **Four big games, two tiles long** (Buy > Fun): ping pong (level 21), a pool table (26), shuffleboard (30) and a big air hockey table (34).
- **Halloween** (1 October to 10 November): every dish you serve earns a piece of candy, and tables sometimes leave a few as a tip. Build the **haunted mansion** on your street in October (Build > Buildings) and spend candy there to unlock Halloween things for good: decorations, games, paintings, wallpapers, street things and eight Halloween dishes. Once unlocked they're yours for coins in Buy > Events > Halloween, all year round.
- **Your photos in frames**: the Furniture store has a Photo frames page. Add a photo from your computer, pick one of five frames and hang it on a wall.
- **Fences run along the tile edges, post to post**: holding a fence (picket, paddock or raven), press on a corner, drag and let go for one continuous line; start the next from its end post to turn a corner and fence in a box. Plots dig right up to a fence, and fences run along a plot's edge. Fences you'd already put down move onto the nearest edge. The plow drags a row of plots the same way.
- **Dividers join at the same height**, the **big games keep all their legs and corners**, and furniture, street things and wall things stand out more (a crisper shadow, a touch more contrast).
- **W, A, S, D pan the camera everywhere** -- with a menu, the drawer or a pop-up open too (hold for a smooth glide, two at once for diagonals). To make room, Aunty's box no longer has a key, and storing a picked thing is **T**.
- (Sandbox: Dev tools has an Events section -- Halloween on/off, set candy or add 100 / 1,000 / 10,000.)
- **A second chicken coop** to buy from level 10.
- **Two-tone dividers**: the half wall's top rail, the brick wall's coping and the banner barrier's posts take their own paint -- each part's swatches under its own heading (e.g. a charcoal half wall with a red top).
- **Painted dividers take real paint**: the half wall, trellis and brick coping have a full-strength paint set (charcoal, ebony, red, teal...) that covers the whole piece -- no more pale wash.
- **Photo frames take paints**: right-click a hung photo frame any time for its wood swatches, like the furniture.
- **Level-ups, redone**: a gold level badge, the rewards up top, and every unlock in a grid by kind (dishes, furniture, decorations, walls...) that scrolls, with the button always in sight. Levels that come together show in one pop-up.
- **The Events Catalogue** is the haunted mansion's: click the mansion and it opens a book like the furniture store's, at Halloween -- unlock its things with candy right there. The book has a page for each of the year's events: Chinese New Year, Ramadan, Easter, Midsummer, Halloween, Thanksgiving, Christmas and New Year's Eve, each with when it's on (the rest are coming). Buy > Events still lists what you've unlocked, for coins.
- **The jukebox picks the music**: right-click a jukebox (or Settings > Choose the music) for the café radio -- the game's lofi and every song you drop in the café music folder, shuffled together -- or a playlist: add any folder of music and it plays each song once, in order (or shuffled), then round again. Next, on/off and the volume are there too; what you pick is remembered. (Songs from Chords' library come next.)
- **Buildings line up along the street**: put a building near a pavement and it sits flush against the pavement's edge -- the furniture store and the mansion side by side like shops. They keep off the pavement and the road, and turning one keeps it flush. Their pictures are straightened too, so their bases run true to the grid.
- **Steadier menus**: the round buttons no longer flash off and on, and the catalogues stay where you were when you click something in them.
- **The cash register takes paints**: right-click it for two rows of swatches -- the cabinet (the wood colours and paints) and the register on top (Gold, Silver, Copper, Bronze and the paints).
- **Paintings stay in your hand**: like furniture, street things and plots, a painting, wall thing or photo frame you hang stays in your hand for another -- till Esc, a right-click, picking something else or closing the menu (or there's none left to have).
- **More fixes**: the brick wall's top paints its sides as well as its top face; the jack-o'-lantern turned the other way no longer has a bit of the candelabra stuck on it.
- **Floors outside**: Build > Floors lays tiles on the grass outside the café as well -- in front, at the sides, across the street (never on the pavement or road; at least 3 coins a tile out there). The new Grass card lifts them again.
- **Painting frames take paints too**: right-click any painting (or pick it in Build) for its frame's wood swatches -- the picture stays as painted. The whole frame takes it now, its inner face included.
- Halloween tips are 1-3 candy now (about 3 tables in 10 leave some).
- **Scroll bars** in the menus and books are brown on parchment, to match.
- **Fixes**: the banner barrier lines up end to end like the other dividers; no more magenta in the cauldrons (the green glow, the stew's steam, the burnt pot's smoke), the old man's hat, or the steam and smoke from dishes.
- (Expanding the café no longer leaves extra grass sticking out past the road.)
- (Behind the scenes: the Halloween coin machines are painted and ready for when the seasons come. Art now comes from Gemini painted one way only; the other facing is a mirror image, so pairs always match.)

## 1.0.137 — NeuroCafe: the furniture catalogue, buildings in the Build menu, no more spoiled dishes (24 October 2026)

- **Dishes don't spoil any more** (for now): food stays fresh on its counter however long it's out, and anything that had spoiled is fresh again. (Crops in the field still go over.)

- **The Furniture store's catalogue is a book**: it opens on a contents page of pill buttons (Counters, Tables, Chairs, Stools, Sofas & armchairs, Plants, Shelves & stands, Lamps, the Paint mixer). Each piece of furniture has its own spread -- the piece on the left page, every swatch you can buy for it on the right (a counter's styles, then its paints). The arrows at the bottom corners turn to the next or last piece in the section; the red Contents tab on the side goes back to the start.
- **Buildings are in the Build menu**: a new Buildings tab, with the Furniture store (now 3,000 coins -- it'll house every style for sale). It's no longer with Outside's things.

## 1.0.136 — NeuroCafe: swatches and paints, the Furniture store, a new Buy menu, lamps that light up (24 October 2026)

- **A blue floor lamp and a farmhouse table** (level 8), from Cam's blue sofa set. The lamp turns (its pull-cord swaps sides).
- **Lamps light up after dark**: in the evening and at night both floor lamps glow warm round their shades.
- **Swatches on every piece of furniture and every counter**: pick a piece in Build mode -- or **right-click it** for a little see-through pop-up of your swatches -- and choose a colour. Each material has its own swatches (fabric, leather, wood and its finishes, dark wood, plant pots, lamp shades, white paint, black iron). Only the fabric, paint or finish changes; each piece keeps its own colour (stored, it goes back to as painted).
- **Paints to collect**: Natural is always yours; ten paints come with levels (Walnut at 3 to Ebony at 30, on the level-up card); Aunty's box sometimes holds a tin of one you haven't got; and the **Furniture store** -- a building you put out on your street (Buy > Outside, level 6) -- sells every paint and the **paint mixer**, which opens the Colour, Shade and Vivid sliders. A paint is yours on every material. Locked swatches show a padlock and say where they come from.
- **Counter styles moved to the Furniture store** (its Counter styles tab): each one you buy becomes a swatch on every counter, a counter at a time. Styles you'd bought are still yours, and a café-wide counter style you'd chosen is now on each of your counters.
- **Recolouring fixes**: the darker, redder shading on wood and leather changes with the rest; on a painted counter the fridge badge and the dish showed only in streaks (the colour was laid over them) -- they sit on top again; a recoloured plant pot keeps its rim and shading the new colour (they stayed terracotta), and the leaves and soil are left alone.
- **The Furniture store building is painted**: a wooden shop with a FURNITURE sign, its windows showing a sofa and a lamp, turning all four ways (its sign never reads backwards).
- **A new Buy menu**: sections along the top -- Kitchen, Dining, Decor, Lighting, Fun, Outside, Farm -- and under them a row of category pictures, like Cafeland's (and the Sims 3's buy-by-function): Kitchen has Stoves, Counters and Fire safety; Dining has Tables, Chairs, Stools, Sofas & armchairs; Decor has Paintings, Wall weapons, Plants, Shelves & stands; Fun has Coin machines and Vending. "All" (the gold star) shows a whole section.
- **Wall weapons from NeuroPets, in the sandbox for now**: 52 pieces to hang on the walls like paintings, made from the NeuroPets weapon art -- a sword, mace, longsword, maul and kite shield on wooden plaques in every metal, crossed longswords, and a shield over crossed swords, plus bows, staves, a club, a bone axe, a fang spear and crossed staves. They open by metal as you level: bronze at 5, iron 10, steel 18, mithril 28, adamant 42, rune 60. They count towards the café's looks.
- **Fast forward in the sandbox**: a speed button by the clock, like the Sims -- ▶ real time, ▶▶ ×10, ▶▶▶ ×20. Cooking, customers, the clock and day and night all run faster. The sandbox keeps its own clock (it stays ahead after fast-forwarding); your café is always on real time.
- **In the sandbox, the café dims after dark**: in the evening and at night the inside goes dim like the street, and each lamp lights a warm pool round it -- an unlit café is dark. (Trying it out before it comes to your café.)
- **A two-seat sofa, in the sandbox only for now**: two customers sit on it at once, one on each half, sharing the table in front. It's not in your café's shop until it works properly all four ways.

## 1.0.135 — NeuroCafe: a mix of cook times, crops that spoil, and a chicken coop (23 October 2026)

- **A mix of cook times from level 4**: quick dishes (30 seconds, a minute), short ones, half-hour ones, a couple of hours and overnight ones now come round every few levels -- French toast takes 2 hours at level 4, cabbage soup 8 hours at level 7 (put it on at night, take it off in the morning). Prices still follow the level, a coin or two more for the long ones.
- **The request cart never asks for overnight dishes** -- only dishes of four hours or less. A cart already out loses its overnight dishes (anything loaded of one still counts).
- **Crops spoil**: once ripe, a crop waits as long again as it took to grow, then goes over. The tick turns orange when it's close; a crop gone over is withered with a red ✕ -- click it to clear the plot. Seed cards say how long you have to pick. Crops already ripe get a full window from your first start of this version.
- **A chicken coop with two hens**: Farmer Giles drops one off at level 3 (in your street things -- put it down from Buy). The hens lay an egg every 15 minutes between them, up to 12 in the nest; a full nest stops them till you collect. Click the coop to collect -- the eggs go into the pantry (a little XP each). One coop for now.
- **Eggs are an ingredient**: pancakes, waffles, French toast, the egg dishes, the cakes and tarts, fish pie, Caesar salad and more need eggs to cook free from your own harvest.

## 1.0.134 — NeuroCafe: the farm, one Menu button, and straight from the stove to the request cart (22 October 2026)

- **One Menu button**: the round buttons now live behind a single **Menu** button at the bottom left -- click it and the Cookbook, Build, Buy, Bag, Upgrades, Farm, Aunty and Settings buttons open in a tray beside it. With Build, Buy or the Farm open, the Menu button says **Close** and closes that, back to the tray; with nothing open it folds the tray away (Esc does the same). Its badge counts what's waiting for you (Aunty's box, ripe crops). The keys still work with it closed.
- **The farm** (from level 3): Buy has a new **Farm** tab (or Menu > Farm, key **F**). Take **the plow** and click any tile outside -- off the road and the pavements' walking lines -- to dig a plot, like placing a street thing; it stays in your hand while you've room for more. The first four plots are free, then each costs a little more; your level allows 4 at first, 8 from level 6, then 12, 16, 24 and 32. In Buy's street tabs, click a plot to move it (crop and all) or fill it in (half its cost back).
- **Things for round the plots**, on the Farm tab: a paddock fence, watering can, hay bale, compost heap, produce cart, windmill, greenhouse and barn (NeuroPets' pictures).
- **Farmer Giles's seeds**: click an empty plot and Farmer Giles (from NeuroPets' Farmyard) shows his seeds as cards like the cookbook's -- how long each takes, how many it gives, what you have and which dishes it's for. Seed costs coins: priced so growing a dish's ingredients costs **under half** what cooking it with bought ones does. **Seed packets** -- now and then in Aunty's box, and left by the request cart's tutors -- sow a plot for free (Bag > Pantry shows them). NeuroFarm's fourteen crops grow through its four growing pictures; click a ripe one (✓) to pick it into the pantry (Shift-click: every ripe plot).
- **Cook with your harvest**: every dish's cookbook card shows the crops it's made with (have / need). With all of them in the pantry it says **Free** -- cooking it uses them up and no coins -- and those servings **sell for a quarter more** (customers take the farm-grown ones first). The berry tart, for one, is strawberries, blackberries and wheat.
- Sandbox: **Ripen the field** and **+5 seed packets** in the dev tools.
- When every counter and counter fridge is full, a ready dish the request cart's order wants goes **straight from the stove onto the cart** when you serve it (a message says so). If the cook makes more servings than the order still needs, the tutor buys the rest at the usual price. If that fills the order, they pay and set off as usual. It still counts for XP and mastery. With room on the counters, dishes go on the counters as before.

## 1.0.133 — NeuroCafe: Aunty's daily delivery, her secret recipes, and the request cart from NeuroVale (22 October 2026)

- **A box from Aunty every day**: once Chef Rosa's tutorial is done, a box waits each day -- the **Aunty** round button (the crate, key **A**) glows with a 1 on it, and a message says it's arrived. Open it for a note from Aunty and one to three gifts: **coins**, **potions**, **servings of a dish**, or **something to decorate with** (a street thing or a painting). Boxes don't pile up: one not opened by midnight is gone.
- **Food from Aunty** goes in the bag (a new **Food** tab) and out onto your counters by itself as soon as one has room -- a counter with the same dish, an empty one, or a counter's fridge.
- **Aunty's secret recipes**: ten family dishes that never open by levelling -- soda bread, hearty stew, smoked fish, a coming-of-age cake, rich stew, grilled sturgeon, grilled char, great white steak, hammerhead steak and grilled stingray. They're on their own cookbook tab, hidden until she sends them. Your **first box** always brings her soda bread, with a note that she'll share more of the family secrets as you grow; after that one comes rarely (about one box in 25), and only those meant for your level (the last at 85). They sell for a little more than other dishes of their level, and earn mastery stars like any dish.
- Pictures: the book and the recipe page are NeuroPets'; the secret dishes are NeuroPets' food, served. Their pan pictures (cooking and burnt) wait to be painted -- the served picture stands in.
- Sandbox: **Aunty's box** in the dev tools sends a new box now.
- **The request cart -- NeuroCafe meets NeuroVale**: from level 2, every day one of NeuroPets' guild hall tutors (Pip, Wren, Brakka, Ilse, Brother Aldo or Tamsin -- a different one each day) drives a cart and horse up to the road by your door with an order: so many servings of one dish at first, two or three later (quick dishes in bulk -- 20 to 50 pancakes -- long ones by the cook or two). Click the cart to see the order and **load it straight from your counters** (and their fridges), a dish at a time or everything you can. When it's full they pay what the food sells for **plus half again as a bonus**, leave a potion -- and now and then (about one cart in ten) a **keepsake from NeuroVale** for the street: Pip's "found" chest, Wren's training dummy, Brakka's anvil, Ilse's wisp jar, Brother Aldo's grindstone, Tamsin's beehive or duck pond (never sold in the shop) -- and set off home. An unfinished cart leaves at midnight, paying for what was loaded, without the bonus. (The tutors, cart, horse and keepsakes are NeuroPets' own pictures.)
- **Cheaper expansions**: 5x5 now 900 coins (was 1,500), 6x6 2,600 (4,000), 7x7 6,000 (9,000), 8x8 12,500 (18,000), 9x9 23,000 (32,000), 10x10 37,500 (50,000), and a quarter off every size after.
- Sandbox: **Request cart** in the dev tools brings a cart now (the next tutor each press).

## 1.0.132 — NeuroCafe: every menu from the start, and recipe mastery (22 October 2026)

- **Every menu opens early**: breakfast from level 1, lunch from level 3, the bakery & teas from level 5, dinner from level 7 -- then each menu keeps adding dishes a level at a time. A new dish at every level up to 30, then about every other level up to 100. A dish's price per serving now follows the level it opens at (4 coins at level 1, 13 at 30, about 22 at 100), a coin more for an hour's cook and two for three hours or more.
- **Recipe mastery**: every dish has five stars in the cookbook, grey until you earn them. A dish counts each time you serve it onto a counter (burnt and cancelled ones don't). Each star makes that dish better for good:
  - ★ 10% more servings · ★★ sells for 10% more · ★★★ cooks 20% faster · ★★★★ another 15% more servings (25% in all) · ★★★★★ never burns.
  - Quick dishes take more cooks, long ones fewer: pancakes (10 s) need 40 cooks for the first star and 600 for all five; waffles (2 min) 15 and 225; an hour's dish 4 and 60; a four-hour dish 2 and 30.
  - Point at a card's stars to see how many times you've cooked it, how many more the next star takes, and what each star brings. A toast says when you earn one. What a star changes shows green on the card.
  - A dish already on the stove keeps what it was cooked with; the cost to cook never changes, so the extra servings and price are profit.
- Sandbox: **Mastery +1 star** in the dev tools.

## 1.0.131 — NeuroCafe: a clock, and the rushes (21 October 2026)

- **The clock**: the real time at the top of the café, white and see-through. The café's day runs on it -- dawn, day, dusk, evening and night in the sky -- and so do the rushes.
- **Rushes**: twice the customers a minute in the **Breakfast rush** (7-9 am), **Lunch rush** (12-2 pm), **Dinner rush** (6-8 pm), **Late-night snack run** (10-11 pm) and **Midnight run** (midnight-1 am). Under the clock: the rush that's on and when it ends, or the next one. A note pops up when one starts, and the customers-a-minute badge shows ×2. The café keeps to them while you're away too.
- Sandbox: **Rush** in the dev tools holds one on, to try it.

## 1.0.130 — NeuroCafe: building without the buttons, and more like it (N49) (21 October 2026)

All thirteen of N49's ideas (Cam: "release all of them"):

- **Keep holding**: after you put a chair, table or counter down, another of the same stays in your hand while there's one to have (from storage, or bought as you put it down). Esc or a right-click puts it away. (Street things already worked this way.)
- **Shift + arrow keys** move what you're holding a tile at a time (or a picked thing, where it stands); **Enter** puts it down.
- **Drag to move**: in Build, press on a thing and drag it where it goes.
- **Right-click** turns what you're holding; with nothing held it backs out, like Esc.
- **A red ghost says why**: "the till can't be reached", "taken", "outside the café" -- above the ghost, before you click.
- **The customers' walks** from the door to the counters and the till show faintly on the floor while you hold something -- red where the thing in your hand would stand on one.
- **Chairs face the table by themselves** when you put one beside a table (turn it after if you like).
- **Keys**: B Build, U Buy, C Cookbook, G Bag, P Upgrades; with a thing picked in Build, M move, S store, Delete sell (with the usual pop-up). The buttons' tooltips say so.
- **Same again**: double-click a free stove -- or point at it and press Space -- to cook the dish it cooked last.
- **Sweep the stoves**: press on a stove and sweep the mouse over the others -- each ready one serves, each dirty one cleans, each burnt one goes in the bin.
- **Ctrl+Z in Build** puts back the last thing you did there (moved, turned, placed -- refunded -- stored, sold, papered, laid); cleared when you close Build.
- **Try before you buy**: point at a floor, wallpaper, counter style or painting card and the café shows it in place until you move off.
- **Alt+click** a thing in Build to pick up a copy of it, facing the same way.

## 1.0.129 — NeuroCafe: turn things with the arrow keys while you build (21 October 2026)

- **The arrow keys turn what you're holding** (the play test team's most asked-for): in Build and Buy, while placing or moving a stove, counter, chair or street thing, the arrow keys (or R) turn it -- the ghost turns right where it stands, so you see how it will sit before you click. Right/Down turn one way, Left/Up the other. The picture in the bar at the bottom turns with it.
- A thing being **moved** can now be turned on the way, and lands facing the new way.
- A **picked** thing (clicked in Build) turns where it is with the arrow keys too.
- Ideas for more of the same (fewer button clicks, the result seen live) are in Collaboration, N49.

## 1.0.128 — NeuroCafe upgrades: fridge counters and self-cleaning stoves (21 October 2026)

- **Upgrades** (a new round button, the wrench): every stove and counter, and what can be fitted to it.
- **Fridge component** (300 coins, per counter): when the counters are full, a cooked dish waits cold *under* a counter -- one dish under a serving counter, two under a buffet counter -- and goes up on top by itself when the dish there sells out. It doesn't spoil while it's cold. A snowflake badge on the counter shows what's underneath. Click a counter to see what's on it and in its fridge, and to install the fridge component.
- **Self-cleaning stove** (400 coins, per stove): clean again by itself after every dish, still with the cleaning XP.
- Store or sell an upgraded stove or counter and the upgrade is kept as a spare part, fitted free to the next one.
- **Cafés started before now get a serving counter** (not a buffet counter, as 1.0.127 gave): a buffet counter from 1.0.127 still in the warehouse is swapped for one.

## 1.0.127 — NeuroCafe starts with a buffet counter (21 October 2026)

- **A buffet counter from the start**: a new café opens with a buffet counter in place of the single serving counter, so two dishes can be on sale at once from the first minutes. Chef Rosa's tutorial serves onto it.
- **Cafés started before get one more counter**: a free buffet counter waits in the warehouse (Build), on top of the counters your level allows -- place it anywhere, even before level 3.

## 1.0.126 — NeuroCafe: the long game begins, and updates for older computers (21 October 2026)

- **Cancel a dish**: click a stove that's cooking to cancel it -- the stove is free again straight away, but the coins it cost aren't given back (not during Rosa's tutorial).
- **Level-up rewards** (V23): every level brings coins (40 x the level) and a potion; every 10th level a chest.
- **Potions** (NeuroPets' art): Fresh (a spoiled dish fresh again), Quick (a stove finishes now), Sell (a counter's dish sold now).
- **The Bag** (NeuroPets' satchel, bottom left): potions to use, and everything you've stored -- moved here from the Buy tabs.
- **Spoiling**: a dish on a counter spoils 4 x its cook time after it was served (2 hours to 2 days); nobody buys it -- bin it or freshen it. Cam's breakfast Spoiled pictures are in; other dishes are greyed for now.
- **The fire kit** (level 8, on a wall panel): saves up to 5 dishes a day from burning; the big one (level 40) saves 10.
- **Levels to 100** with something new at every one; **cafés up to 30x30** (11x11 at 28 to 30x30 at 100).
- **NeuroPets' dishes in the cookbook**: Bakery & teas from level 31, Dinner from 40, each cooking, served and burnt in its own pictures (Cam's sheets).
- **Buy tabs in the order things open**; the sandbox's level picker has presets and a box (100 buttons were too many).
- **Automatic updates for computers set up before the ISO**: `system/enable-updates.sh`, carried with its key by `tools/make_update_kit.sh` -- finds NeuroNet, takes it to the newest release (data untouched, old code kept) and switches the daily check on.

## 1.0.125 — NeuroCafe, a new café game, and pictures in Collaboration (21 October 2026)

- **NeuroCafe** (V19), a Cafeland-style café in its own window, like NeuroFarm: `neurocafe`, Super+Alt+J, an icon in the launcher. Your aunt's café: a 4x4 floor of grey tiles, plaster walls and a door, with one stove, one serving counter and the cash register. Chef Rosa walks you through cooking, serving, cleaning and money, and the tutorial ends in level 2: waffles, a second stove, a second counter and the 5x5 café (1,500 coins). After that, one more stove and counter every 5 levels, up to level 10.
- **Cooking**: a free stove opens the cookbook -- eight breakfasts, from 10-second pancakes to an hour's eggs and bacon, each with its time, servings, cost, takings and XP. A ready dish waits on the stove for as long as it took to cook, then burns. Serving puts it on a counter; the stove is dirty after and one click cleans it.
- **Customers** walk in from the door, take a serving, pay at the till and leave with it -- more of them when more counters are full and with more kinds of dish. Click the till for the coins. The café keeps going while it's closed: dishes finish and burn, and customers buy what's on the counters (never more).
- **Build**: buy stoves and counters, place, move, turn them four ways, store them in the warehouse, or sell them back for half.
- **Walls that join, a door that fits, single counters** (V20 and PT42, after the first runs): the walls and doors are cut to one exact template shape, so the panels butt together into one wall and the door's panel is the same size as the rest; the serving counter and the till are single one-tile counters, and a served dish sits on the counter's top; people and counters are scaled to the walls.
- **The café on its corner** (PT43): it now stands on grass at a street corner, with a slab pavement along the back of both walls, a kerb, and sandstone roads crossing beyond, with open grass in front to grow into. People walk up and down the pavements and across the roads, and customers walk in along the street, come through the door, and leave the same way. Drag to look around, use the wheel to zoom, double-click to reset the view. (The street is drawn by the game until its painted sheets come, N34.)
- **The buffet counter** (level 3, 450 coins): one counter two tiles long that holds two dishes, made from Cam's own counter art. Customers take from either plate. Things that cover two tiles are checked on both: placing, moving and turning (it says when there's no room), walking round them, and drawing them in front of or behind people.
- **Feet on the ground**: people stand with their feet on the spot they're on (they were half a tile up), with a soft shadow, and sway as they walk instead of hopping. Painted walking frames will take over when they're cut in (N34).
- **Sandbox and dev tools** (PT41-PT44): a Sandbox button opens a second café, a copy of yours, kept in its own file. Its dev tools set the level and coins, unlock everything, cook instantly, stop burning, finish and clean the stoves, fill the counters, send customers, skip time and switch the café's size. They only work in the sandbox, and the game won't save the sandbox over your café or the other way round.
- **Customers in groups** (PT43): people come in ones, twos and threes, at uneven times, and a group walks in together.
- **A new cookbook**: a Cafeland-style recipe book on parchment in NeuroPets' frame, with a card per dish (time, cost, XP, price, servings and takings, a big picture), a Breakfast tab and sort buttons. Pop-ups use the same frame.
- **The street, painted** (N34): Cam's grass, slab pavement and sandstone brick textures, with lamps, trees, benches, a bin, a post box, a bike rack, planters and an A-frame along the streets, sorted in with the people walking past.
- **People walk with real steps**: the woman and the old man have painted walking frames (the boy still sways until his are painted).
- **You place the street things** (PT46): a Street build mode -- buy or take from the warehouse, place them anywhere off the roads and the middle of the pavement, move, turn, store or sell them. Sixteen of them, more opening as you level (lamps and benches at 2, an oak tree at 6, a café sign at 9). Every café starts with two lamps, a planter, a bin and a menu board in the warehouse; nothing is put out for you.
- **A sidebar**, NeuroPets' dark wood one: Cookbook, Build inside, Street, Dev tools in the sandbox and the sandbox switch, so the top bar is just the café's name, level and coins.
- **Zoom** goes further in and out again, towards the pointer.
- **Walking straight**: people face the way they're going (the two "away" pictures were the wrong way round) and the body stays steady while the legs step (each frame had been trimmed to its own edges).
- **Day and night** (PT45): the street dims and warms with your clock, like NeuroPets -- dawn, day, dusk, evening, night -- while the café stays lit inside, and lamps glow after dark. The sandbox's dev tools can set the sky.
- **Walking with steps, facing one way**: the woman, the old man and the boy have new walking frames (Cam's Sheets 03-05); only the frames facing one way are used, mirrored for the other, so nobody swings from side to side.
- **Street things turn properly**: benches, menu boards, signs, bike racks, picnic tables, fences, planters, hedges, bins and post boxes are painted facing both ways (Sheets 08-09).
- **Counters**: a buffet counter is one of your counters -- serving and buffet counters share your level's number (PT46).
- **Build further out**: street things go as far as you can see, about 24 tiles each way (PT46).
- **Dev tools: sell now** -- one dish, or everything on the counters, straight into the till (PT44).
- **A smaller window** (PT44): the top bar tightens as the window narrows, and below about 760px the sidebar slides over the café from ☰.
- **Floors** (PT47): Cam's sixteen floors, laid a tile at a time (click or drag) or over the whole floor, nicer ones opening with levels.
- **Tables, chairs and seated customers**: a chair turned to face a table is a seat; some customers sit to eat after paying and leave a tip; seats bring a few more customers. A potted fern to decorate, and the **vending machine** (level 4), a second income that fills its own takings.
- **Walking, measured** (PT47): every walking frame checked against the first of its step, as painted and mirrored; those drawn turned the other way are mirrored, so the old man and the boy walk one way with steps.
- **Placing far out works**: build mode listens over the whole view, not just the café's box.
- **Open and closed**: a sign in the top bar. Closed, no new customers come in (those inside finish, the food waits) -- also while you're away -- until you open again.
- **Wallpapers and counter styles** (Sheets 10-11): eight of each, bought once and switched freely; the doors are set into each wallpaper, and buffets are made from each counter style.
- **More furniture** (Sheet 12): four tables, stools, bistro and garden chairs, armchairs (a bigger tip), a palm, a floor lamp, a bookshelf, a coat stand. **Customers sit in their sitting pictures** (Sheet 06).
- **Fixes from PT48**: chairs count as seats only when their picture faces the table; no pink under the chair; the boy faces the way he walks; laying floors makes the room's things see-through; people come in for the vending machine.
- **Pacing (V21)**: XP comes from sales -- each dish's XP shared over its servings as customers buy them; customers come for variety, full counters, seats and the café's looks (3 a minute up to 15), shown by the ☺ in the top bar; a level reached by sales while you're away still gets its level-up.
- **Fixes from PT49**: no line under seated customers; they sit behind a chair that faces away; the coat stand's stray leaf gone; the woman walks towards you with steps (drawn one frame at a time from pose pictures, N37).
- **Collaboration: pictures** -- paste a picture into any note (or pick one with 📎) and it's kept with the item, for Claude to see.
- **XP from serving again, and from cleaning** (PT50): serving a dish gives its XP; cleaning a stove gives a little, even after a burnt dish. Customers buying no longer give XP.
- **Tips left on the table** (N42): when a seated customer gets up, most leave a coin on their table (an armchair's sitter two) -- click it to pick it up. Takeaway customers don't tip, so tables and chairs pay their way.
- **Chairs turn all four ways** (N39, Sheet 13): the bistro and garden chairs and the armchair, painted from the back too. Their second turn had shown the chair's back while the customer sat facing the other way.
- **Stools**: customers on a stool sit in front of it and a little higher, no longer hidden behind it, until the stool poses are painted (N44).
- **Lighter on the computer** (N40): no endless CSS animations (they redrew the window at the screen's full rate for ever, about a quarter of a CPU core) -- the bobbing and swaying step with the game's own clock; nothing is drawn while the window's hidden; a sale or a payment updates just its numbers instead of rebuilding the whole café; the café is worked out once a second rather than eight times; and the page's JavaScript has a 128 MB ceiling, so Chromium tidies up instead of letting memory climb past a gigabyte.
- **Build and Buy buttons** (N43): two round buttons at the bottom left of the café. Build has Floors, Walls and Expansions; Buy has Furniture, Decor, Stoves, Counters (with the counter styles) and Outside (the street). The sidebar keeps the Cookbook.
- **Walls a panel at a time** (N43): pick a wallpaper and click or drag along the walls, like the floors; each wallpaper is paid for once, and All walls papers the lot.
- **No sidebar** (PT52): round buttons instead -- Cookbook, Build (a maul) and Buy (NeuroPets' old coin) at the bottom left, **Settings** at the bottom right with the music and the sandbox.
- **Music** (V22): Cam's lofi plays quietly in the background, on/off and volume in Settings.
- **Wallpaper by the panel** (PT52): one panel costs a fifth of the wallpaper -- no need to buy the whole set first. The build menu no longer jumps back to the start while customers buy, and the confirm buttons no longer go black.
- **Thirty levels** (V22), something new at every one; level-up cards show wallpapers, counter styles and paintings too.
- **Bigger cafés**: 6x6 at level 6 up to 10x10 at level 25.
- **Wall paintings** (Sheet 14): eight, hung one to a wall panel at the wall's angle; move, take down or sell them. They add to the café's looks.
- **Coin machines** (Sheet 15): a jukebox, an arcade, a pinball machine and a player piano, each turning four ways. Players come in for the arcade and pinball; people getting up drop coins in the jukebox and piano; click a machine for its coins. They make the café a little more popular.
- **Sixteen breakfasts**: the eight more Cam had painted (scrambled eggs, hash browns, porridge, full breakfast, burrito, shakshuka, granola, banana oat bowl) open between levels 11 and 29.
- **The old man and the boy walk with steps** towards you (drawn one frame at a time), and customers perch properly on stools (Characters Sheet 07).
- **Lunch** (V22): eight lunch dishes from level 10 on their own cookbook tab -- tomato soup, grilled cheese, Caesar salad, fish and chips, club sandwich, cheeseburger, spaghetti bolognese, lasagne.
- **The coin machines are in the shop** (Buy > Furniture -- they had no tab), and the round buttons are bigger so their names fit.
- **NeuroPets' dishes ported**: its 41 cooked dishes laid out as NeuroCafe food sheets (`tools/make_cafe_neuropets_food.py`, Cam's art folder Icons/Food/NeuroPets) and cut into the game's art; a dish without its cooking or burnt picture yet shows its served one on the stove, darkened when burnt.
- All the art is Cam's painted sheets, cut by `tools/cut_cafe_art.py`; the music is Cam's track (`ui/cafe/music/CREDITS.txt`).

## 1.0.124 — NeuroPets: crates open again (20 October 2026)

- **NeuroPets: crates open again.** Clicking a crate left it shaking for ever: the line where it tells you what you found had gone with 1.0.122's tidy-up of explaining writing, and the opening stopped there. The line is back (empty until there's something to say). A browser test now opens a crate from the bag.

## 1.0.123 — NeuroPets: a quiver you load yourself, painted specials and a new logo (20 October 2026)

- **NeuroPets: the quiver is loaded by hand** (N24). Arrows go into the quiver, out of the bag, when you wear them or use them with the quiver -- up to what it holds -- and shots come only from there. When it's empty you fight with your knife or fists until you reload; taking the quiver off puts what's left back in your bag. The Gear tab shows how many are in it. A worn quiver in an old save starts filled.
- **NeuroPets: weapon specials without a class** (PT39). A boss weapon's signature special, and any weapon's, now shows and fires whatever your class -- or with none.
- **NeuroPets: painted specials and How to Play.** Cam's sheets for all 32 specials (the catalogue and the Kit) and the How to Play book.
- **NeuroPets: a new logo**, in the game and as the app's icon: the dragon's face in a gold ring where it's small (the sidebar, the launcher), the whole badge on How to Play's cover.
- **NeuroPets: the Kit stays beside the page on a middling window.** It was hiding behind a Kit button on any window 1100px wide or less; now it sits beside the page down to 760px (a little slimmer under 1100px) and only becomes a drawer on a small window.
- **NeuroPets: the hunt plan lives in the Kit only** (PT38). The Character sheet's Combat tab keeps your stances and the specials catalogue.

## 1.0.122 — NeuroPets: fight from the Kit, specials for every weapon, and How to Play (20 October 2026)

- **NeuroPets: specials for every weapon, unlocked as you level** (V18). Each class has more specials, unlocking with class level (a Hunter starts with Aimed shot; Volley at 10, Pinning shot at 25, Rain of arrows at 40). Weapons have their own, for anyone holding one: the hunting knife's Double slash, Deep stab (bleeds) and Skinner's cut (an extra hide from the kill), and specials for swords, daggers, longswords, maces, mauls, bows, crossbows and battle staves, each unlocking with the skill the weapon trains. The eight boss weapons each have a signature special (Grizz's claws: Rend; the Fang spear: Venom thrust; the Basilisk staff: Petrify...). One bar pays for them all. Choose up to four for your side bar from the new catalogue on the Character sheet's Combat tab; in a fight the Kit shows the ones that suit the weapon in your hand.

- **NeuroPets: armour that fits your class, the RuneScape way** (V17). Every piece of armour is Heavy (metal and plate), Light (leather and hide) or Cloth (robes, hats, cloaks). Heavy armour costs Magic (bronze −1 a piece up to rune −6, platebody and platelegs double) and a little Ranged. Light gives a little Ranged. Cloth gives Magic and costs nothing. Armour's Attack bonus now helps melee only. Defence depends on what hits you: plate is half as good against magic, robes half as good against blows. Wear your class's weight (Berserker and Paladin heavy; Hunter, Thief and Beast Master light; Arcane cloth) for +10% Defence and +1 accuracy a piece. You may wear anything: you're told what it costs as you put it on, each item says its weight, and Your gear in a fight shows a stats grid with penalties in red.
- **NeuroPets: Light and Cloth armour to the top** (C8). Two new hides at the Tanner and Crafting bench: tiger hide (Defence 30, from Jungle big cats) and frost hide (Defence 40, from Frostpeak snow pelts). And robes for every mage rank at the altar: a robe top, bottoms, gloves and boots for Apprentice, Adept, Mage, Sorcerer and Archmage. Painted icons to come (sheets 110 and 111).
- **NeuroPets: leaf litter without a hatchet.** Bare hands pick up what lies on the ground: twigs and leaf litter at the Apple trees, the Copse, the Hedge trimmings, the Oaks and the Ash trees. Before, it was twigs only.
- **NeuroPets: a full bag always says so** (B1). Any find that won't fit stops the trip collecting and brings up the bag-full pop-up, not just the spot's main find (twigs at the Apple trees without a hatchet never did).
- **NeuroPets tutorial: the red box finds your pet again** (B2). Steps that send you to your pet lead through the Estate and the House to My pet (the sidebar link they pointed at had gone). At the Guild hall it scrolls down to the tutors instead of flashing on the Map (B3).
- **NeuroPets: your first egg is taken at the Hatchery** (I6). Amunet sends you to the Nursery's Hatchery, where your egg sits in a nest until it hatches. My pet says where to go if you have none.
- **NeuroPets: arrows only go in a quiver** (N19, B4). No quiver, no arrows, and a quiver won't go on over arrows it can't hold. Taking it off takes the arrows with it. Wren lends improvised arrows and the quiver comes first; Amunet's kit has improvised arrows and a quiver. Loose arrows on an old save come off (they stay in your bag).
- **NeuroPets: what you're wearing shows under the bag** (I7), on the Bag page and in the Kit, with right-click and Use with…, so you needn't take it off first.
- **NeuroPets: a bigger first bag** (I8): 25 slots, room for the tutorial's and a lesson's gifts. The bank's buttons are only at the bank (the store room, an island estate, or the bank window), and the bag-full pop-up offers drop and recycle, not bank (N20).
- **NeuroPets: sort the bank by dragging** (I9). In All, drag a thing from one tab's part onto another's.
- **NeuroPets: the Combat tab in the Dev tools layout** (N18): full-width rows down the page, a titled card each for how you fight, quick-use slots, draughts, traps and nets, your shield and between fights.
- **NeuroPets: a skill shows what it unlocks.** Clicking a skill in the Kit no longer takes you anywhere: it opens a window of everything that skill unlocks, each an icon with its level, greyed until you reach it (hover one for what it is). And picking a scroll or a region on a map shows no yellow box over it any more.
- **NeuroPets: no explaining writing.** The lines that explained how things work are gone app-wide: the top bar's page subtitles, the writing under the painted maps and on the map's region cards, the Kit's hints, the line under the fight, and the explanations on benches, the herb table, the notice board, the Grindstone, the recycle stash, the cart, contracts, the Pen, the Guild hall, the Farm, the Pyramid, island estates, breeding, the Necromancer and the Character sheet. The hunt page loses its Health box (it's on the fight card), plan line and weapon line. What stays: live status, counts, timers, locks, empty-shelf lines, people's own words, quests, and the books. The tutorial and How to Play explain the rest; its photos are retaken.
- **NeuroPets: every bench-like window looks like the crafting bench.** The merchants (Buy and Sell tabs, with an amount slider), the Grindstone, the herb table, the notice board, the altar (Enchants and Enchanting gems), the recycle stash (Put in, Breaking down), the recycled materials (Materials, Exchange), the cart (Load, On the cart), the harbour contracts, the Guild hall's class benches, the Marketplace stalls and the Farm's benches, Feed store and Fern's stall now have tabs, a search and a grid of icons on the left and the one you picked on the right, instead of long lists to scroll.
- **NeuroPets: hunting goes straight to the fight.** Clicking a hunting ground starts the hunt and opens the battle. A Hunter with no arrows still goes: you fight with your off hand, a hunting knife from the bag, or your fists, and Hunt says which. A boss still wants arrows.
- **NeuroPets: the Stone wall gives stone and flint only.** No more copper ore from it, and flint is more common there (a quarter of finds, was 15%). Copper ore sells for a touch more now that it only comes from the copper rocks and digging.
- **NeuroPets: the Kit is your bag now.** The Bag page and the Bag button above the Map are gone; any link to the bag opens the Kit's Bag tab, which has a search box. On a wide window the Kit is always there (the "Show the Kit" setting went); on a narrow one the Kit button in the top bar slides it in. The tutorials point at the Kit's bag.
- **NeuroPets: quick slots by drag, and the hunt plan in the Combat tab.** Drag food, a draught or a trap from the bag onto a quick slot, under the fight or in the Kit's Combat tab, which now holds the quick slots, traps and nets and the Paladin's auto-bash. Right-click a slot to empty it.
- **NeuroPets: skills' xp on hover.** In the Kit's Skills tab, hovering a skill shows your xp, the xp the next level needs and what's left.
- **NeuroPets: combat level-ups show what they open.** Levelling Attack, Ranged, Magic, Defence or Hitpoints brings up the Unlocks window: the weapons, armour and arrows that need that level (your class's too) and any hunting ground your new combat level opens.
- **NeuroPets: New Game Plus keeps your old classes' weapons.** Every class you levelled in a finished game (level 2 or more) can still use its weapons and armour in the new one, so you can change how you fight mid-hunt. Talents and specials stay with your current class.
- **NeuroPets: How to Play.** Amunet's farewell gifts (or skipping the tutorial) include How to Play, a 14-chapter guide with photos of the game, read from your bag in the class books' reader. Games already past the tutorial get it once. The same guide is a PDF on NeuroNet's Scribe shelf, under Ebooks, put there by NeuroPets (and refreshed in place when a newer one comes). `tools/make_guide.js` takes the photos and prints the PDF.
- **NeuroPets: fight from the Kit** (N22). On the Hunting page the side panel is always open, and the fight's buttons are gone (a Beast Master's pack keeps its own). Click food in your bag to eat, a sword or armour to wear it, a draught to drink it, a trap or net to lay it. Gear and draughts count in the fight straight away, and each costs your next attack. New **Combat** tab: your stance (Accurate, Aggressive, Defensive), your special's bar and every special to pick, and Shield bash, Swap hands, Auto/Manual and Run. New **Skills** tab: every skill's level over the top level, RuneScape style; click one to go and train it. In a fight, the **Magic** tab's loaded spells pick your next cast. Quick slots (Shift+1 to 4) take draughts, traps, nets and throwing knives as well as food: right-click it in the bag, then "Put on a quick slot". On a narrow window with the Kit closed, the old buttons come back.
- **NeuroPets: an arrow a shot** (B5). A bow takes an arrow each time it shoots, not one a fight, so the count on you drops as you fight. When the bag or the quiver runs dry, you fight on with your off hand, a hunting knife from the bag, or your fists, and the hunt goes on until you stop it (nothing brings you home on its own since PT30).
- **NeuroPets: flint arrows from the bag** (I11). Use a chisel on flint for flint arrowheads (the chisel wears, a use a head), then a shaft on a head, with a feather, for a flint arrow. Hunters know how from Ranged 3; anyone else learns it from the knapper's page, found on early creatures. Flint arrows now hit a little harder (like bone) and need Ranged 3. They're no longer made at the fletching bench.
- **NeuroPets art: tiger hide, frost hide and the mage-rank robes are painted** (N21, icon sheets 110 and 111). The worn-armour notes for the seven new outfits are in the Notes vault (Worn Armour 31 to 37).

## 1.0.121 — NeuroPets: a new bench, death with a sting, and one amount picker (19 October 2026)

- **NeuroPets: a new bench, everywhere** (Q6). Each bench shows its whole list as painted icons under tabs (what it's made from), with the recipe you pick beside it: what it does, requirements and materials ticked or crossed, an amount slider and one big Cook / Smelt / Make. From the bag, Use with… lights up the benches that use a thing and opens one on what it makes.
- **NeuroPets: death with a sting** (V16, PT30). Fall and you wake holding your 3 most valuable things (Adventure) or nothing (Hardcore); the rest waits in a gravestone for half an hour, and opening it costs half of what's inside. Nobody eats or runs for you now, idle or not: four quick-use slots (Shift+1 to 4) and the Run button are yours. Idle hunting is for when you're strong. Tutors call you back from a lesson's hunt. Hardcore and Hell give more xp and rare drops. Worn gear is on you, not in the bag.
- **NeuroPets sandbox:** numbers set with the bench's slider, and a button to remove every item from your character. Dev tools are one full-width row per tool, with pills at the top that jump to each card.
- **NeuroPets: every "are you sure?" is the game's own pop-up** (PT31), not the browser's box. Yes is red when something is lost for good.
- **NeuroPets: starting again** after a fall in Hell, or a fresh sandbox, opens on the main-island map, and Amunet's tutorial starts.
- **NeuroPets: a fall leaves the fight** (PT32). Fall while you watch and you're taken to the Estate, where you woke; in Hell, straight to Game over.
- **NeuroPets: Settings** in the Dev tools layout: a titled card for each group.
- **NeuroPets sandbox: Difficulty** (PT33). Dev tools → You switches between Adventure, Hardcore and Hell any time; leaving Hell after a death brings you back.
- **NeuroPets: you, your coins and your trip** sit at the top of the left panel. The bag offers help when a trip fills it, and things a quest wants show that person's face.
- **NeuroPets balance:** the boss simulation plays each class with its kit, talents and boss sets, and sails to the islands. The late bosses aren't walls: each has a weakness (the right weapon or pet wins).

- **NeuroPets: recycling is quicker** (I4). A lot takes 30 minutes for each tier of the thing: old boots 30 minutes, bronze an hour, iron an hour and a half, up to four and a half hours for rune. A better stash is 25%, 50% or 65% quicker.
- **NeuroPets: Drop, and one amount picker** (V7). Drop anything from its sheet in the bag, with Recycle offered first. A pop-up with a slider and 1 · 10 · Half · All chooses how many to drop, deposit, take, make or sell, and shows what you'll get.
- **NeuroPets: a lighter Bag page.** The top bar no longer makes the page redraw every second.
- **NeuroPets:** bag card buttons fit ("Feed", the pet's name on hover). The Necromancer's risen hit a little softer (balance).
- **NeuroNet: easier-to-read grey text.** Secondary text now reads at 5:1 contrast or better on every panel, in every theme.

## 1.0.120 — NeuroPets: the Astral egg, the Bestiary, the Kit and Bank, region tomes, a new Beast Pen and the Marketplace (18 October 2026)

- **NeuroPets: the Astral egg** (V10). Winning a rematch at the mage tower now and then drops an Astral egg (1 in 200 at Apprentice, up to 1 in 40 at Archmage). It hatches one of eight planet pets, Mercury to Neptune; Uranus and Neptune are the rarest. They can't be bred or traded for tokens. As battle pets they're a new Astral type, neutral against every other, with four spells of their planet's element.
- **NeuroPets: the Beast Pen, made like the rest of the game.** The painting is the whole page. Each place opens a parchment sheet like the Marketplace's, and each battle pet opens its own sheet. Fixes every place's text showing under the painting.
- **NeuroPets:** your repainted Globe Tortoise and Red-dust Hound, and the Astral type's badge.
- **NeuroPets: found tomes in the Beast Pen.** Warden Briar's shelf lists the region tomes you've found, with each move's battle level, and says when one is in the bank. A pet too young for a tome's moves now shows when it can learn them. Astral pets read as neutral.
- **NeuroPets: new paintings.** The Bestiary keepsakes and the Grand bone staff, the seven region tomes, the Astral egg, and the planet pets (portrait, walking and asleep).
- **NeuroPets: tracking** (V15). In the Bestiary, Track one creature on a ground and your hunts there meet only that kind, with a short search between fights. Anyone can track once they've beaten the ground's boss five times; Hunters can from the start.
- **NeuroPets: your risen stays for the whole hunt.** Raised once, it's beside you at the start of every next fight until it falls.
- **NeuroPets:** a recipe page in your bag is enough -- using its things reads it first. Names and amounts are typed in the game's own pop-up, not the browser's box. Shops list things A to Z. The Beast Pen has nothing written under its painting. Skipping the tutorial straight away gives you a name and a look ("Adventurer"), so the top bar and the Kit work.
- **NeuroPets: region move tomes** (V11). Seven tomes found out in the world -- Davy Jones' (a sailboat), Cleopatra's (the Desert), Red River (the Nile), the Undead Tome (the Hollow Crypt), Frostbite (Frostpeak), Canopy (the Jungle) and the Star Tome (a rematch with the Archmage). The first win there gives you one, and its boss now and then leaves another. Any battle pet can learn their 26 moves, the strong ones at higher battle levels, and a pet can now learn three tome moves.
- **NeuroPets: the Beast Pen lives in its painting** (V12). One line under the picture says how things stand. Each place -- the stalls, the barn, the yard, the ring, the feed store, Warden Briar -- opens its own sheet, with tabs between them.
- **NeuroPets: people explain things.** Ranger Ash tells you how the Bestiary works and shows you the golden feather. Sexton Hobb explains life essence. Your class tutor explains the talent tree the first time you open it, and a button brings it back.
- **NeuroPets: field recipes** show in the Unlocks pop-up when you get a page and when you learn one, and Amunet's tutorial now gives you a bandage page to try. "Use with…" is on everything that's part of a field recipe, and it tells you what's missing when it can't be used yet.
- **NeuroPets fixes:** your risen pet stays beside you all fight, lying down once it has fallen. The Pet tonic is always in the fight's Feed menu. Keepsakes show at the merchant (marked as unsellable). A fight's menus keep their scroll position. The bank can be ordered like the bag.
- **NeuroPets sandbox:** quests can hand in without their needs (a switch), you can hunt only one chosen creature on a ground, and New Game Plus has a one-click Basilisk button.
- **NeuroPets settings:** the Kit and the Grid world prototype are now **off unless you switch them on** (Show the Kit, Show prototypes).
- **NeuroPets: a Grid world prototype** (sidebar → Prototypes). The main island as a tile grid you walk around, RuneScape-style: walk into an area's signpost to go in, click a tree, rock, bush, mound or fishing spot to walk up and keep gathering, click a creature to fight it as a Hunter or a Berserker. With sound throughout. It keeps its own save and never touches your game.
- **NeuroPets settings: Show the Kit** -- turn it off and the Kit and its top-bar button go away.
- **NeuroPets: the Kit** -- your bag, gear and magic in a panel at the side, RuneScape-style (the **Kit** button in the top bar shows or hides it). Click a thing to use, eat or wear it; **right-click** for the rest: Use with, Put in the bank, **Drop**, Examine. The Gear tab is your slots (click one to change it) and **three gear sets** you can save and put on in one click; the Magic tab is your spells in and out of your fights.
- **NeuroPets: the store room is a Bank.** One bank instead of chests, with more room (60 / 100 / 160 / 240 kinds by the room's tier, up from 26 / 52 / 91 / 156) and up to nine named **tabs** -- your old chests are tabs now, with their names and everything in them. Search, **Deposit bag**, click to take one, right-click for Take 5 / 10 / all / X and Move to a tab, drag onto a tab to sort. The painted Bank in the store room opens it in one click.
- **NeuroPets: Amunet's tutorial** shows the Kit and the Bank where it used to show the chests.
- **NeuroPets: the Bestiary knows your quarry** (V6). Library → Bestiary → *Your hunts*: every creature you've beaten, ground by ground. Beat 10 and you know where to hit it, 50 what it shrugs off, 150 its elements; a fight's creature card shows what you know. Beat enough to **master** one (about 40 hours of hunting it): +10% damage and drops against it, a trophy, and for nine creatures their own keepsake (a golden feather, an emerald fly, grave salt, a wisp in a jar ...). Keepsakes can't be sold. Every creature now fears an element and shrugs something off -- the ghoul fears fire. Ranger Ash's new quest, *Know your quarry*, explains it.
- **NeuroPets: Necromancy is mid game** (V8). Sorceress Nyx teaches it after you beat her (it was the Archmage), through a quest, *The Blood Book*, with every step from Old Salt's boat to her door in a pop-up. The Hollow Crypt is a level-40 ground, Morvane comes out after 200 kills, she wants 120 blood runes; the Blood altar, spells, potion and bone staff all moved down to match.
- **NeuroPets: rematches at the mage tower.** A mage you've beaten duels you again any time, for Magic xp and that rank's runes -- Rematch on the tower page and in the pop-up after a win.
- **NeuroPets: your risen fights beside you**, pale and glowing, with its health in the corner.
- **NeuroPets: the Pet tonic is a hunting item** -- in the fight's Feed menu, and a pet down to Scrap drinks one between fights on its own.
- **NeuroPets: sparring is a bout** on the Training Yard: two pets trade six moves and the Warden calls it. The Hunter's tree board is Cam's Ranger painting.
- **NeuroPets: a key under the talent tree** (taken, can take, locked, keystone, one of two).
- **NeuroPets sandbox: tidied into cards**, with a **Bosses** card (skip a boss's kill count, or count it beaten), **New Game Plus** from the sandbox, and the sky and class switches in the sidebar.
- **NeuroPets: hover a talent** on the tree and its name, ranks and what it does show up.
- **NeuroPets: after you win a duel at the mage tower** you're back at the tower, and the mage you beat has a word for you, fitting the rank (the Archmage's ends with his offer).
- **NeuroPets: Old Salt's boat asks Fishing 35**, the same as the crossing to the Misty Isle. The Coast's **Deep water** and **Shark reef** need a boat now (the Harbour doesn't).
- **NeuroPets sandbox: a Sky switch** (Real clock, Day, Night) for night-only creatures, vigils and the stars, and **Lay to rest**, which sends your pet or a battle pet to the Graveyard so you can try raising it.
- **Scribe → Collaboration: projects**, like the vaults in Notes. A picker at the top of the desk shows one project's documents (or every project's). **+ Project** starts one, **Rename** renames it (its documents move with it), and each document has a **Project** picker to move it. New documents start in the project you're looking at. Documents with no project are in General.
- **NeuroPets: the Marketplace** (off the Village; a placeholder map until the painting). Eight stores (fruit stall, baker, fishmonger, cloth merchant, apothecary, curio dealer, weaponsmith, jeweller), open to everyone for buying and selling. Each class has its trade perks: **Paladins** get a discount everywhere; **Berserkers** a bigger one at the weaponsmith; **Hunters** get extra for raw fish and meat at the fishmonger; **Arcanes** a profit on potions at the apothecary; **everyone** gets a good price for cut gems at the jeweller. Thieves and Beast Masters get nothing extra. Nothing bought there sells back for more.
- **NeuroPets: Larceny, a new skill.** Thieves, and any class with the Pickpocketing technique slotted, pick pockets in the crowd (coins) and lift goods from the stalls (each stall holds a stock that refills slowly), each needing its own Larceny level. You can do it a try at a time, or keep at it while you're away (slower). **Getting caught** costs a fine and a short stun, and that keeper watches you for a while; caught 3 times in a quarter of an hour, the watch throws you out for an hour. It never hurts you. Larceny stays when you change class. **Lockpicking:** Thieves find locked boxes, chests and strongboxes while hunting; opening one needs that Larceny level.
- **NeuroPets: Pip's lesson** takes you to the Marketplace to pick your first pocket.
- **NeuroPets: stolen goods go to the fence.** Everything you steal (goods and purses) goes in your **swag sack**, not your bag, and only **Nell the Fence**, in her back room off the Marketplace, buys it, keeping a 60% cut. Stealing is for training Larceny, not for getting rich.
- **NeuroPets: the talent tree is a tree.** Each talent is a small round badge on your class's painted board, joined by a line to the talent it follows (gold once you've taken both). Click one and its card opens at the side, where you spend the point. Keystones are big and gold; a dashed ring means one of two. The painting stays in view.
- **NeuroPets: PP for battle pets' moves** (V5). Every move has PP: few for the strong ones, many for everyday hits. They carry through a hunt, each win gives every move 2 back, and coming home or resting in the Pen fills them. With no PP left a pet uses **Scrap**, which never runs out. A **Pet tonic** (apothecary: 2 chamomile, 1 honey) fills one pet's PP.
- **NeuroPets: no more idle falls with food in the bag** (C5). On a ground where one long fight could finish you, your hunt plan eats up to 90% before the next fight.
- **NeuroPets: spiked gauntlets are worn on your arms** (C6), so they show on your figure and come off there. Old saves move them over automatically.
- **NeuroPets: reading a class book.** "Read it" in the bag works now (it said NeuroPets didn't know how to read a book). A book opens as a book: a parchment page in a wooden frame, a title page with contents, then the specials, a page for each branch of the tree, techniques and builds, the class's own things (and the Arcane's spells, six to a page). ◀ is bottom-left, ▶ bottom-right, and the arrow keys turn the pages too.
- **NeuroPets: opening a crate.** Click while it's revealing to jump straight to everything inside, with quantities. More of something you've already seen counts up on its card instead of adding another. If a new card would land out of sight, the window switches to counting on its own. A long list scrolls inside the window, so Close is always in view. (A starter crate's contents used to run off the bottom of the screen.)
- **NeuroPets: more locks to pick.** Pets' expeditions sometimes bring home a locked crate, and in the Pyramid a sealed crypt hides in one of the first chambers each day (Larceny 40). Both are for the **Keen Eye**: Thieves, or any class with the Pickpocketing technique.
- **NeuroPets: store prices follow one rule** (the Economist and Mathematician's review). Every store charges the higher of 2.5× what its materials cost and twice what the thing is worth. Gathered goods (apples, wool, herbs, fossils, the island stalls' goods) cost a little more, and the lantern, quartz ring and minor healing (which cost more to make than they sell for) much more. So buying never beats gathering or making, and nothing bought sells back for more. Class discounts stop at the rule. `tools/balance/store_prices.js` checks it.

## 1.0.119 — NeuroPets: a lesson from every Guild tutor, starter crates and painted tutors (17 October 2026)

- **NeuroPets sandbox: the time warp moves everything on now.** It used to skip the Beast Pen (training, feed, rest, sparring), the Farm's animals and workshops, the cart, the recycle stash, exploring, voyages and the shipyard, and home's stew, meals, reading and research. Warping an hour now gives a training pet an hour's training and an hour less feed.
- **NeuroPets: Tamsin's lesson for new Beast Masters.** Take the class (or press **Show me how it works** on her card in the Guild hall) and Tamsin walks you through it in the tutorial window: she lends you two of her own battle pets, Bramble and Hoot, plus a crook, grain feed and shrimps. You wear the crook, train and feed in the Beast Pen, choose your pack, learn moves and specials, then win three fights in the Farmyard. At the end she leaves with her pack and gives you **two eggs** to start your own. Skipping the lesson, or changing class part-way, ends it the same way.
- **NeuroPets: every Guild tutor has a lesson now.** Wren (Hunter), Brakka (Berserker), Ilse (Arcane), Pip (Thief), Brother Aldo (Paladin) and Tamsin (Beast Master) each offer one when you take their class, or from **Show me how it works** at the Guild hall. They lend the basics and walk you through everything the class does: bows, quivers, whittling and improvised arrows, traps and nets; longswords, spiked gauntlets, forging and brews; wands, spells and crafting runes at the shrines; a dagger in each hand, coating, poison brewing and throwing knives; sword and shield, blessing with holy water and brewing it; and each class's specials. When a bench isn't open to you yet, the tutor makes the thing for you and tells you what opens it. Each lesson ends with the tutor leaving for their own master and a **class starter crate** (a wooden crate for now): the class book plus starter supplies. Gifts come once per class.
- **NeuroPets: painted portraits for every Guild tutor -- Wren, Brakka, Ilse, Pip, Brother Aldo and Tamsin** (Cam's improved art) in the Guild hall, in place of the stand-in figures. In a tutor's lesson the window shows them full height, much bigger (tools/cut_portraits.py cuts them into ui/pet/art/people).
- **NeuroPets: the Beast Master's pack is easier to set.** A hunt with no pack chosen now takes your ready battle pets and keeps them as your pack, so it no longer stops. The Beast Pen shows your pack, with a **Choose your pack** button to the Combat tab.

## 1.0.118 — NeuroPets: the new map of the main island (16 October 2026)

- **NeuroPets: a new map of the main island** (Cam's painting): every region where it's painted now, and **your estate painted in** beside the Mage tower -- click it to go home (it used to be a house picture laid on top). The chimney smoke is the estate's.

## 1.0.117 — the Battle Re-work, finished: Parts 8 to 14 -- the Paladin; the Guild hall; the balance pass; quivers; the Beast Pen and the Beast Master; New Game Plus legacies; the Necromancer; final balance and polish; Cam's new art (16 October 2026)

- **Releases carry Collaboration and notebooks.** Every Collaboration document, and the notebooks (Notes' own vaults) listed to ship, now come with a release, so another computer has the play tests and the Battle Re-work notebook too. A document or note you've changed on that computer is kept there; the vault list gains the new notebook and keeps that computer's own.

- **NeuroPets: Cam's new art is in.** Painted icons for everything in the Battle Re-work so far -- the Hunter's nets, snares and knives, the Berserker's longswords, mauls, gauntlets and maces, the Arcane's battle staves, the Thief's daggers and poisons, the Paladin's shields and specials, quivers, class books, leaf litter and the improvised arrow, the Necromancer's six, the Pen's types and dummy, and the fight's **effect icons** (the effect chips use them now). The crypt's six **creatures**. **Portraits** for Nell, Thorvald, Maren, Warden Briar, Ilse and Morvane. Ghostly **spirit pictures** for sixteen kinds of pet -- the risen use them. New **scenes**: the Guild hall (each corner talks to its tutor), the Beast Pen (each place takes you to its part of the page) and the Hollow Crypt; the Village, the estate, the Graveyard, the Storeroom, the Workshop and the Misty Isle repainted, their new scrolls placed (the Beast Pen, the Grindstone, the Crypt and the Necromancer's circle, the Hollow Crypt's stair). The crypt's **battle scenes** -- the Ossuary, and the Wisp marsh at night. A painted **tree board** behind each class's talents.
- **NeuroPets: the Village chapel.** Sister Maren, the Paladin's tutor, at the chapel in the Village: holy water for your blade.
- **NeuroPets: a fix** -- the Hunter's Thick hide and the Paladin's Shield wall couldn't be taken: the Beast Master's talents of the same names had taken their places. Each has its own now (a Beast Master keeps the points it spent).
- **NeuroPets: creature tells.** Bosses show what's coming: every few rounds a boss winds up ("Bambi rears up, hooves high -- Stampede is coming!") and a ⚠ shows on its card. Answer it -- a net, a trap, a stun, a slow, smoke or a raised shield -- and the move breaks and it staggers; otherwise the blow lands harder (gently with the early bosses, hard from level 40). Fighting Defensively braces you for half of it. Gideon, the very first boss, doesn't tell.
- **NeuroPets: the Beast Pen's yard.** A **training dummy** (idle training 15% quicker) and a **sparring ring** (two battle pets spar for a little battle xp, nobody hurt, once every four hours a pet), each built once with Construction, coins, planks and rope.
- **NeuroPets: the Necromancer's touches.** Each kind of pet comes back with its own line when raised; the risen look ghostly in the Beast Pen too; the Hell mode says only a Necromancer can bring a lost pet back.
- **NeuroPets: move tomes (Battle Re-work Part 14).** Six tomes, one a type: each teaches a battle pet a move of that type (not its own), up to its battle level -- two a pet. A tome's move fights with its own type, so a Beast can carry a Bird's Peck against reptiles. **Warden Briar** sells them (2,500 coins) at the Beast Pen; a boss you beat leaves one behind now and then.
- **NeuroPets: the hunt plan's last meal (V3).** When your hunt plan has no food left and you're below its eat line between fights, it brings you home ("Out of food ... hungry, but home before the next fight could finish you") instead of sending you into the next fight. With food in the bag, or healthy, it hunts on.
- **NeuroPets: the final balance pass.** Every class within 15% of the others at every level, measured: the Thief's iron daggers are a little softer (attack 4), and the Paladin's late tree hits harder (**Valor** +12% a rank, **Avenger** +50%). Weapons last 4 to 6½ hours of hunting; hunting pays about 1.05 to 1.7 times the best gathering.
- **NeuroPets: readable at a glance, and in a small window.** Every effect on the fight screen has its own shape and a number (and a label for screen readers); in a narrow window the page title shortens instead of hiding under the top bar's chips, and in a short one the fight scene gives up some height so its buttons stay in view.
- **NeuroPets: the Beast Pen** no longer says the Beast Master is coming "in the next part", and a Necromancer's risen are marked **Risen** there.
- **NeuroPets: the Necromancer (Battle Re-work Part 13).** An Arcane's late magic: bring lost pets back to fight beside you.
  - **The Hollow Crypt:** down a stair from the Misty Isle (bring a lantern), a hunting ground at level 46 -- skeletons, ghouls and crypt bats, and at night wraiths and **wisps**. Wisps are the only creatures that carry **life essence** (about one in eight); they dodge and shrug off blades, so magic and nets do best. The crypt's dead drop **blood essence**, made into **blood runes** at the crypt's **Blood altar** (Runecrafting 45). Its boss is **Morvane the Lich**, who gives up **the Blood Book** the first time you beat her. **Sexton Hobb** lives there (six quests) and sells a little life essence at his stall -- dear, three a day.
  - **The Archmage's offer:** beat him for the top rank at the mage tower and he offers to teach you an older magic. Say yes (now or later -- the offer stands), bring him the Blood Book and 200 blood runes, and an Arcane learns **Necromancy**.
  - **The Necromancy branch** on the Arcane's tree (your points are shared with the other three): stronger risen, Bone mending, Second and Third risen -- or **Sacrifice** a place for your own power -- and **Eternal servants**, which raises your first risen as a fight opens.
  - **Eight spells:** Raise the fallen, Mend the dead and Wither at once; Bone spear, Grave chill, Soul siphon, Army of the dead and Last rites as you put points into Necromancy. Runes: blood and death.
  - **Raising:** your graveyard is the Necromancer's ground. Each headstone has a **Raise** button and its price in life essence (its battle level ÷ 5; pets lost before the update are worked out from their level and rarity). A risen pet is a battle pet again, glad to see you, at the level it had.
  - **In a fight:** *Raise the fallen* brings one in; it strikes every round and takes some of the creature's blows. Only Necromancy and a **potion of life essence** (the apothecary, Herblore 45) heal it. If it falls, it goes back to its grave, keeping its level -- and costs half as much again to raise. It learns from wins at half a battle pet's rate.
  - **A night's vigil** at the graves: now and then a wisp comes to you (once a night, after dark).
  - **New Game Plus:** an Arcane who learnt Necromancy leaves the Necromancer's gift -- three life essence and a **bone staff**.
  - **Balance:** with level-30 risen and its talents, the Necromancer hunts within about 10% of the Arcane and the Beast Master at level 50. Every class can hunt the crypt at 47 within about 15% of the others.
  - Pictures: the crypt's six creatures and six new things are drawn in pixels until their sheets are painted (note 10).
- **NeuroPets: fixes** -- the Blood altar says where blood essence comes from; the balance table no longer loads locked spells into an Arcane's loadout.
- **NeuroPets: a tidier bag (V2's third part).** **Tabs** by kind -- All, Food & healing, Gear & tools, For fights (ammo, traps, nets, poisons, holy water), Materials, Other -- each with how many; an **Order** (rarest first, A to Z, most first); smaller cards, six or more to a row, with the full text on the item's sheet. A search, or **Use with…**, always looks through the whole bag. Bandages and balms say **Use it**, not *Drink it*.
- **NeuroPets: field recipes for every class, from recipe pages (V2, step 2).** The Economist's plan: arrows and bandages for everyone.
  - **Recipe pages:** read one from your bag (like a spell scroll) and its recipe is yours for good. **Ash's notes** (improvised arrows) come from Ranger Ash's *Too many legs*; **Nell's page** (bandages) from Beekeeper Nell's *Stung*. Now and then a creature carries one: foxes, hares, boars, deer and wolves Ash's notes; snakes, spiders, wildcats, bats and stray dogs Nell's page.
  - **Improvised arrows** (a shaft and leaf litter) for any class that has read Ash's notes; Hunters with a knife know them anyway.
  - **Bandages:** a cloth and three herbs make two; a bandage heals 7, in a fight (it costs your next attack) or out of one.
  - The bag's **Field recipes** says how many are still to find, and where pages come from.
  - One home for each recipe still: nothing here is made on a bench.
- **NeuroPets: a fix** -- a recipe page in the bag no longer stops the bag from opening (item descriptions thought every scroll was an enchanting tome).
- **NeuroPets: New Game Plus legacies (Battle Re-work Part 12).** A new game from one that beat the Basilisk now remembers how you played it:
  - **a gift from your highest class:** the Hunter's nets, snares and a knife; the Thief's two daggers and a little poison; the Berserker's maul; the Paladin's buckler and holy water; the Arcane's staff of air and 300 runes; and for a Beast Master, **one battle pet from your old Pen**, back at battle level 5 (you choose which);
  - **free talent points** for that class: one for every 10 levels you had (up to 5), on top of the class's own;
  - **every technique you learned** comes with you (and New Game Plus 1 and 3 each add a technique slot, as before);
  - **prestige marks:** one for each game you finish, shown on your Character sheet's You tab. With three, **one respec a game is free**.
  - The New Game Plus form shows your legacy before you start.
- **NeuroPets: hunting pays like the plan says (C2).** Hunting now earns about 1.1 to 1.7 times the best gathering at your level (it was 2 to 3 times at levels 10-20): the early creatures' drops sell for less (rabbit, quills, fox pelts, venison, silk, bat wings, snakeskin, big-cat pelts, and on the Nile gator hides, viper fangs and hippo tusks), and the purses moved -- the Deep Forest pays a little more, the jungle and the Nile a little less. The drops themselves are unchanged: you still get them for crafting.
- **NeuroPets: the fight's four (C3).** In a fight the same four buttons are always in the same places -- **Fight** (or **Attack** when you choose each move, or **Cast** with a wand or staff), **Special**, **Eat** and **Run** -- and one **Actions** button holds the rest: your style, your class's other specials, Tools, Bash, Swap, and Manual/Auto in a boss fight. Keys **1 to 5** press them (and 1 to 9 pick from a menu).
- **NeuroPets: Use with… in the bag (V2, its first step).** One thing used with another, right in the bag (the team's vote V2, started small with the Hunter's own crafts, as you said):
  - press **Use with…** on a bag card; a bar says what you're using, only the things that go with it light up, and you tap one;
  - a knife in your hand is offered in the bar;
  - the bag lists your **Field recipes**: arrow shafts (knife and twigs or an oak log), bone arrowheads (knife and bones), bone arrows (a shaft, a bone arrowhead and a feather), improvised arrows (a shaft and leaf litter);
  - these replace the four separate buttons the Hunter had;
  - birch no longer whittles with the knife: the fletching table makes shafts from birch, and a recipe has one home;
  - not during a boss fight.
- **NeuroPets: the fight's Actions button only when it has something in it (PT11 x1).** Changing your special is a small **▾** on the Special button now; **Actions** appears only for Tools, Bash, Swap, Style or Manual/Auto.
- **NeuroPets: a new class, the Beast Master (Battle Re-work Part 11b).** Your battle pets fight for you, and **you're never hurt**: the creature attacks your pets (mostly the one in front).
  - **Becoming one:** at the Guild hall, where **Tamsin** stands in for Warden Briar (12,000 coins, 60 treats and 20 grain feed after your first class). Tamsin's quest: win ten fights with your pack.
  - **Your pack:** set it on the Character sheet's **Combat** tab. One pet fights at first (two with Bond's *Second beast*, three with *Pack leader*), and up to two more wait on the **bench**. A bench pet steps in when one faints, or when you swap it in.
  - **Moves:** each type has **7 moves** (42 in all), learned at battle levels 1, 1, 5, 10, 15, 25 and 35. A pet uses **4**, which you choose on its card in the Beast Pen. They're damage, effects (bleed, poison, burn, slow, stun, weaken, broken guard, off balance), a brace, a fade, or a heal (some twice a fight).
  - **Matchups:** creatures have types too. A move strong against the creature hits 50% harder and is marked ⚡; a weak one ▾.
  - **In a fight:** the four buttons are **Moves** (pick a pet's move; it repeats until you change it; left alone, each pet picks for itself), **Special**, **Feed** (food on a pet, 20% less than for you, and it's that pet's turn) and **Run**. **Actions** holds Swap, Specials, and Manual/Auto in a boss fight.
  - **Specials:** **Command** (your front pet acts twice), **Rally** (the pack heals a quarter) and **Wild call** (pets hit 50% harder for 3 rounds, from class level 25).
  - **Crooks** (oak to magic, at your crafting bench) add to your pets' attack and give you a small blow of your own.
  - **Losing and resting:** if every pet in the fight faints, the hunt ends and you come home, unhurt. Fainted pets rest in the Pen. In Hardcore and Hell, beyond the Forest, a pet that faints may die (to the Graveyard, where a Necromancer will one day raise it). Never in Adventure.
  - **Xp:** pets earn battle xp from their wins, and the Beast Master earns Attack and class xp.
  - **The tree:** **Bond** (damage, health, pack size), **Wild** (matchups, effects, battle xp; Apex) and **Keeper** (quicker training, shorter rest, three more stalls; Beast whisperer: the Pen trains pets to level 40).
  - **Techniques:** **Animal handling** and **Tending**. The Beast Master's book is at the Guild hall.
  - **Balance:** one pet of your level hunts about as fast as the other classes (within 15%), but pets eat more food.
- **NeuroPets: the Beast Pen (Battle Re-work Part 11a).** A new place at your estate, kept by **Warden Briar**, for **battle pets**. When a pet hatches, its card asks once: keep it at home, make it your companion, or send it to the Beast Pen (free while it's new). The Warden takes any other den pet for coins (500 to 10,000 by rarity). A battle pet can't come back to the den. Each battle pet has a **type**: Beast, Bird, Water, Reptile, Bug or Spirit (rare, magic kinds), each strong against two and weak to two. It also has its own **battle level** (1 to 50) and health, attack, defence and speed. Put one on **training** for a stat and it gains while you're away, as long as its trough has feed (grain feed or hay from the Farm's Feed store; one feeds a pet 6 hours, **Fill the troughs** fills a day). Training alone stops at battle level 30. A fainted pet **rests** in the Pen, and food cuts its rest short. **More stalls** (12, then 18) need Construction 20 / 40 and coins, and make training quicker. The Beast Master class, its fights and its moves come in Part 11b.
- **NeuroPets: one home for each thing (C4, from I1).** The team looked for double-ups and you chose five to fix. **The hunt plan and how you fight** live on the Character sheet's **Combat** tab; the Hunting page shows one line of your plan with **Change →**. **Your class** is chosen at the **Guild hall**, the first one too; the You tab shows your class and a button there. **Re-tempering** happens only at the **Grindstone**; the Gear tab's wear bars say when a weapon is ready for it. **Your combat levels** are on the Hunting page's strip and the Skills tab; the You tab's card now shows only what your gear adds, your weapon and your meter. **The Spellbook** in the Library is now the **Arcane's book**, opened at its spells: one list of spells, not two. (The Hunting page's line about bone sets now names your own anvil, crafting bench and fletching table.)
- **NeuroPets: the tutorial points at ✕ first (I2).** When a window is open and the next step isn't in it, Amunet's red box goes to the window's close button first, then on to the next place.
- **NeuroPets: quivers.** A new slot on your figure, beside your arrows. A quiver holds so many arrows (or bolts) a hunt, and only up to a certain kind: the **improvised quiver** (twigs and thread, Crafting 2) holds 60 of your own whittled, bone or flint arrows; **leather** (Crafting 12) 200, up to iron; **studded** (Crafting 26) 500, up to mithril; **gator-hide** (Crafting 42) 1,000 of any. With no quiver, or arrows too good for it, you carry a loose handful (50) -- the fight's arrow count shows what's left. An archer's old save is given a quiver that holds the arrows they already use.
- **NeuroPets: the classes, evened out.** Every class now hunts within about 15% of the others at every level: the Thief's two daggers are a touch softer, the Arcane's maple wand and Wind bolt a touch stronger, the Arcane's Avatar and Primal power a little weaker, and the Paladin's True edge has a second rank.
- **NeuroPets: your figure, once.** Your Character sheet's **You** tab is who you are (name, levels, coins, health, class, combat stats); your figure and its slots live on **Gear** only -- the You tab used to show you twice, and Gear a third time.
- **NeuroPets: the tutorial goes to the Guild hall.** After your pet's first expedition, Amunet sends you to the Guild hall to meet a tutor ("Exploring dangerous places isn't only your pet's job"); her farewell gift is now the **Blessing of the Sun** -- Ra's ancient magic, a skill to level 10.
- **NeuroPets: the Guild hall's benches and books** are on parchment, easier to read.
- **NeuroPets: the Guild hall.** In the Village, where the estate's scroll was. **Guildmaster Orla** leads a tour (Amunet sends you when the tutorial ends): meet the five tutors' stand-ins -- **Wren** (for Ranger Ash, the Hunter), **Brakka** (for Old Thorvald, the Berserker), **Ilse** (the Archmage's apprentice, the Arcane), **Pip** (for Nell the Fence, the Thief) and **Brother Aldo** (for Sister Maren, the Paladin). Each explains the class, swears it's the best, and has something to say about the others; each teaches the class's trick with a quest (fill your fury, land ten element effects, dodge ten blows, block five).
- **NeuroPets: switching class costs now.** Your first class is still a free choice. After it, you switch at the Guild hall for coins and the tutor's materials (5,000-8,000 coins), half to go back to a class you've played -- its level and tree wait for you. A save that already had a class gets **one free switch**; in a Developer sandbox switching is free and instant.
- **NeuroPets: techniques.** Each class teaches two (Trap-making, Field dressing, Weapon mastery, Second wind, Rune-saving, Spell focus, Poison-crafting, Pickpocketing, Shield training, First aid). Put a point in a technique's node and it's yours for good, whatever class you become; on the Talents tab, slot up to two from other classes (a third at New Game Plus 1, a fourth at 3) -- they work at 60%.
- **NeuroPets: class benches and class books.** The Guild hall's benches show only a class's own things (made with the same recipes and skills as at home). A **class book** (400 coins) explains everything about its class -- every talent with its numbers, the specials, the techniques, two builds -- made from the game's own data, and you read it from your bag anywhere. (Decided by the team's first vote, V1: 10 to 1.)
- **NeuroPets: what's on you, in the fight.** Bottom left of the battle scene: the arrows left in your quiver, the hits left on your blade's poison or blessing, and your potions -- each turning red when it's nearly out.
- **NeuroPets: Specials without scrolling.** In a fight, **Specials** opens every special your class has, with its cost and whether it's ready: pick one and it becomes your special -- and goes off at once if you can pay for it. Special still fires the one you have.
- **NeuroPets: the Paladin's shield bash in the hunt plan** now goes off on any creature whenever it's ready (it waited for dangerous ones, so it seemed not to work).
- **NeuroPets: sandbox class levels.** In a Developer sandbox, the class level on the Talents tab is a button: set it, and your talent points with it.
- **Collaboration: votes and concerns.** A **Vote** (V1, V2 ...) holds every stakeholder's ballot and reason, your vote and your override, and counts them; a majority decides. Section heads raise worries as **Concerns** (C1 ...), each saying who raised it. **+ Vote** and **+ Concern** start your own.
- **NeuroPets: a new class, the Paladin.** A sword and a **shield**, and **devotion**. Shields go in the off hand (click it on your figure): a wooden buckler made at your crafting bench, kite shields bronze to rune at the anvil. A shield counts as armour and **blocks** -- a blocked blow does nothing. In a fight, **Bash** hits lightly with the shield and stuns the creature for a round; then your shield arm rests 4 rounds (and stuns get shorter the more often you land them). Your hunt plan can bash whenever it's ready. **Devotion** builds as you block and as you're hit, and lasts the whole hunt (it fades when you come home); it pays for **Lay on hands** (a third of your health back, for your turn), **Smite** (80% more damage, three times as much against the undead) and **Aegis** (for 3 rounds nothing gets past your shield). Or fight with **a sword in each hand**: two blows a round, a little softer, and no shield. **Holy water** (the apothecary table: silver, lavender, a pot of water) blesses your blade for 30 hits. A Paladin trains Attack and Defence half each. Three talent branches: **Crusade** (the sword, Smite, two blades; Avenger), **Bulwark** (block, the bash; Bastion) and **Grace** (devotion, healing; Sanctuary -- once a fight, the blow that would fell you is blocked). Sister Maren and the Village chapel come with the Guild hall (Part 9).

## 1.0.116 — Battle Re-work, Parts 1 to 7: the off hand, weapon wear, no auto-heal, class levels and skill trees, the Hunter's traps and nets, the Berserker's fury, the Arcane's elements, the Thief; Collaboration (15 October 2026)

- **Scribe → Collaboration.** A shared desk for Cam and Claude. Claude leaves **play tests** (things to try, each with ✓ Works / ✗ Problem / – Didn't try and a note) and **questions** (choices, with Claude's recommendation marked) as forms; you fill them in and press **Done — over to Claude**. Start your own with **+ Bug**, **+ Idea**, **+ Play-test notes**, **+ Note** or **+ Question**. Every document has a short code (PT1, Q2, B3 …), so a prompt can just say "refer to PT1". Everything saves as you type; deleting moves a document to a deleted folder.

- **NeuroPets: a new class, the Thief.** Daggers or a bow (Attack or Ranged), and poison. A **dagger in each hand** stabs twice a round, each a little softer. **Poisons and venoms** -- weak, strong and deadly poison, paralytic and weakening venom, made at the apothecary table (strong and deadly need a **venom sac**, dropped by snakes and spiders) -- coat your blades from the bag for so many hits, and each hit that lands may poison (armour doesn't help), stun or weaken. **Throwing knives** (the anvil) are the Thief's Tools in a fight: a throw hits and carries your poison, and half come back after a win. Specials: **Backstab** (daggers), **Envenom** (the next hit poisons for sure) and **Smoke bomb** (the creature can't find you for 2 rounds). Three talent branches: **Venom** (poisons that stack, Black blood), **Shadows** (dodge, more coins from kills, Shadowstep strikes back when you dodge) and **Blades** (dual daggers, knife throws, Thousand cuts). Pickpocketing and the Thief's tutor, Nell the Fence, come with the Guild hall (Part 9).
- **NeuroPets: change gear right on your figure.** Click a slot on your figure (You or Gear) and a small list opens by it: what's in the slot (Take off) and everything in your bag that fits, with what each does -- greyed with the reason when you can't wear it yet. No more jumping to a list of selectors. Your pet has a figure on the Gear tab too, its slots around it, the same way. The Gear tab keeps your weapons' wear, re-tempering and tools.
- **NeuroPets: set a skill's level in the sandbox.** In a Developer sandbox, clicking a skill on your Character sheet's Skills tab asks for a level and sets it -- quick to test things that need one; and Dev tools' **Add item** and **Add everything** ignore the bag's room (a full bag no longer stops them).
- **NeuroPets: the Arcane's elements.** Every spell has an element, and when it lands it may leave its mark: **fire** burns for a few rounds, **water** slows (the creature acts every other round), **earth** breaks its guard, and **air** knocks it off balance (its blows land less often). Creatures have elemental weaknesses and resistances -- spiders and the creatures of the cold fear fire, the desert's water; crabs and river beasts shrug water off, the heavy beasts the wind. The Cast menu marks a spell this creature is weak to (⚡) or resists (▾), and the Spellbook says what each element does.
- **NeuroPets: battle staves.** Two-handed staves made at the altar: oak, maple, yew and magic-wood **battle staves** cast like a staff, and out of runes they're a real weapon -- swung with your Magic, not a feeble bash. **Air, water, earth and fire battle staves** also give their element's runes free and make its effect likelier; at the enchanting table they become the **battle staves of storms, frost, draining and burning** (a second cast now and then, longer slows, healing from your spells, fiercer burns).
- **NeuroPets: the Elements branch and a 4th spell.** The Arcane's third talent branch: likelier and fiercer element effects, more damage, and the keystone **Avatar of the elements** (+12% to a creature under your element's effect). In Arcana, **Fourth sigil** (a 4th spell in your loadout) is now the choice beside Potency. Every class's tree is whole.
- **NeuroPets: the Berserker's fury.** A Berserker's specials now run on **fury**, a second meter that builds as you hit and get hit (the bar on your fight card turns red) and lasts the whole hunt until you spend it -- it fades when you come home. Press Special mid-fight, or between fights for the next fight's first blow. The blow that finishes a creature counts too, but not the damage past its last health. The other classes keep their special bar.
- **NeuroPets: Bloodlust.** From Berserker level 25: a blow, and for three rounds after, you heal a fifth of the damage you deal -- the Berserker's only heal, paid in fury.
- **NeuroPets: the Berserker's arms.** Smithed at the anvil, bronze to rune: **longswords** (a little stronger than a sword), **mauls** (both hands, a heavy blow every other round that can stun -- they eat less food, and wear twice as fast a blow), **maces** (crush, for anyone -- good on shells), and **spiked gauntlets** (bronze to adamant, worn on your hands: with no weapon to hand you hit with them, not bare fists, and they can make it bleed).
- **NeuroPets: the Bloodrage branch.** The Berserker's third talent branch: more fury, Pain feeds (fury from the blows you take), Second wind (once a fight, at a fifth of your health, a tenth back), **Bloodletter** (Bloodlust heals 30%) or **Berserk** (Rage costs you less), and the keystone **Red mist** (+15% damage while your fury's 50 or more). Momentum, in Slaughter, now gives fury too.
- **NeuroPets: the Hunter's traps and nets.** A Hunter can now press **Tools** in a fight to lay a snare or a bear trap (one a fight) or throw a net: it takes your attack, and the creature loses its turns for a round or more -- longer the further your class level is above it, shorter each time it's caught in the same fight, and only half as long on a boss. Bear traps also snap and make it bleed; a spiked snare bleeds; a fire net burns. The menu says how long each would hold the creature in front of you ("won't hold this one" when it can't). Snares are made at your crafting bench (a twig snare at Crafting 3), nets at the spinning wheel, bear traps at the anvil. Snares are used up; a net, or a bear trap, is picked up again after a fight you win (half the time for a net, nine times in ten for a bear trap).
- **NeuroPets: creatures shrug some things off.** Birds and bats aren't caught by a snare on the ground, spiders walk out of nets, crabs, armadillos, scorpions and the Pyramid's dead don't bleed, snakes slip snares and big beasts tear nets.
- **NeuroPets: traps in your hunt plan.** Hunters can have the plan lay a trap as each fight opens and throw a net when the creature's above a line -- on dangerous creatures only (a boss, or one that could finish you in five blows: a trap on a rabbit only costs your first blow) or on every creature. It uses your cheapest unless you pick one, and never one that can't hold.
- **NeuroPets: the hunting knife.** Six knives, bronze to rune, smithed at the anvil: a Hunter's off-hand weapon for when the arrows run out. It stabs with your Ranged skill, and now and then twice.
- **NeuroPets: Hunters live off the land.** A Hunter with a hunting knife can whittle twigs (one arrow shaft each) or a birch or oak log (three) into arrow shafts straight from the bag, and make **improvised arrows** from a shaft and some **leaf litter** -- no feathers, no heads. Leaf litter now falls when you cut wood in the twiggy woods (prunings, hedges, the copse, the oak forest, the ash stand). Both give Fletching xp.
- **NeuroPets: more of the Hunter's living off the land.** With a knife, from the bag: carve **bones** into bone arrowheads (three a bone), and make **bone arrows** from a shaft, a bone arrowhead and a feather -- as good as bronze, no smithing. A Hunter **plucks** the birds they kill for extra feathers, and **field dressing** now and then gives an extra hide, pelt or piece of meat. Whittling twigs gives a little less Fletching xp than before (logs as the bench).
- **NeuroPets: a hunting ground above your level says so.** Clicking it on the map shows a notice with the level it needs, instead of opening the battle screen of your last hunt.
- **NeuroPets: the Trapper branch.** The Hunter's third talent branch: traps and nets that hold longer, barbed jaws, a net mender, **Second snare** (two traps a fight) or **Ambush** (an opening trap that doesn't cost your attack), and the keystone **Killing ground** (a trapped or netted creature takes 25% more from every hit).
- **NeuroPets: Ranger Ash teaches Hunters.** Ash in the Forest is the Hunter's tutor, with a first quest for Hunters only: *The trapper's trade* -- catch 5 creatures in traps or nets, for a hunting knife, snares and nets.
- **NeuroPets: class levels and skill trees.** Your class has its own level now, earned from the Attack, Ranged, Magic and Defence xp you get while you're that class. Your first class starts at the level of its own combat skill; a class you switch to starts at 1 (your combat skills stay as they are). Every 2 class levels give you a **talent point**, spent on the Character sheet's new **Talents** tab: three branches a class, Diablo-style, each tier opening after 3 more points in its branch, some nodes a choice of one or the other, and a keystone at the bottom. Talents add accuracy, max hit, defence, dodge, cheaper or faster specials, fewer arrows or runes used, more damage to bosses and so on -- about 12 to 20% more kills an hour with a full tree. **Respec** is free to class level 15, then costs coins (more each time); you can save **two builds** a class and switch between them at home. Branches marked "later" (the Hunter's traps, the Berserker's fury, the Arcane's elements) arrive with their class's own part.
- **NeuroPets: the Character sheet.** One page for you, with tabs: **You** (your figure with every gear slot around it -- click one to change it), **Skills**, **Gear** (yours and your pet's, the off hand and weapon wear), **Combat** (how you fight, your hunt plan, and choosing your three spells) and **Records**. Your name in the top bar opens it; so does the door in your House. The Bag stays its own page. Equipment has left the Storeroom, and the Library's **Spellbook** is now a pop-up reference -- the Magic level each spell unlocks at, its element, max hit and runes -- with a button to choose your three on the sheet.
- **NeuroPets: from the Forest on, nothing runs for you.** On the Farmyard, Pasture and Meadow a fight still runs for you when one more blow could finish you; further out you eat or press Run yourself -- or fall. The fight warns you when you're one blow from the end.
- **NeuroPets: pick your spell, like a battle move.** In a fight with a wand or a staff, **Cast** lists your three spells and what each costs in runes; the one you pick is your next cast (in a manual fight, picking it is your move). Otherwise you cast as before: the first in your loadout you can pay for.
- **NeuroPets: the Grindstone.** A new bench in the Smithy, beside the furnace and anvil: every weapon you hold or carry, how worn it is, and its one re-tempering.
- **NeuroPets: two sandboxes.** Developer → Dev tools now switches between **Everything unlocked** (infinite items, every level -- the sandbox as it was) and a **Plain account** that plays by the game's rules (arrows run out, weapons break), where you add what you need. Each keeps its own game. Weapons now wear in the sandbox too.
- **NeuroNet: safer data folder.** NeuroNet only ever moves a data folder into a real NeuroNet folder. (A test run from NeuroNet's test folder moved the data into it on 15 October; it was moved straight back with nothing lost, and the tests now check for it.)
- **NeuroPets: no auto-heal.** Nothing eats for you in the middle of a fight any more, and time doesn't heal you during one (it still does between hunts, at home and in your bed). Press **Eat** in a fight: it costs your attack, as it always has. If one more blow could finish you, you now get the gap between rounds to eat before you run for it.
- **NeuroPets: your hunt plan.** On the Hunting page: the food you **eat between fights** and the line you eat below, and **come home below**. Between fights it eats past your line if it needs to, so one blow can't finish you; if you had to run from a fight, it eats and you hunt on, coming home only when the food runs out.
- **NeuroPets: specials are yours.** The "use it on its own" tick is gone: the bar fills and waits for you to press **Special**.
- **NeuroPets: hunting pays less.** A kill's purse is lower, so an hour's hunting earns about 1.4 times the best gathering at your level, drops included (it was 2 to 6 times). A boss left to fight on its own is never won; played, with food, about half to three-quarters are.

- **NeuroPets: an off hand.** On the Equipment page, carry a second weapon in your **off hand**. It's used when your main weapon can't be: a bow with no arrows, an Arcane out of runes (you fight with it instead of bashing with your staff), or a main weapon that broke. With both gone you fight with your fists. In a fight, **Swap** puts it in your hand (it costs your next attack); between fights, Swap is free.
- **NeuroPets: weapons wear.** Every swing, shot or cast wears your weapon: about 3 hours of hunting for a bronze one, up to 6 for the best. You're warned at three-quarters and nine-tenths, and when it breaks the next one in your bag, your off hand or your fists take over in the same fight. Your fight card shows both weapons with their wear.
- **NeuroPets: re-tempering.** Once a weapon is three-quarters worn, you can **re-temper** it on the Equipment page for a third of what it's made of (a weapon nobody makes: a third of its price in coins). Once only; after that, make another.
- **Behind the scenes:** fights can now hold **effects** (trapped, netted, stunned, poisoned, bleeding, burning, slowed, weakened, broken guard) with diminishing returns, ready for the class parts to use. Nothing puts them on yet. Pets that die are now kept whole in the graveyard, and saves have room for battle pets. A new balance table, `tools/balance/classes.js`, measures each class.

## 1.0.115 — NeuroPets: content in JSON, the place editor, quicker Husbandry (15 October 2026)

- **The NeuroPets and NeuroFarm desktop widgets are gone.** Nobody used them any more, so the pet and farm cards are off the desktop board and out of Settings → Desktop widgets. The games themselves are unchanged (Super+Alt+G and Super+Alt+Y). An update takes the old cards and their `neuropets-call` / `neurofarm-call` commands away.
- **NeuroPets: the game's content is JSON.** Items, workshops and recipes, gathering spots, monsters, people, prices and tiers now live in `ui/pet/content/` (one file per part of the rules), so they can be read and changed without touching code -- the groundwork for editing content in the Modder. The game plays exactly as before.
- **NeuroPets: the place editor.** In the sandbox (Developer), **Place editor** shows a painted scene with every place's scroll: drag a scroll onto its painted sign, drag its dot onto the thing it names, pull the corner to size it, or type the numbers. Places the game expects but the painting doesn't have yet are listed, one click to add. **Save places** writes them (`ui/pet/art/places.js`) and the game uses them at once -- a new painting takes minutes to wire up, not an hour of measuring.
- **NeuroPets: Husbandry is three times quicker.** Everything you do on the Farm (collecting, feeding, mucking out, brushing, building, the churn and shelves, shows) gives three times the Husbandry xp. A full farm reaches level 50 in about two weeks instead of five; a normal one in three or four weeks instead of about ten. Fern's quest rewards are the same as before.
- **NeuroPets: provisions are on.** The "Take provisions" tick by Set sail now starts ticked: if you have 3 smoked fish, the crew eats them, the voyage takes half the time and you land rested. Untick it to keep the fish (for a harbour contract) -- NeuroPets remembers.

## 1.0.114 — NeuroPets: Cook all (14 October 2026)

- **NeuroPets: Cook all.** In the kitchen, a recipe you can cook more than once has a **Cook all (n)** button beside Cook: it cooks as many as your ingredients allow in one go, with the same food, xp and leftovers as cooking them one by one, and one line to say so. The other benches (the forge, the loom, the apothecary table and the rest) get the same as **All (n×)**. Your records count every one.

## 1.0.113 — NeuroNet without Omarchy (CachyOS, KDE, a new computer in one step), and the Farm's extras (14 October 2026)

- **NeuroNet can live on any Arch computer with Hyprland or KDE Plasma, without Omarchy** -- the app, NeuroPets and NeuroFarm, their launchers and the Super+Alt shortcuts, without the desktop widgets. `bash system/install-app.sh` sets it up; it notices KDE or Hyprland by itself, leaves out any key that's already taken (and says what has it), and `--uninstall` takes it out again. Your data is never touched.
- **KDE Plasma:** the same keys, as KDE shortcuts (System Settings -> Keyboard -> Shortcuts -> NeuroNet, to change them). NeuroNet starts hidden at login; a tool's key floats it over what you're doing and the same key puts it away; Super+Alt+O is the whole app, maximised. Capture (Super+Alt+X) uses Spectacle. On a stock KDE, Super+Alt+R is Spectacle's screen recording, so the Kitchen key is left off until you free it.
- **A new computer in one step:** `bash install-neuronet.sh` from the update bundle downloads the newest release into ~/NeuroNet, installs it for that desktop and switches daily updates on. Updates on such a computer refresh its shortcuts too, and a hidden NeuroNet restarts into the new version.
- **Your drives come back by themselves on a fresh install:** `bash system/drives.sh save` remembers them (done for this computer), `sudo bash system/drives.sh restore` sets them up again at the same places.
- The updater's tools (git, rsync, ssh) are now installed with NeuroNet.
- Behind the scenes: a CachyOS test in Docker (`system/vm/cachyos-docker.sh`, `--kde` for KDE), and tests for the installers, the drives and the KDE keys.

- **NeuroPets: the Farm is repainted** with five new places, and each one is open at its Husbandry level:
  - **The Beehives** (Husbandry 4): bee colonies from Fern's stall fetch their own flowers -- no feeding, no mucking out. **Honey** every 12 hours, **beeswax** every other round. The candle bench beside them makes **beeswax candles** (3 wax and a thread make 2).
  - **The Windmill** (Husbandry 12): grinds oats into **flour**; the kitchen bakes **bread** from it (Cooking 6).
  - **The Greenhouse** (Husbandry 18): beds under glass, no watering. **Tomatoes** (tomato seed from Marlow, 8 hours), strawberries, pumpkins and melons, while you're away.
  - **The Smokehouse** (Husbandry 22): trout, herring or salmon with an oak log hang for 6-8 hours and come down as **smoked fish**, which heals more than any cooked fish of its kind.
  - **The Show ring** (Husbandry 28): one animal a day. The judges like a brushed, mucked-out animal, a yield star and a rare breed. First prize is a **blue rosette** and 300 coins, second a **red rosette**; three firsts make a champion, with a **silver cup** and 1,500 coins.
- **Fern has four new errands**: honey, bread, smoked fish, and a blue rosette.
- The Paddock keeps its place on the Farm map (in the horse field), and the horses walk there now.
- **Time on the Farm pays now.** Every animal earns back what it cost within about three weeks, selling its goods as they come (hens and bees in under a week), and more if you make them into something:
  - more from each round: hens lay 2 eggs, cows give a pail of 4 milk, goats 3, ducks 2 eggs, sheep 5 wool twice a day, pigs 6 truffles, ponies and draft horses twice the horsehair;
  - and they cost less: a cow 900 (was 2,500), a goat 700, a sheep 800, a pig 1,200, a duck 300, a bee colony 300;
  - the shelves give back at least twice what goes on them: 2 cheeses from 4 milk, 3 yoghurts from 2, 8 tomatoes a seed, 5 smoked fish from 3 salmon; cheese, butter, cream, honey, candles and duck eggs are worth more;
  - taking a batch off a shelf gives Husbandry xp too (and Cooking xp for smoked fish, Farming xp for the Greenhouse).
- **Smoked fish is worth smoking:** it sells for more than cooked herring, heals as much as swordfish, and it **keeps for a voyage**: tick *Take provisions* when you set sail (the Shipyard, the sea chart, or Sail home on an island) and 3 smoked fish halve the voyage, and you step ashore rested -- full health, your pets refreshed. The tick stays off until you choose it, so fish you're carrying for a contract aren't eaten.
- **The harbourmasters want the Farm's goods**: smoked fish at both docks, cheese, honey and candles at Sandport, wool, butter and candles at Frosthaven. A contract pays twice the price and trains Husbandry.
- Every item now has its own painting (the tomato seed was the last).
- **Your estate is on the main island's map** now, by the Mage tower's path, and in the list under the map -- no more going through the Village (the Village keeps its door too). Back from the estate goes to the Map. (The Desert and Frostpeak estates stay in their towns.)
- Behind the scenes: the game's screens are split into parts like its rules, a real-browser test suite opens every page and plays the Farm, the Shipyard and the map, the hunt page redraws a little less often, and the pet room's picture is smaller in memory.
- **The early levels go quicker.** Every skill levels faster while it's young, easing off by level 30: about a quarter less time to reach level 30 (roughly 18 hours of gathering a skill instead of 23), while level 50 takes much the same.

## 1.0.112 — NeuroPets: Gifted pets, and a cosy den (12 October 2026)

- **NeuroPets: Gifted pets.** Out gathering, very rarely, a young animal follows you home -- one for each gathering skill, ever: a snow hare (Foraging), a selkie seal (Fishing), a mountain goat (Mining), an elk (Lumbering) and a velvet mole (Digging). Each is a natural at its skill, has the best potential, and the new **Gifted** nature, which doubles its help as your companion. The higher the spot, the likelier (roughly a hundred hours' gathering at level 50). Your Records count how many you've found.
- **NeuroPets: a cosy den works harder.** Your den pets live in your pet's room: a bed, a toy box and a rug each make them 3% quicker out gathering (10% with all three). The Pets page says how your room's doing. (Your companion's help already doubles while it's happy, and a pet with ★ beside a skill is still a natural at it: 20% quicker.)

## 1.0.111 — NeuroPets: what's next, and your records (12 October 2026)

- **NeuroPets: What's next.** The Player page lists, for every skill, the nearest level that opens something new -- a spot, a recipe, a building, a region -- with the xp still to go, nearest first.
- **NeuroPets: Records.** Also on the Player page: creatures and bosses beaten, quests done, pets found and lost, animals on the Farm, coins earned and spent, things made, trips and hunts, and your best skills. Coins, things made, trips and hunts are counted from your first action after this update.
- **NeuroPets, behind the scenes:** names you type (you, your pets, chests) are kept without tags or odd characters. The balance tool now reaches the island hunts, counts the coins hunting earns, and weighs up every farm animal.

## 1.0.110 — NeuroPets: the whole Farm (12 October 2026)

- **NeuroPets: every part of the Farm is open now**, each at its Husbandry level, painted on the Farm map:
  - **The Duck pond** (Husbandry 8): ducks on grain feed give **duck eggs**, and **down** now and then.
  - **The Shearing shed** (Husbandry 15): sheep on hay give an armful of **wool** a day. With a dog as your companion, shearing comes round a fifth quicker.
  - **The Culture room** (Husbandry 20): milk set on its shelves becomes **yoghurt** (12 hours), **cheese** or **goat cheese** (24 hours).
  - **The Pigsty** (Husbandry 25): pigs on potatoes root up **truffles** every 12 hours -- a steady supply at last.
  - **The Stable** (Husbandry 30): **ponies** (on hay) and **draft horses** (Husbandry 40, on oats) give horsehair, and pull the bigger carts: the **pony cart** needs a pony and a **harness**, the **wagon** a draft horse and a **horse collar** (both sewn at the crafting bench), and the **merchant's wagon** two draft horses and Marlow's word, after 25 cart loads.
  - **The Paddock** (Husbandry 35): put two of a kind out together, and a young one comes home in 1 to 4 days. It takes after a parent; now and then it's a rarer breed (a Jersey or Highland cow, a black sheep, a grey goose, a Shetland pony, a dapple grey) or bred for yield (up to ★★★: a little more, more often). It grows up in as long again, and rare or starred animals sell for more.
- **Caring for them:** **Brush** each building's animals once a day, as well as mucking out, for a little more for a day. **Feed everyone** and **Collect everything** do the whole Farm at once. A cat as your companion keeps the mice off the feed, so it lasts a quarter longer.
- **Saturday's farmers' market:** Fern's stall pays half as much again as Marlow for what the Farm makes.
- **Five more farm dishes:** duck egg omelette, honey yoghurt, cheese omelette, cheese pie and a cheese board. **Fern has five more errands**, ending with one for an animal born on your Farm.
- **The Today page** shows what's ready and who's hungry on the Farm, and the cart on its way to Marlow. The level-up pop-up lists what each Husbandry level opens.
- **Animals walk about** in their yards on the painted Farm.

## 1.0.109 — NeuroPets: the Farm; Notes: separate vaults (12 October 2026)

- **NeuroPets: the Farm opens (step 1).** Past the Graveyard on your estate, an old farm track runs off into long grass, and **Fern the farmer** is leaning on the gate. Her quest, **"A farm of your own"** (Farming 10, Construction 10, 40 planks, 10 rope, 30 potatoes), opens **The Farm** and a new skill, **Husbandry**.
  - **The chicken coop** comes with two hens. Hens lay an egg every 4 hours while they're fed, with feathers now and then. Eggs wait in the coop (three rounds a hen at most) until you collect them. A hungry hen just waits; nothing dies.
  - **Mucking out** once a day gives dung for the garden, and a clean coop lays extra eggs for a day.
  - **The Feed store** mills potatoes and carrots, or cabbages, into grain feed. One bag keeps a hen fed for 12 hours.
  - **Fern's stall** sells hens (200 coins) and takes them back (100).
  - **Build the coop up** Sturdy, Fine and Grand for room for 4, 6 and 8 hens, each a little quicker.
  - **Fern has five more errands** once the Farm is yours.
  - **Feed from your garden:** two new crops, **meadow grass** (Farming 8) and **oats** (Farming 12), with their seeds at Marlow's. The Feed store turns meadow grass into **hay**, and oats or sweetcorn into more grain feed.
  - **The Barn** (Husbandry 5): **cows** (2,500 coins) give **milk** every 8 hours while they're fed on hay, and **goats** (Husbandry 12) give goat milk every 6 hours. It builds up to Sturdy, Fine and Grand for 4, 6 and 8 animals.
  - **The Dairy** (Husbandry 10): its butter churn turns milk (or goat milk) into **cream**, and cream into **butter**.
  - **Ten farm dishes** at the kitchen, Cooking 5 to 32: porridge, custard, mashed potatoes, strawberries and cream, cream tea, carrot cake, buttered fish, custard tart, truffle omelette and truffle stew.
  - **New paintings:** the estate has the Farm signpost and the Cart shed painted on, the Storeroom has the Recycle stash and Recycled materials, and the hens on the Farm are grown-up hens. There are new icons for the Farm's places, the carts, grain feed and the Husbandry skill.
  - **The Farm is painted:** the coop, the Barn, the Dairy, the Culture room, the Shearing shed, the Pigsty, the Stable, the paddocks, the Duck pond, the Feed store and Fern's stall. Each scroll shows what's going on ("4 ready", "Hungry"). Places still to come show the Husbandry level they open at.
- **Notes: folders start folded.** Opening Notes no longer shows every folder spilled open. Each folder starts collapsed (except the ones holding the note you have open), and anything you open or fold yourself stays that way.
- **Notes: separate vaults**, like Money's cash books. A bar at the top of the Notes sidebar shows which vault is open.
  - **New** makes a vault of its own, which starts empty, with its own notes, folders and pictures.
  - **Rename** works on any vault, including your first one ("Main vault").
  - **Delete** sets a vault aside in notes/deleted vaults rather than erasing it.
  - Switching saves what's open and closes its tabs.
  - Fleeting notes, the desktop board and notes that ship with releases stay with the main vault.
- **Notes: move notes and folders to another vault.** Right-click → **Move to…** now has a vault chooser at the top. Pick another vault, then its top level or one of its folders. The pictures the notes show go with them (copied, so the vault you're in keeps its own). A picture whose name is already taken there is renamed, and the notes are updated to match.
- **Notes: the sidebar shows what's on disk.** Notes written from outside the window (shipped notes, desktop Fleeting notes, notes Claude writes) used to stay hidden until something in Notes refreshed it. Coming back to Notes, or to the window, now reads the folders again.
- **Notes: folder arrows the right way round.** A folded folder's arrow points right and an open one's points down. Folded ones pointed up before.

## 1.0.108 — Money: a cash book for each person (11 October 2026)

- **Money: a cash book for each person.** Cash books are now whole, separate budgets for different people, each with their own income, bills, recurring payments, one-offs and savings goals. **New cash book** asks whose it is and starts empty; copying the open one is still an option. Every cash book can be renamed, including your first one (call it by your name instead of "Main").
- **Money: Compare, for two people.** Each person's income, bills and what's left over sit side by side, with a **Together** column that adds them up as a household. Differences show plainly as ▲ / ▼, with no "better off" colouring. Lines only one person has say "only in Sarah's".
- **Printed Money books from any cash book** show on the desktop Bookshelf, named for whose they are.

## 1.0.107 — Money: cash books and Compare (11 October 2026)

- **Money: cash books.** Besides your Main cash book you can now keep others -- a "what if" budget, say. A bar above every Money page shows which one is open and switches between them; **New cash book** starts one as a copy of the open one (then change what you want to try) or empty, and each can be renamed or deleted. Everything in a cash book -- recurring bills and income, one-offs, savings goals, the calculation -- is its own; nothing you do in one touches the others, and your Main book is exactly as it was.
- **Money: Compare.** A new page (in Money's menu, or the bar's Compare button) puts two cash books side by side for a month, a fortnight or a year: income, bills and what's left over in each, and the difference; then every income and bill line matched by name (with "only in…" for lines one book doesn't have), and bills by category. Green where the second book is better off.

## 1.0.106 — NeuroPets: lighter when you've been away, the skill registry (11 October 2026)

- **NeuroPets runs lighter when you've been away.** The game writes a checkpoint when you open it, every few minutes, and when you come back to the window, so it no longer works through all your time away on every redraw (a save left hunting for a day took up to 0.4 s per redraw; now well under a millisecond).
- **NeuroPets, behind the scenes: a skill registry.** Every skill is declared once, and the rules, the pages and the Player page read it, so a new skill (Husbandry, for the Farm) is one entry plus its content and art. Nothing in the game changes.

## 1.0.105 — NeuroPets: Amunet's tutorial, deleting saves (11 October 2026)

- **NeuroPets: a tutorial.** A new game now starts with **Amunet**, the island's keeper, in the Pharaoh's crown and robe: "Hello there, welcome to Neurovale..." She asks whether you're a boy or a girl and your name (all in her window), then walks you through everything one step at a time, waiting while you do each thing. A **red box grows and shrinks over the next thing to click** -- the Map, the Estate, the building, then the button -- and "Take me there" jumps straight to the place (she steps aside if she'd be in the way). She covers your first egg, pet care, your stats, gathering, chests, the recycle stash, cooking (with the shrimps and twigs to cook) and stews, crafting, the three fighting styles (a starter kit for each: a bronze sword, a short bow and arrows, a willow wand and runes), armour, battles, Farmer Giles's first quest, growing your pet up (an Elixir of Growth) and its first expedition (which she opens for you), and the many islands of Neurovale. At the end: a **Rare egg, 5 Iron crates and a skill of your choice raised by a full level 1-to-10's worth of xp**. Tuck her away with "–", skip a step or the tutorial; start it again from Settings (gifts only once).
- **NeuroPets: every story chapter shows the Unlocks pop-up**, with what comes next -- Farmer Giles's first chapter showed nothing before.
- **NeuroPets: delete a save.** Every save slot has a Delete button (asked twice). Deleting the game you're playing starts that slot afresh -- with the tutorial.

## 1.0.104 — Notes ship with releases (11 October 2026)

- **Notes: ship notes with releases.** Right-click a note or a folder in Notes and tick **Ship with releases**: it travels with each release to your other computers, like the recipes and Training already do (a folder brings everything in it, and a note brings the pictures it links to). A small ⇪ mark shows what ships. On the other computer a note is added, or updated if nobody changed it there; a note edited there is kept, and one deleted there stays deleted. Renaming or moving a ticked note keeps it ticked.
- **Shipping now:** the NeuroPets, NeuroFarm and NeuroNet notes, the NeuroPets audit and bug notes, and the Monday circuit session. Personal notes stay on this computer.

## 1.0.103 — NeuroPets: no pixel art left on the region cards and in the pet's room (11 October 2026)

- **NeuroPets: no more pixel art on the region cards.** Deep Jungle, Crystal Caves, Misty Isle and Frostpeak showed old pixel creatures; they now show the painted pet that hides there. The pet's room shows the rug that's actually down, and food and medicine floating over your pet are painted.

## 1.0.102 — NeuroPets: every outfit and every pet painted, hunting fixes, the Floral rug (11 October 2026)

- **NeuroPets hunting fixes** (from Cam's note):
  - **"‹ Farmyard" from a hunt goes back to the Farmyard**, not the whole island map.
  - **Beat a boss and you go straight back to hunting there** (unless you're too hurt), so hunting carries on while you're away -- and the battle screen follows it on its own, no click needed.
  - **A boss's armour and weapons now need that boss beaten 5 times** before they can be made (Gideon's Nimble Fox and Sly Striker, Billy's Ram-horn Brawler, Jack's Fleet, Bambi's Sylvan, Snapjaw's Snapshell, Grizz's Grizzly, the Basilisk's Gorgon Scale, and the Yeti-fur coat). The boss's card shows how many wins you have, and the 5th win tells you it's open. Gear you already have is yours to keep.
  - **Challenging a boss is one click** -- no warning box.
  - **A ready special flashes bright yellow** (it was fading in and out, looking greyed out), and you can press it between fights too: it goes off on the first blow of your next fight.
  - **The special bar fills up now.** Before, a chosen special went off on its own as soon as the bar had enough, so it never filled and the Special button never could. Now the bar fills to 100% and you press Special in a fight; tick "Use it on its own" on the Hunting page if you'd rather it fired by itself (handy when you're away).
- **NeuroPets: every outfit you can see on you -- all 30.** The last ones are in: Armadillo, and the mage's hats and cloaks (Wizard, Apprentice, Adept, Mage, Sorcerer, Archmage). Cloaks hang behind you. Bat leather's wings and the Ram-horn Brawler's shoulder spikes now stay on the body armour instead of being cut off.
- **NeuroPets: the last 14 pets are painted** -- the Golden Cat, Moon Bunny, Ember Frog, Wild Cat, Gideon Fox, Billy the Kid, Deathstalker, King of the Nile, Sphynx Cat, Ice Wolf, Snowy Owl, Polar Bear Cub, Storm Owl and White Whale, in all three poses. No pixel pets are left.
- **NeuroPets: messages show above pop-ups.** "You made…" and "Your bag is full" now appear at the bottom right on top of the crafting window, not hidden behind it.
- **NeuroPets: two rugs.** The crafting bench had two Woven rugs. The one made from wool stays the Woven rug (stays clean 25% longer); the one made from flowers is now the **Floral rug** (30% longer) -- and costs a fair bit more: 80 flowers, 50 herb leaves and 2 cloth, from Crafting 12. Put one down where the other is and they swap (the old one goes back in your bag).

## 1.0.101 — NeuroPets: 22 outfits you can see, the cart, recycling points (11 October 2026)

- **NeuroPets: 22 more outfits you can see** -- iron, steel, mithril, adamant, rune, both bone sets, soft and hard leather, snakeskin, bat leather, Nimble Fox, Ram-horn Brawler, Fleet, Sylvan, Grizzly, Gorgon Scale, Snapshell, the cloth hood and cotton shirt, the Yeti-fur hood and coat, the Nemes and linen robe, and the Pharaoh's crown, robe and sandals. Mix and match any pieces; they show on the young man and the young woman, standing and in fights.
- **NeuroPets: the cart.** Build a cart shed on your estate (beside the Storeroom) and load the hand cart from your bag, your chests and the recycled materials. Send it to Marlow and, 4 hours later, it comes back with his full price. Ten kinds a load; the one you're wearing or using, crates, keys, tomes and eggs never go. The pony cart, the wagon and the merchant's wagon (faster, bigger, and +10% for the last) wait for animals from the Farm's Stable.
- **NeuroPets: recycling points.** Things that give no materials back in the recycle stash -- drops, fish, food, berries -- now become recycling points, worth half what Marlow would pay. Spend them in the new Recycling exchange (in the recycled materials store) on any raw material you can gather yourself, at Marlow's value: copper and tin at first, more as your gathering levels rise.
- **Fixed:** an exotic egg couldn't be put in the Hatchery (it never showed in the list of eggs in your bag).

## 1.0.100 — NeuroPets: you as a young man or a young woman, armour you can see, the recycle stash (11 October 2026)

- **NeuroPets: you are a young man or a young woman.** Your character is newly painted, standing and in a fighting stance, and the look-maker is now one choice between the two (Player → Change look). Old games start as the young man until you change it. Skin, hair and tunic colours are put aside for now, and villagers keep their own looks. This is the first step towards armour you can see on you.
- **NeuroPets: the recycle stash.** In your store room, by the barrels: put in whatever you don't need, and 12 hours later it's broken down into raw materials -- half of what it was made from (a bronze helmet gives back copper and tin) -- in the recycled materials store just below it. Your benches at home use those materials after your bag and before your chests. Food, fish and drops give nothing back; they're simply thrown away. Changed your mind? Take a lot back before it's done. Build the stash up to break things down in 8, 5 or 3 hours, and the store to hold 25, 40 or 60 kinds (it starts at 15).
- **NeuroPets: armour you can see.** What you wear now shows on you, on the Player page, in fights and on the desktop battle card: helmet, chestplate, gauntlets, greaves and boots, mixed and matched, on the young man or the young woman. The bronze set is first; the rest follow as their pictures are painted.

## 1.0.99 — NeuroPets: story part 2 "The Star Chart", digging pays like the rest (10 October 2026)

- **NeuroPets: the story goes on. Part 2, "The Star Chart"** (chapters 11–18). The Pyramid's last chamber held a chart of the northern stars, and the journal's author never came back from where it points. The trail:
  1. Kemet on the Nile copies the crumbling chart;
  2. Nefer in Sandport fits out a ship north;
  3. Old Mariner Wren teaches you to steer by the stars;
  4. Castaway Finn sends you after lights in the Misty Isle's fog;
  5. Ingrid in Frosthaven dresses you for the cold;
  6. Sigrun guides you up through the Foothills;
  7. Hermit Bjorn makes a light from frost crystals;
  8. the Cairn Keeper waits at the Summit, past the thing that guards it.
  Rewards grow from 2,000 to 8,000 coins, with relics and ancient chests. The Today card shows "Part 2", and finishing chapter 10 announces the new part.
- **NeuroPets: digging pays like the other gathering skills.** Thirteen digging spots earned 81–96% of the XP an hour of other skills' spots at the same level. They now match:
  - Molehills and the Badger sett +23%, the Forest floor +20%, the Old mound +14%;
  - the rest +4–10%.
  Digging 12→13 now takes about 16 minutes instead of 20, and 19→20 about 35 instead of 43, the same as mining and lumbering.
- "The Nile" and "The Village" are now just "Nile" and "Village", so sentences no longer say "in the The Nile".

## 1.0.98 — NeuroPets: no long flat stretches in gathering (10 October 2026)

- **NeuroPets: no long flat stretches in gathering.** Lumbering had nothing new between the Hedge (level 3) and the Oak trees (level 8), so levels 6 and 7 dragged. Now the next spot opens sooner:
  - **Oak trees** at Lumbering 6 (was 8), **Willow trees** at 10 (was 12);
  - **Chalk pit** at Mining 8 (was 12); iron stays at 15;
  - **Old mound** at Digging 8 (was 10);
  - **Old orchard** at Foraging 8 (was 10).
  Each spot still pays the same XP an hour, it just opens sooner. Lumbering 6→7 now takes about 9 minutes instead of 13, and 7→8 about 10 instead of 15. A test now keeps every gathering skill from going more than 7 levels without a new spot before level 20.

## 1.0.97 — NeuroPets: pets at work, expedition parties, recipe XP from one rule (10 October 2026)

- **NeuroPets: pets at work at home.** Pets in your den can take a job at the estate (Pets page, "Job at home"):
  - a **Gardener** waters your plots, which also grow 10% faster;
  - a **Kitchen, Smithy, Shed or Library hand** gives that room's benches +10% xp and saves an ingredient on every tenth craft;
  - a **Store keeper** looks after one more chest in the store room.
  Your bedroom sets how many pets can work, from 1 to 4. A pet whose knack is the job's skill counts double, for example a cow in the garden or a chicken in the kitchen. A working pet stays home and can't be sent gathering.
- **NeuroPets: expedition parties.** Up to two den pets can go along on your companion's expedition, each with a role:
  - a **Scout** finds more, avoids traps and turns up crates and eggs more often;
  - a **Hauler** carries more home and adds one more kind of thing to the pack;
  - a **Fighter** fights beside your companion, adding half its health and attack.
  Party pets must be within 5 levels of the area, and must be able to fly for the Sky. They come home with your companion and get 60% of its xp. If the companion falls, they come home a little hurt.
- Text boxes and drop-downs are now always dark ink on parchment, so they're readable on the wood background too.
- **NeuroPets: recipe XP from one rule.** Every recipe's XP is now worked out the same way: an hour of gathering, crafted, gives about an hour's gathering XP at the recipe's level. Before, the 418 hand-set numbers ranged from a fifth to four times that. The cost of a recipe's materials:
  - gathered things count their gathering time;
  - made things count what went into them;
  - hides, meat and crops count half, since hunting and farming already pay their own XP;
  - one craft is worth at most 15 minutes of gathering.
  What you'll notice: tanning, pottery and fish dishes give less per craft; class armour, leatherwork, smithing and jewellery give more.
- **Sell prices under a coin read "per 100"** (e.g. "3 per 100") instead of looking like nothing.
- Behind the scenes, so later features cost less:
  - old saves are upgraded by numbered steps, each tested once;
  - the game runs on one shared clock instead of a dozen timers, and reuses its view of the game within a moment;
  - small edits that changed numbers set in other parts of the rules are folded back into where those numbers are first set, and a test now stops new ones.

## 1.0.96 — NeuroPets: Plan A, the story, painted art, a fairer economy (10 October 2026)

- **NeuroPets: your pet's painted room.** The pet page and the desktop
  companion show your pet in a cosy painted room, and the bed, toy box and rug you
  place in it are painted too. That's the last of the pixel art.
- **NeuroPets: the last of the painted art.** You (all 60 looks from the
  look-maker) are painted: a portrait on the Player page, the House and the
  look-maker, and a fighting stance in battles; the village folk use the same
  paintings. The sidebar, top bar, benches and places, the library tome, every
  egg (in the hatchery chooser and the pet's room) and the pet's mess are painted
  too. The desktop widget shows the painted you in fights and the painted egg.
- **NeuroPets: more than one stack of a thing.** When a stack is full (250 to a
  stack in a new bag, 300 with a small pet, more with bigger bags), more of it
  starts a new stack in another bag slot, instead of being left behind. The bag
  shows each stack as its own card ("stack 1", "stack 2" …), and counts slots
  rather than kinds. Things are only left behind when every slot is full.
- **NeuroPets: painted creatures.** All 66 creatures (the wild animals, the 12
  bosses and the five Mage tower duellists) now use Cam's painted art instead of
  pixel sprites: in fights (larger than before, facing you), on the hunting
  grounds, the Bestiary, the Pyramid, the region pages and the desktop widget's
  fights.
- **NeuroPets: no stray frame in pop-ups.** Hovering over a person's pop-up
  (Beekeeper Nell and the others) or the Material Archive drew a second frame
  inside the window; it doesn't any more.
- **NeuroPets: a fairer economy.** Since the 9 October speed-up every gathered
  thing sold for about a fifteenth of its old price, so a rough gem, a rare find
  at the copper rocks, sold for 1 coin. Now:
  - gems, treasures and eggs are priced by how rare they are (a rough gem 20, a
    pearl or amethyst 32, jade 50, lapis 75, an old coin 7, eggs 2–160);
  - a spot's rarer side finds (seeds, the odd eel) are worth more than its main
    find, up to 4×;
  - where gems were common loot (the Gem rocks, the Geode chamber, the pirate
    beach and a few digging spots) they're rarer now, so an hour there earns
    about what any spot of that level does; no spot earns more than about 2×;
  - cutting gems takes 1–4 rough gems instead of 5–20, and gem jewellery 1 gem
    instead of 5;
  - nothing you make sells for less than what went into it.
- **NeuroPets: early tools last longer.** A stone pickaxe or stone hatchet now
  lasts 300 copper, tin or logs (it was one ore and fifteen logs since the 9
  October speed-up), enough for a bronze pickaxe with plenty over; stone, clay
  and flint still never wear it. Bronze tools last 4,500 uses (was 3,000), iron
  5,000 (was 4,000) and steel 5,500 (was 5,000). A stone tool now says in the
  diary when it crumbles.
- **NeuroPets: level-ups show what they unlock.** The level-up celebration lists
  what the new level opens, each with its picture: new gathering spots (and
  where they are), recipes, tools, gear, crops, spells and regions (up to five,
  then "and N more"). It stays up a little longer when there's a list to read.
- **Desktop companion: painted pets.** The pet on your desktop is the painted pet
  too, walking around (facing where it goes) and curled up asleep when it naps.
- **NeuroPets: painted pets.** All 70 pet looks (47 species and their colours)
  now use Cam's painted storybook art instead of pixel art: a portrait on every
  card, the top bar, the den, the Petapedia and equipment; a side view walking
  around the pet's room (it turns to face where it's going); and a curled-up
  sleeper when it naps. A reskinned or mod-coloured pet keeps its own pixel
  colours.
- **NeuroPets: an Unlocks pop-up.** Finishing a quest that opens something shows
  a pop-up in the game's frame: the first unlock's picture, "Unlocks", the vine
  divider, then each thing it opened with its picture (for That Fox!: smelting
  bars at the furnace, smithing at the anvil, the notice board). Quests that give
  a key item show the region it opens (Reyes' machete: the Deep Jungle).
- **NeuroPets: every item has a painted icon.** All 730 items (food, fish, eggs,
  tools, weapons, armour, pet gear, potions, gems, jewellery, Arcane gear, runes,
  tomes and glyphs, hides, herbs, woods and stones) now use Cam's painted
  storybook icons instead of pixel art.
- **NeuroPets: a story, "The Island Remembers".** Ten chapters from people who
  already live on the island (Farmer Giles, Shepherd Bess, Beekeeper Nell, Ranger
  Ash, Old Mab, Old Salt, Brokk, Reyes, Nomad Amara). In a **new game**, each
  chapter opens part of the game: the smithy and notice board (chapter 2), the
  spinning wheel, tanner, fletching table and house building (3), herbs and
  breeding (4), research and expeditions (5), the observatory and Mage tower (6),
  gems and enchanting (8), the Pyramid (10). Anything waiting for the story says
  who to help. **Existing saves keep everything open** and can still play the
  chapters for the story and the rewards. The Today page shows your chapter, and
  finishing one gets its own celebration.
- **NeuroPets: "Pick up where you left off"** on the Today page now takes you to
  the place on the map instead of starting a trip from afar.
- **NeuroPets: combat XP brought into line.** A fight gave 6–17 times the XP an
  hour of gathering at the same level (a level-1 fighter earned about 8,900
  Attack XP an hour). Monster XP is now scaled so fighting earns about 1.1–2
  times gathering; quest XP rewards are unchanged, and nobody loses levels they
  already have.
- **Behind the scenes:** NeuroPets' rules are now kept in 45 smaller files, one per
  feature (`ui/pet/core/`), and joined into the one file the game and the desktop
  widget use (`python3 tools/build_petcore.py`). New tests replay a scripted day
  and check every item, level and recipe source, so a reorganisation can't quietly
  change the game.
- **Behind the scenes:** painted item icons can now replace the pixel ones a few
  at a time. `tools/cut_icon_sheet.py` cuts a sheet of icons made with the art
  prompts into the game's icon folder.
- **NeuroPets: hunting goes through the world too.** The Hunting page shows your
  fight and the ground you're at; to hunt somewhere else, travel there on the Map
  and press Hunt here. A skill's page (Fishing, Mining …) is now a guide: clicking
  a place tells you which region it's in, rather than starting a trip from afar.
- **NeuroPets: duplicate pets have a use.** On the Pets page, a pet you have more
  than one of can be **merged** into another of its kind (the other gains a star,
  up to 5: +10% to its companion boost and one more kind carried each, plus half
  the merged pet's experience) or **released for pet tokens** (common 5, uncommon
  10, rare 25, special 50). Spend tokens at the new Pet token shop on the Pets
  page: treats, salves, pet draughts, pet gear and eggs. Your companion and your
  last pet of a kind are never offered.
- **NeuroPets: your pet carries things.** Your companion carries part of your
  load while it's with you: a small pet (cat, bunny, frog …) +3 kinds of thing and
  +50 a stack, a medium pet (fox, dog, goat …) +6 and +100, a large pet (cow,
  horse, bear …) +10 and +200, plus a kind more every 5 pet levels. The bag and
  pet pages show it.
- **Behind the scenes:** a balance report (`node tools/balance_sim.js`) lists XP,
  items and coins per hour for every gathering spot, recipe and hunting ground.
  The tests now fail if a new spot or recipe is far out of line with its
  neighbours.
- **NeuroPets: an Overflow chest.** If your bag was over the new smaller limits,
  what didn't fit has moved (once) into an Overflow chest in your store room at
  home. Nothing is lost: take things out as you need them, and the chest goes
  when it's empty.
- **NeuroPets: "stack full" on a trip.** When the main thing you're gathering no
  longer fits, the diary says so once, and the trip card, the region page and the
  top bar show "stack full". You keep earning XP; store some at home to carry on
  collecting.
- **NeuroPets: a quicker start in every skill.** A novice bonus doubles the XP
  you earn up to level 10 in each skill, ×1.5 to level 15 and ×1.25 to level 20.
  Level 10 now takes about 2 hours of gathering instead of about 4; the time to
  level 50 is only 2–3% shorter. The skill line shows "Novice bonus ×2" while it
  applies.
- **NeuroPets balance fixes (from the audit):** cooked herring gave 10 XP (now 2,
  like the fish beside it) and honeycake 25 (now 5). Raw herring, honeycomb,
  seashells and other things that are both gathered and dropped sold for many
  times their worth (raw herring about 3,600 coins an hour); they now sell like
  other gathered things. The Pure essence vein and Essence rocks gave twice their
  tier's XP; they're in line now. The rune shrines stay quick on purpose, because
  their essence has to be mined first.
- **NeuroPets: fewer emojis.** Plain words on the navigation bar (Back, Map,
  Estate, Bag, Sea chart), the chest window's tabs, the region bar (Explore,
  Secrets, Fight), "You're here", sailing and shipyard lines, and the top bar's
  "At sea" and "On …" chips. Symbols that mean something stay: ✓ done, ✕ close,
  🔒 locked, ♥ health, 🪙 coins, ❗ quest ready, ☀/🌙 day and night creatures,
  ✨ rare breeding.
- **NeuroPets: search at the benches.** Every bench with more than a few recipes
  has a search box. Type a recipe's name, what it does, or an ingredient ("oak"
  finds everything made with oak). Your search stays while you craft.
- **NeuroPets: Estate instead of Home.** The navigation bar's Home button is now
  🏡 Estate and takes you to your estate (house, workshop, library, store room,
  graveyard) instead of inside the house. The game also opens at your Estate.
  Today is still inside the house.
- **NeuroPets: organize your chests.** The store room has an "Organize chests"
  button (and a tab in the chest window). It shows two shelves side by side with
  a chest open on each: drag things from one chest to the other, or use the
  Move buttons.
- **NeuroPets: more earthworms.** Wherever you dig them up, earthworms are now
  the next likeliest find after soil (about 3 in 10 finds at the Garden patch,
  was fewer than 1 in 10).
- **NeuroPets: a better store room.** Your bag is on the left and your chests on
  the right: a shelf of chests, each with its name and picture. Click one to open
  it, one at a time. Drag things from the bag onto a chest to store them all, or
  out of a chest onto the bag to take them all (the Store and Take buttons still
  work). Each chest now holds 13 kinds of thing (was 10).
- **NeuroPets: no shortcuts past the world.** The trip chip in the top bar, the
  trip card on Home and the gathering skills on the Player page used to open the
  skill's list of every spot. Now they open the map: the chip and the card show
  the region you're gathering in ("You're here"), and the skills open the whole
  map. You find places by travelling there.
- **NeuroPets: see what you've gathered.** Under a region's picture, the
  "Gathering at the …" bar now lists everything found this trip (soil 67,
  earthworms 21, …) and the XP so far, updating every second. Hover over a
  find to see how many you have in your bag.
- **NeuroFarm looks like NeuroPets.** The same dark wood and parchment, carved
  card frames, the leafy frame on workshop windows, plate buttons and the ribbon
  top bar. It uses NeuroPets' own frame pictures, so the two games share one
  set. The field and the painted scenes are unchanged.
- **NeuroPets: a parchment look.** Dark brown wood behind everything, parchment
  cards with dark brown writing, and brown buttons, with colours taken from the
  reference picture. It's only in NeuroPets; the rest of NeuroNet keeps its
  themes. The colours are all in `ui/pet/theme.css`.
- **NeuroPets: carved frames.** Cards, pop-up windows, buttons, the top bar,
  item slots and the background now use the pixel-art frames, ribbon, plates,
  vine divider and wooden planks you made (`ui/pet/art/ui/`).
- **NeuroPets: a bag you can open from anywhere.** A 🎒 Bag button sits beside
  Map and Home above every page.
- **NeuroPets: smaller bags, stack limits.** A bag now holds fewer kinds of
  things (20 to start; satchel 28, rucksack 36, explorer's pack 45, bottomless
  bag 60) and only so many of each (250 to start, up to 1,000). Once a stack is
  full, anything more you find of that thing is left behind. Whatever you
  already carry stays, shown as over capacity.
- **NeuroPets: named chests.** The store room is now chests of 10 kinds each
  (2 in a basic store room, up to 12 in a grand one). You can type a label on
  each chest and choose which chest to store a new thing in.
- **NeuroPets: benches use your chests.** At home, or at an island estate with a
  store room, every crafting bench uses materials from your chests as well as
  your bag (the bag first). Village traders don't.
- **NeuroPets:** the painted workshop no longer shows "N to make" under each
  bench, and the pet page has a **Potions** row of its own, separate from Feed.
- **NeuroPets: quicker early fishing.** Fishing spots up to level 15 give 30%
  more XP. Nets, rods, cages and harpoons last as long as the tools of their
  tier (a small net 3,000 catches, was 1,500). With no net you can still fish
  the Duck pond and the Pond **by hand**: it's slower and you only catch
  shrimp and minnows, but you're never locked out. When your last net wears
  out there, you carry on by hand instead of coming home.
- **A bigger farm:** the field now takes the whole width of the window and as
  much height as fits with the seed bar, so tiles are about a third bigger
  (and larger still on a big screen). "Close up" frames your field with the
  painting's fence; "Whole farm" shows all the countryside around it.
- The side panel is gone: the day at a glance (ready to harvest, spoiled,
  animals, workshops, orders) is a strip of chips above the field — click one
  to go there; what's under the pointer shows in a caption at the bottom of
  the field; a building you click opens as a card over the far side of the
  field (✕ or Esc to close).

## 1.0.95 — NeuroFarm: homely, painted, workshops you click into, queues and stoves (9 October 2026)

- **NeuroFarm feels homely:** the dark night look is gone — the whole game is
  now a farmhouse on a warm afternoon: cream and honey, sage green, storybook
  headings, labels on little wooden signs.
- **Workshops you click into, like NeuroPets:** the Workshops page is a yard
  of the Kitchen, Dairy, Sewing room and Mill, each showing what it's up to.
  Click one to step inside: click a recipe to make it (one you can't make yet
  says why), click a finished thing to collect it, and build or upgrade from
  the same sheet. Esc or a click outside closes it.
- **Queues:** when every slot in a workshop is busy, a recipe says **Queue** —
  click it and it waits its turn (up to 6 per workshop), starting by itself the
  moment there's room, even while NeuroFarm is closed. What it takes comes out
  of the silos when you queue it; click it in the queue to take it out and get
  it all back.
- **Extra stoves:** add up to four stoves to the Kitchen (coins and wood, from
  farm levels 4, 8, 13 and 18). Each is one more thing cooking at once; the
  Kitchen's level still decides which recipes you can cook.
- **The first painted pictures are in:** the title screen, the Workshops yard
  (click a building or its sign; a badge under each sign says what it's up
  to), the countryside around your field, painted grass, soil and the misty
  land that isn't yours yet, a "for sale" sign on land you can buy, and 18
  crops that grow through four painted stages (on the field and in the seed
  bar). The rest keep their pixel art until their pictures come.
- **Art prompts for the overhaul:** Scribe → NeuroFarm → Art Prompts — 11
  painted pictures (one note each) and 163 sprites (each its own prompt), in
  the same cozy painted style. Send the pictures and they get wired in.

## 1.0.94 — NeuroPets: grow a pet up at once (9 October 2026)

- **Grow a pet up at once:** three new things bring a hatchling straight to
  expedition age (3 days old) — the **Charm of Seasons** (Gem bench, level
  18), the **Elixir of Growth** (Apothecary table, level 12) and the
  **Coming-of-age cake** (Kitchen, level 10). Each is used up. A hatchling's
  page shows a "Grow up" row when you carry the charm or elixir; the cake is
  in Feed. An egg, or a pet already old enough, keeps the item.

## 1.0.93 — NeuroPets: fights name your attack (9 October 2026)

- **Fights say which attack you used:** every blow in the battle window now
  names it — "You hit the rat for 6 with Wind strike!", "You hit the rat for
  3 with your Bronze sword.", "Wind strike missed!". Specials and spells by
  name, otherwise your weapon (or your fists). The desktop NeuroPets card says
  the same.

## 1.0.92 — NeuroPets: 150 quests, working towns, the last pictures (9 October 2026)

- **Far more quests:** every person now has a chain of at least six (156
  in all, up from 38). They ask for plenty of their place's materials,
  something made from them, hunts and the boss, every secret, and a level
  to reach, with coins, XP and crates as rewards. Quests you've already
  finished stay done.
- **The towns' buildings work:**
  - **Sandport's bazaar** (Tariq) and **Frosthaven's trading post**
    (Astrid) sell island goods, eggs, rope and gear, and buy anything.
  - **Each town's inn:** 60 coins buys a hot meal and a bed, which fully
    heals you and feeds and rests your pets (once every two hours).
- **Back from inside places:** the Nile and the Oasis go back to the
  Desert, the Ice Cavern and the Summit to the Foothills, and the Deep
  Jungle to the Jungle.
- **Farming tools wear out too:** a rake or hoe after 80 uses, a watering
  can after 120, a steel one after 300. A steel can now also counts for
  watering a single plot.
- **The last pictures:** the Open Sea, the Deep Jungle and the Shipyard
  (click Your ship, the slipway, Hal or Set sail).
- **The play area sits in the middle of the window** on wide screens.

## 1.0.91 — NeuroPets: one Map button (9 October 2026)

- **No more "‹ Map" next to "🗺 Map".** When Back would only take you to
  the Map, it's greyed out, everywhere (the village, every region, the
  islands, the sea chart). Back still steps up to anywhere else: the Coast
  from the Shipyard, the Village from the Nursery, the Estate from a room.

## 1.0.90 — NeuroPets: the islands painted, and much more (9 October 2026)

- **Painted maps for the islands:** the Desert Island and Frostpeak Island
  each have their own map when you're there. Click a place to go in.
- **Painted places:** the Desert, the Nile, the Oasis, Sandport,
  Frosthaven, the Foothills, the Ice Cavern, the Summit, the Misty Isle
  and the Crystal Caves. Every spot, person, hunting ground, boss and path
  is a scroll you click.
- **The Mage tower** is a painted tower: each floor is a rank, and the
  next one you can win has a Duel badge.
- **Island estates** show a picture for their stage: For sale, then a
  camp, Sturdy, Fine and Grand, on both islands. Click a part to jump to
  its card.
- **The Pyramid** shows its chambers, with where you are, what's cleared
  and the sarcophagus after dark.
- **The Nursery, the Storeroom, the Graveyard and the Camp** are pictures
  now too.
- **Battles** are fought in front of a painted backdrop for each hunting
  ground, and in the Pyramid for its guardian and the Pharaoh.

## 1.0.89 — NeuroPets: a slower climb (9 October 2026)

- **Every level needs half as much XP again** (level 50 is now 152,000).
  Gathering a skill to 20 takes about 11–13 hours instead of 7–9, and to
  50 about 90–150 hours. **You keep every level you have:** your XP was
  scaled up to match, once.
- **Crafting is back in line.** With gathering 15× faster, each craft
  giving double XP meant an hour of gathering fed six times the crafting
  XP it used to. A craft now gives its original XP, and the 5× materials
  still make crafting about three times as rewarding per hour of
  gathering as before.
- **Cooking too:** a dish whose main ingredient is gathered (fish,
  berries, vegetables) gives a fifth of its old XP, since those come 15×
  faster. Dishes made from hunted meat keep their XP.

## 1.0.88 — NeuroPets: the Pyramid (9 October 2026)

- **The Pyramid**, a door in the Desert on the Desert Island, from combat
  level 40. One run a day (it resets at your midnight), chamber by
  chamber:
  - **Traps** offer two ways through, each a skill (Defence or
    Construction for the falling ceiling, Ranged or Herblore for the dart
    corridor, and so on). The higher your level, the better your odds,
    and the page shows them. A failed trap hurts but you go on. Either
    way you get XP.
  - **Glyph doors** ask a riddle; touch the glyph that answers it. A
    wrong guess bites back.
  - **Guardians** are desert creatures, fought on the spot.
  - **The fifth chamber is the Tomb guardian**, a live battle: eat, use
    your special, or run.
  - **After dark (9 pm) a sixth chamber opens: the Pharaoh's
    sarcophagus,** the toughest live battle in the game.
- **The treasure is different every run**, like a replayable boss: coins
  and three things from gold, old coins, scarabs, lapis, gems, stardust,
  crates, ancient chests, Egyptian gear, and now and then a piece of the
  new **Pharaoh's set**. The Pharaoh gives more, and finds the set more
  often. Very rarely he gives a **Sarcophagus egg**, which hatches the
  Legendary **Golden Scorpion**.
- **The Pharaoh's set** (crown, robe, sceptre, sandals, amulet): wearing
  all five gives +10% XP, +6 defence, +6 magic and surer hits.
- Beaten (or if you run), you're thrown out until tomorrow. You're never
  killed: the Pyramid doesn't end a game, even in hardcore.

## 1.0.87 — NeuroPets: the Oasis, the mirage merchant, harbour contracts (9 October 2026)

- **The Oasis**, a new place on the Desert Island, through a path from
  the Desert. It's drawn for now; its painted picture can come later.
  - **The Oasis pool** has moved here from the Desert. It's still the
    place for the very rare Wrapped egg.
  - New spots: **Spring gardens** (aloe, dates, lotus) and **Oasis
    palms** (palm logs).
  - **Spring-keeper Yusuf** has two quests, and there are two secrets to
    find.
  - **Rest by the water** heals you fully, and your pets drink and doze
    (energy +40, fun +30). Once every four hours.
- **The mirage merchant (Sahir)** appears at the Oasis after dark, 9 pm
  to 5 am. Each night he has four rare things for plenty of coins: desert
  eggs, Egyptian gear, pet gear, stardust, lapis, crates. He buys too.
- **Harbour contracts.** Harbourmaster Nefer in Sandport and
  Harbourmaster Ingrid in Frosthaven each post three contracts a day for
  goods from elsewhere (Frostpeak's char and pelts for Sandport, the
  desert's dates and papyrus for Frosthaven, and steel, planks, rope,
  cloth and leather for both).
  - Each pays about twice what Marlow would, plus XP in the skill that
    makes or gathers the goods, plus a crate. Fill them all for an iron
    crate.
  - With a galleon, there's a fourth, bigger contract.
  - Find them in each town: "Nefer's contracts" or "Ingrid's contracts".

## 1.0.86 — NeuroPets: one navigation bar (9 October 2026)

- **Back, Map and Home sit in one bar just above every page**, always in
  the same place. They're gone from the top bar, and the "← Map" link
  and the village's coin line are gone from the pages.
  - **‹ Back** goes one step up: from a region to the Map, from the sea
    chart to the island, from the Shipyard back to the Coast, and from a
    room to its building.
  - **🗺 Map** shows the map of where you are.
  - **🏠 Home** is your house. On another island it's your estate there,
    once you've bought the plot and built its house; until then it's
    greyed out and says why. At sea there's no Home.
  - On the Map, the bar also has the **🧭 Sea chart / 🏝 Island map**
    switch.

## 1.0.85 — NeuroPets: quick gathering, hungry crafting, fewer things that last forever (9 October 2026)

- **Gathering is quick now, like Melvor.** An attempt takes 3 seconds at
  level 1, rising to 8 at the top spots (it was 45 seconds to over two
  minutes). You bring home about fifteen times as much.
- **Levels and coins keep their pace by the hour.** Each find is worth
  less XP, and what you gather sells for part of a coin (you're paid for
  the lot, rounded down). Rare finds and eggs, fishing bait, gathering
  draughts and the notice board's orders are rescaled the same way.
  Skill essences stay rare.
- **Crafting eats far more.** Every recipe outside the kitchen takes five
  times the gathered materials (bars, planks, thread, rope, potions,
  pottery, tools) and gives twice the XP. Made things keep their value,
  so crafting is the way to earn now.
- **Tools wear on every use,** not only on harder materials (bronze lasts
  3,000 uses, rune 8,000), and above their tier they wear faster. Mend
  them at the anvil or bench as before.
- **Fishing kits wear out** (a small net after 1,500 catches up to a
  papyrus net after 4,000), and so do **chisels** (60 cuts), **needles**
  (40 knits) and **pots of water** (15 quartz or amethyst cuts). Make
  another when one goes.
- A trip you're on now finishes at the old pace. The new pace starts
  with your next trip.

## 1.0.84 — NeuroPets: one place for each string, and rope (9 October 2026)

- **Thread, bow strings and crossbow strings are spun at the spinning
  wheel only.** Thread comes from cotton (from the start) or silk, bow
  strings from flax and sap, and crossbow strings from flax and sap. The
  crafting bench no longer makes thread, the fletching table no longer
  makes crossbow strings, and horsehair no longer makes bow strings.
- **Horsehair spins into rope now** (3 horsehair, Crafting 12), along with
  flax or cotton.
- **Rope has more uses:**
  - The Crystal Caves and the Ice Cavern want a rope as well as your
    lantern. It's carried, not used up.
  - The climbing kit is made with rope instead of balls of wool.
  - Every part of an island estate takes some rope.
  - New quests: Brokk in the Crystal Caves ("Rope for the shafts") and
    Harbourmaster Ingrid in Frosthaven ("Nets and lines").
  - Ships already take rope for their sails and rigging.

## 1.0.83 — NeuroPets: islands stay on their islands; bow strings from flax (9 October 2026)

- **The main island's map lists only the main island.** The Desert,
  the Nile, Sandport, Frostpeak, Frosthaven, the Ice Cavern, the Summit
  and the Open Sea are no longer in the list under it. Each island's
  places open on that island, and the Open Sea opens from the sea chart
  (the Coast's "Open Sea" door has gone).
- **Bow strings are spun from flax at the spinning wheel.** The fletching
  table no longer sews them from thread.

## 1.0.82 — NeuroPets: the new maps and the sea chart (9 October 2026)

- **A new painted map of the main island.** Frostpeak has sailed off to
  be an island of its own, so the Mage tower now stands in the hills
  where the mountains were, and the Meadow and Pasture have moved.
- **The sea chart.** "🧭 Sea chart" above the map shows the main island,
  Frostpeak Island, the Desert Island, the Open Sea and the Misty Isle.
  Click an island to set sail (or see which ship it takes), the main
  island to go back to its map (or sail home when you're away), and the
  docks for the Shipyard. "📍 You're here" marks where you are, and a
  voyage shows when you'll land.
- **The Coast has the Shipyard painted in**: click Shipwright Hal's
  scroll to go there.

## 1.0.81 — NeuroPets: Deeper night, in Settings (8 October 2026)

- **Settings → Accessibility → "Deeper night"** brings back the darker,
  duskier evening and night light on the pictures. It starts off; the
  gentle night stays the default. "Day and night on the pictures" is under
  Accessibility too.

## 1.0.80 — NeuroPets: a gentler night (8 October 2026)

- **The pictures no longer go dark at night.** The night light darkened
  them by almost half; now it's a light dusk (about 15%), and the evening
  barely warms them — the fireflies and glowing fires say it's night.
  Settings → "Day and night on the pictures" still turns it off.

## 1.0.79 — NeuroPets: island estates, a home away from home (8 October 2026)

- **Buy an estate on each island** — in Sandport (25,000 coins) and
  Frosthaven (20,000): "Your estate" in the town.
- **Six parts, each built up on its own** through Basic → Sturdy → Fine →
  Grand (Construction 5 / 10 / 25 / 40, planks and the island's own
  stone or pine; the cistern and hot spring want lapis or frost
  crystals). When all six reach a tier, the whole estate does.
  - **House:** rest heals faster on the island.
  - **Workshop:** benches on the island — a kitchen and a crafting bench,
    then a furnace, anvil, spinning wheel and sawbench, and more with each
    tier (what it can make is capped like a home room).
  - **Storeroom:** chests kept on that island.
  - **Pet quarters:** your companion's skill bonus is a little higher
    there.
  - **Garden:** the island's produce every 12 hours (dates and aloe, or
    snowberries and frost lichen).
  - **Courtyard cistern** (Desert Island) / **Hot spring** (Frostpeak):
    resting heals faster still.
- So you can stay on an island for a while and work through it, without
  sailing home to make things or store them.

## 1.0.78 — NeuroPets: Frostpeak Island in full (8 October 2026)

- **Frostpeak Island now has three areas** past Frosthaven:
  - **Frostpeak Foothills** (the old Frostpeak): snowy pines, the frost
    vein and the law shrine as before, plus an **ice-fishing hole**
    (arctic char, ice trout), **snowberry bushes** (snowberries, frost
    lichen) and the **frozen tundra** (fossils, mammoth ivory).
  - **The Ice Cavern** (a lantern, Mining 40): **frost-crystal
    formations**, an **underground lake** (blind cavefish), and Hermit
    Bjorn with two quests.
  - **The Summit** (the climbing kit, Defence 35 — the climb moved up
    here): the **Summit ridge** (adamantite, frost crystals), the
    **Cairn Keeper**, and the **Yeti's lair**.
- **The Foothills hunting ground** (combat 44): snow leopards and arctic
  foxes; **mountain goats and yaks by day**, **ice wolves and snowy owls at
  night** (they drop the night-only Moonlit egg). Earn the **Yeti** there,
  then fight it at the Summit; beat it 10 times and a **Yeti cub** can
  hatch from Frost eggs.
- **New pets:** Snow Leopard, Arctic Fox, Mountain Goat, Yak, Ice Wolf,
  Snowy Owl, Yeti Cub — and hidden ones: a **Polar Bear Cub** (the Ice
  Cavern) and a **Storm Owl** (the Summit).
- **Furs:** a fur hood and a yeti-fur coat for you, a fur coat for your
  pet.

## 1.0.77 — NeuroPets: the Open Sea (8 October 2026)

- **The Open Sea**, out past the harbour, fished from your own ship with a
  harpoon: **Stingray shoals** and **Shark waters** (a Sailboat, Fishing
  40 and 45), **Orca waters** (a Caravel, 48) and the **Whale road** (a
  Galleon, 50). Get there from the Coast ("The Open Sea" on its picture).
- **Sea pets.** Now and then a catch is an egg: a **Baby Stingray**, an
  **Orca Calf**, a **Whale Calf** — and a **White Whale** hides out there
  (explore for it).
- Stingrays and sharks cook into the strongest food yet; orca and whale
  **blubber boils into pitch** for your ships; whales sometimes give
  **ambergris**, worth a fortune.
- **Shipwright Hal** has two ocean quests; **Old Mariner Wren** lives out
  on the water with two more.
- **Fixed:** the Desert's and the Nile's later places (Cactus garden,
  Lapis vein, Palm grove, Buried tomb, Lotus pools, Nile depths, Riverbank
  mud) and some Egyptian recipes asked for levels above 50, so they could
  never open. They're now 44–50, and the Galleon needs Construction 50.

## 1.0.76 — NeuroPets: ships, the Shipyard, voyages — and two new islands (8 October 2026)

- **Ships.** Old Salt's rowing boat is your first ship (a Rowboat), and it
  opens the **Shipyard** on the Coast, next to the Harbour, run by
  **Shipwright Hal** (who has quests). Build up through a **Sailboat**
  (Construction 25), a **Caravel** (40) and a **Galleon** (55), each in
  four parts — hull, mast, sails, rigging — a few hours each, for
  Construction xp. New makings: **rope** (spinning wheel), **sailcloth**
  and **pitch**.
- The **Misty Isle** needs your Rowboat; **ocean expeditions** your
  Sailboat.
- **Voyages.** A Caravel sails to the **Desert Island** and **Frostpeak
  Island** (15 minutes; a Galleon 10). You stay until you sail home from
  the island's dock — the main island's places, your benches and the
  shops wait at home. The Map shows the island you're on; the top bar
  shows where you are, or your voyage.
- **The Desert Island:** the town of **Sandport** (Harbourmaster Nefer,
  two quests), **the Desert** (the Sphinx, the Oasis, day and night
  creatures) and **the Nile** (the King of the Nile), with their pets,
  the plague tablet and Egyptian clothing.
- **Frostpeak Island:** the town of **Frosthaven** (Harbourmaster Ingrid)
  and the Frostpeak Mountains — more of the island comes in a later
  update.
- **Day and night creatures.** Owls come out in the forests at night (an
  owl egg is night-only); the Desert and the Nile change their creatures
  by day and by night. The hunting page and the Petapedia say which.

## 1.0.75 — NeuroPets: no blue wash in the evening (8 October 2026)

- **The evening and night light no longer washes the pictures blue.** It
  dims them instead — warmer in the evening, darker and dusky at night,
  with the fires and fireflies glowing — keeping the picture's own
  colours.
- **Settings → Day and night on the pictures** turns it off: always
  daylight.

## 1.0.74 — NeuroPets: natures, potential and bred colours; no more blue-out (8 October 2026)

- **Every pet has a sex, a nature and potential.** Natures are small
  trade-offs (Brave: +10% attack, −10% defence; Hardy: +10% health;
  Calm: no ups or downs …). Potential is five stats — Health, Attack,
  Defence, Agility, Knack (the companion's skill bonus) — 0–10 for a
  hatched pet; 5 is exactly as strong as pets were before. Your pets got
  theirs from who they are, so they never change.
- **Breeding takes a male and a female.** The egg's potential comes from
  the parents (two strong parents add a point), so a bred pet can reach
  15. The right pair of natures has a 35% chance of a **rare nature**,
  only ever bred: Valiant (Brave × Bold), Steadfast (Hardy × Bold),
  Fierce (Wild × Brave), Nimble (Timid × Jolly), Serene (Calm × Gentle),
  Sage (Diligent × Calm) — each better than its parents, a little stronger
  from the start, and often with its own **colouring** (Royal, Stone,
  Ember, Mist, Aurora, Starlit). Colourings pass on, and any bred egg
  might be a rare **Shimmer**.
- The Pets page shows each pet's sex, nature and potential; Breeding
  shows the pair side by side, the chance of a rare nature and the egg's
  potential, and a Natures book.
- **No more blue-out.** A drag, a double-click or Ctrl+A no longer
  selects the map or anything else in the game; typing in boxes still
  works.

## 1.0.73 — NeuroPets: one place at a time, and planks rebalanced (8 October 2026)

- **One place at a time.** On every painted page — Home, the Estate,
  the Library, the Workshop, the Village and the painted regions — the
  picture is the page. Click a place and only its own options open: the
  dining table's meals, the hearth's pot, a room's benches and upgrade,
  the material archive, a region's person or its secrets. Esc, ✕ or a
  click outside closes it. The long lists under the pictures are gone; a
  region keeps one bar for Explore, Secrets and (when it's ready) the
  boss.
- **Planks rebalanced.** A plank takes three logs and a small sawbench
  fee, and gives less xp per log than chopping it. Room upgrades need
  Construction 10 / 25 / 40, more materials and coins (2,500 / 10,000 /
  30,000) and give more xp; research needs a sturdy, fine or grand
  library and costs 1,000 / 5,000 / 15,000 coins plus 20 planks. A sturdy
  room is now about a day's play, not an hour and a half.

## 1.0.72 — NeuroPets: home life, living pictures, the Forest, House, Library and Workshop (8 October 2026)

- **Home is where the game starts.** The House picture, with everything
  from Today (your pet, what's running, what's ready, the latest news),
  the doors to My pet, Pets, Bag, Player and Expeditions, the bedroom, and
  a folded **Materials** list: everything you can gather now, and where.
  Click a place in it once and you go there and start gathering.
- **New pictures:** the Forest (the **Camp** is there now), the House,
  the Library, the Workshop (every bench, each room's upgrades, the
  garden) and a repainted Estate.
- **Living pictures.** A tint that follows your clock (dawn, day, dusk,
  evening, night), chimney and campfire smoke, glinting water,
  flickering fires and glowing magic, birds by day and fireflies after
  dark. They keep still if your computer asks for less motion.
- **The hearth:** put 3–8 ingredients in the pot; 45 minutes later, a
  bowl of stew each — thin, hearty or rich, by what went in.
- **The dining table:** sit down to a cooked meal: it heals you, cheers
  your pet, and you're **Well fed** — up to +8% xp for an hour (stews a
  little extra). One meal at a time.
- **The forbidden archive:** Grizz carries the key. Torn pages turn up
  when you explore, one in each region; put them back together for
  coins, an ancient chest, an exotic egg and a tome.
- **The cozy hearth:** read for half an hour when you're home and idle,
  for a little xp in a skill.
- **The ancient stacks:** research, one project at a time — quicker
  gathering for each skill, a roomier bag, better odds exploring.
- **The astro observatory:** once a night (9 pm–5 am) look at the sky:
  the week's constellation gives a skill +10% xp until morning, and a
  shooting star sometimes leaves **stardust**, which enchants opals and
  sapphires instead of runes.
- **Calmer navigation.** Clicking a spot you're already working, or a
  locked one, just says so — no more old skill pages. The sidebar can be
  hidden (☰ in the top bar); the save slots come up on the first start
  of the day; a **Settings** page hides the Modder, New game buttons,
  the Sandbox switch and the sidebar.

## 1.0.71 — NeuroPets: a painted world you walk around (8 October 2026)

- **A painted world map.** The Map is now an illustrated island. Click a
  region to go there; locked regions sit under a light fog, and small
  scrolls show your secrets found, a quest waiting or what you're doing
  there.
- **Painted regions.** The Farmyard, Pasture, Meadow, Deep Forest, Coast
  and Jungle each have their own picture. Every scroll on it is a place:
  click it (or the thing it names) to gather, hunt, send a pet on an
  expedition or talk to the person who lives there. Places you can't use
  yet are greyed with what they need; where you're working glows. The
  Jungle's boss lair opens once the Basilisk is ready. Forest, Deep
  Jungle, Crystal Caves, Misty Isle, Frostpeak and the Mage tower keep
  their drawn scenes for now.
- **A navigation game.** The sidebar is down to Today, Map and Camp (plus
  Save slots and Modder); everything else is a place:
  - **Village:** Marlow, Hazel's notice board, Mira, the travelling
    merchant (Sundays), the reskinner (after two bosses), the **Nursery**
    (Hatchery and Breeding) and the road to your **Estate**.
  - **Estate:** the **House** (my pet, pets, bag, player, expeditions and
    the bedroom), the **Workshop** (every bench and its room upgrades),
    the **Library** (spellbook, enchant book, Herbarium, Bestiary,
    Petapedia), the **Storeroom** (equipment and the chests) and the
    **Graveyard**.
  - The button in the top bar takes you back up one place at a time.

## 1.0.70 — NeuroFarm on the desktop, the Instant tonic, more crops and the Mill (7 October 2026)

- **NeuroFarm desktop widget.** A new card on the desktop board shows
  your farm: the land you own, what's growing, your coop, barn and
  pasture. Click a tile to do what the game's smart click does (plow,
  plant the seed shown, harvest, collect from or feed a building). Under
  it, pills: the seed you're planting (click for the next one), Harvest
  all, Collect, Feed all, and one per workshop and animal building, each
  with a progress bar. Click a pill when it's ready to collect. The card
  talks to the game, which saves; if the game isn't open it starts hidden
  (and closes again after 10 minutes out of sight).
- **Instant tonic.** From level 12 the request board sometimes rewards
  one. It finishes something at once: a growing crop or tree, a
  building's animals at work, or what a workshop is making ("Finish now").
- **13 more crops:** tomatoes, onions, lettuces, beetroot, sugarcane,
  cucumbers, sunflowers, chillies, rice, grapes, pineapples (2×2),
  coffee and cocoa. **5 more fruit trees:** cherry, orange, lemon, peach
  and coconut palm.
- **The Mill**, a fourth workshop (from level 10): sugar, orange juice,
  sunflower oil, lemonade, grape juice, ground coffee, coconut milk and
  chocolate.
- **13 more kitchen dishes:** tomato soup, garden salad, beetroot soup,
  cherry pie, pickles, chilli stew, lemon tart, pizza, fried rice, peach
  cobbler, pineapple cake and mocha. Seeds in the hotbar are now in level
  order.

## 1.0.69 — NeuroFarm part 2: animals, the dairy, the sewing room, and a new look (7 October 2026)

- **Animals.** From level 6, build a chicken coop on your land (2×2,
  coins, wood and wheat), buy hens and feed them wheat: eggs every 30
  minutes. Barns for cows (milk) from level 10, pastures for goats (goat's
  milk) from 13 and sheep (wool) from 16. Sheep need a **shearer's shed**
  before their wool comes off. Animals eat from your silos; nothing they
  make spoils. Click a building on the farm to collect or feed, or use
  Feed all / Collect all.
- **Wood.** Trees give a little with each harvest, more when you chop
  them down (Clear), and the market sells it.
- **Two new workshops.** The **dairy** (butter, yoghurt, cheese, goat's
  cheese, ice cream) and the **sewing room** (cotton cloth, linen, yarn,
  sweaters, blankets, linen shirts, quilts). Each upgrades to level 3:
  more recipes, more at once. The kitchen gains omelettes, pancakes,
  strawberry cake and cheese quiche.
- The request board now asks for eggs, milk, wool and your new goods too.
- **A new look.** A rail down the left with badges for anything waiting;
  a top bar with your level ring, coins and silo meter; on the Farm, an
  inspector beside the land that tells you about whatever you point at
  and runs a building's animals when you pick it; a seed hotbar (number
  keys pick seeds, Esc puts down what you hold); the request board's
  orders on pinned paper slips; new Animals and Workshops pages.

## 1.0.68 — NeuroFarm opens properly (7 October 2026)

- **Fixed: NeuroFarm opened to an empty green window.** The page's
  security settings blocked the bridge the game uses to load and save
  your farm, so nothing loaded. It now opens to your farm (or the start
  screen).
- If the game ever can't reach its save, it now says so instead of
  showing a blank page.

## 1.0.67 — NeuroFarm, a new game (part 1 of 3) (7 October 2026)

- **NeuroFarm**: a farming game in its own window, like NeuroPets.
  - Open it from the app launcher (NeuroFarm), with **Super+Alt+Y**
    (again to tuck it away), or with `neurofarm`.
  - Your farm is kept in NeuroNet's data folder (farm/farm.json).
- **Your fields**: you start with a 4x4 field, already plowed.
  - **Smart click** does the obvious thing: plow wild land, plant your
    chosen seed on bare soil, or harvest what's ready.
  - **Harvest all** and **Plow all** do every tile at once.
- **Crops grow in real time**, each at its own pace: strawberries in 4
  minutes, up to starfruit in 12 hours. There are 14 crops, unlocked by
  level.
  - **Pumpkins, melons and dragon fruit are 2x2.**
  - **Trees** (apple, pear, mango, banana and golden apple) are 2x2, are
    planted once, and fruit again and again.
- **Spoiling**: a crop left unpicked for as long again as it took to grow
  spoils. Clear it, or bring it back with a Freshness tonic.
- **Land**: every level lets you buy another 4x4 parcel next to your farm,
  up to 12 parcels. Plow it to plant.
- **Silos** hold everything you harvest and cook. When they're full you
  can't harvest, so build more (coins and wheat).
- **The kitchen**, four levels:
  - Cook your crops into dishes, from bread and strawberry jam up to
    dragon fruit tart.
  - Cooking takes time, and a dish sells for a little more than its crops.
  - Better recipes need a bigger kitchen and a higher level, and a bigger
    kitchen cooks more at once.
- **The market**: sell anything from your silos.
- **The request board**: three special orders at a time.
  - They pay well above the market and give xp.
  - Some give tonics: the **Grow tonic** halves a crop's time left; the
    **Freshness tonic** saves a spoiled crop.
- **30 levels**, each unlocking something; the Farmer tab shows what's
  coming.
- Still to come: **husbandry** (a coop, barns, pastures, a shearer's
  shed, dairy), then **mass orders and the machines** (trucks, tractors,
  harvesters).

## 1.0.66 — NeuroPets: enchanting armour, jewellery and gems (7 October 2026)

- **Armour**: every piece can be enchanted.
  - **Warding** now fits gauntlets and boots too.
  - New **Thorns**: a tenth of every hit you take goes back at them.
  - New **Fortified**: every hit you take is 1 less, and +5 health.
- **Jewellery**: rings and necklaces take two new enchants, as well as
  Fortune's and Sage's.
  - **Vitality**: +8 health.
  - **Focus**: +5% to hit and +2 magic accuracy.
- **Gems**: the enchanting table now also **enchants gems**: opal,
  sapphire, emerald, ruby and diamond, with runes.
  - Enchanted gems are needed for the strongest enchants (Arcanist's,
    Fortune's, Sage's and the four new ones).
  - They're also needed for the top wizardry gear: the Sorcerer's crown,
    the Mystic staff, and the Archmage's circlet and cloak.
- The new enchants' tomes are in ancient chests, like the others.

## 1.0.65 — NeuroPets: altar and enchanting table swapped, quartz cutting, shrine fix (7 October 2026)

- **The altar and the enchanting table have swapped jobs.**
  - The **Altar** makes the wizardry gear: wands, staffs, hats and cloaks.
  - The **Enchanting table** puts enchants on things: now your **tools**,
    your armour and weapons, your jewellery, and **your pet's gear** too.
- **Two new enchants**, their tomes in ancient chests:
  - **Swiftness**: a tool works 15% faster.
  - **Wanderer's**: on a pet's gear, +8% expedition success and +10%
    expedition xp.
- **More enchants fit more things:**
  - Fortune's and Sage's go on tools as well as rings and necklaces.
  - Warding goes on a pet's gear as well as your helmet, chestplate, legs
    and cloak.
- **The gem bench cuts quartz and amethyst** (from rough gems), like the
  other gems.
- **Fixed:** a shrine without essence stones said you needed them "for bait"
  and that "chickens drop them". It now says where to mine them.

## 1.0.64 — NeuroPets: the Modder, mod packs and the pet modder (7 October 2026)

- **The Modder** (sidebar, under Game) makes **mod packs**.
- **Rates**: skill xp, coins from creatures, drop and rare-find chance,
  gathering speed, egg hatching speed and monster strength. 1 is the game as
  it is; 2 is twice as much or as fast.
- **Pictures**: replace any item's icon, any creature's sprite, any
  region's scene, or the world map's background.
  - Pictures come from a PNG you choose, or from **NeuroNet's Assets**:
    draw them in NeuroNet (Creative → Pixel art) and save them as a Game
    asset.
- **The pet modder**: for each kind of pet, change the colours of each
  colourway, and set its companion buffs (add, change or remove; any
  skill's xp or a fight bonus).
- **Pick a mod pack when you start a new game** (Save slots → New game).
  - A game keeps the pack it began with; the slot's card says which.
  - A game without a pack plays as it always has.

## 1.0.63 — NeuroPets: game modes, New Game Plus, three save slots (7 October 2026)

- **Three save slots** (Save slots, in the sidebar):
  - Play up to three characters, each its own game.
  - Each slot's card shows the name, mode, levels, coins, pet and when you
    last played.
  - **Play** switches to a slot, **New game** starts one, **Clear** empties
    one.
  - The desktop pet follows the game you're playing.
- **Game modes**, chosen when you start a new game:
  - **Adventure**: fall and you drop only your coins; your pets never die
    (a deadly fall is an injury instead).
  - **Hardcore**: fall and you lose everything you carry; pets can die in
    the far areas. A game that's already going is Hardcore, which is how
    it has always played.
  - **Hell**: fall and you die. The game is over; start again from
    nothing. Pets can die too.
- **New Game Plus**, unlocked by beating the Basilisk (the Jungle's boss):
  - Start a new game in any mode, stronger: every skill at level 5, the
    fighting skills at 15, and 2,000 coins.
  - Bring three pets of your choice from the finished game, their levels
    kept.
  - Each time round, the monsters are tougher: +20% health and harder hits
    a cycle.
- Today shows your mode (and New Game Plus).

## 1.0.62 — NeuroPets: the Arcane class (7 October 2026)

- **No more wait between fights** when you hunt: a second's breath, then
  the next creature. Challenging a boss or a duel walks you away from the
  fight you're in.
- **The Arcane is a real class**: wands and staffs, runes and spells,
  trained with the new **Magic** skill. Its specials are Arcane surge and
  Mana burst. Magic counts toward your combat level.
- **Runecrafting** (new skill):
  - Mine **essence stones** at the Essence rocks (Meadow), and pure
    essence in the Crystal Caves.
  - Take them to one of **eleven shrines** around the map. Each stone
    becomes a handful of runes, more as you level.
  - The runes: air, mind, water, earth, fire, chaos, nature, cosmic,
    astral, law and death.
- **The Spellbook** (Books): 17 spells unlocking from Magic 1 to 50.
  - **Hart's blessing**: needs Bambi beaten, with the antler wand.
  - **Trickster's flurry**: needs Gideon beaten 10 times, with the sly wand.
  - **Petrifying gaze**: needs the Basilisk beaten, with its staff.
  - **Frost nova, Storm of the Isle and Meteor** are learnt only from
    scrolls.
- **Your magic loadout**: equip up to three spells, in order. Each round
  casts the first one you have runes for.
  - A staff pays its own element's runes.
  - Out of runes, you fight on: a staff bash, or fists with a wand.
  - The battle shows what you cast.
- **Magic gear**, made at the new **Enchanting table** in your library,
  with gems:
  - **Wands**: willow, oak, maple, yew, magic, sly and antler.
  - **Staffs**: air, water, earth, fire, Basilisk and mystic.
  - **Hats**: from the wizard hat up to the Archmage's circlet.
  - **Cloaks**, in a new cloak slot.
- **The Mage tower** (on the map): Apprentice, Adept, Mage, Sorcerer,
  Archmage.
  - Each rank needs Magic, Runecrafting and Enchanting levels, then a duel
    with that rank's mage.
  - Losing a duel only means you yield: you don't fall and lose your bag.
  - Winning gives the rank (the better hats and cloaks need it), coins and
    an ancient chest.
  - Duels are hard: bring food.
- **Enchants**, put on things at the **Altar** in your library (new skill
  **Enchanting**):
  - Flaming, Keen, Warding, Vampiric, Arcanist's, Fortune's and Sage's.
  - Each is learnt only from a **tome** in an **ancient chest**.
  - Ancient chests come from bosses (rarely), the far regions' hidden
    caches and the mage tower.
  - The **Enchant book** (Books) shows them.
- The bedroom's picture is fixed.

## 1.0.61 — NeuroPets: a region's places as cards (7 October 2026)

- **A region's places are now simple cards**, like the ones elsewhere.
  - Each card shows an icon, the name, its skill and level, and one line
    for what a click does: Gather here, Hunt here, Send a pet, Talk (❗ when
    a quest is ready), or why it's locked.
  - Click the card to do it.
  - When the region's boss is ready, it gets its own card: ⚔ Fight.
  - The card you're at is outlined in gold.

## 1.0.60 — NeuroPets: item sheets and one card style (7 October 2026)

- **Click anything in your bag** for its sheet:
  - what it does, how many you have (and how many are stored at home), and
    about what Marlow pays
  - **where it comes from**: gathering spots, creatures that drop it, pet
    expeditions, crates, who makes it, who sells it, quest rewards, hidden
    caches
  - **what it's for**: every recipe it goes into, quests that want it,
    house building, the regions it opens, pet food, healing
  - its actions in one place: feed, drink, carry, open, hatch, **Store at
    home**, **Take from your chests**, **Sell at Marlow's**
- **Ingredient chips open the same sheet** on recipes, quests and room
  upgrades, so you can see where to get what you're missing.
- **One card style everywhere**: page sections and the tiles in them share
  the same corners, borders and shading. Bestiary and Herbarium entries
  now look right in light themes too.
- Celebrations and item sheets show above any open window.

## 1.0.59 — NeuroPets: illustrated regions and celebrations (7 October 2026)

- **Every region has an illustrated scene**, drawn in its own colours:
  - Farmyard: a red barn, fences and haystacks.
  - Pasture: a windmill and trees.
  - Meadow: beehives and wildflowers.
  - Forest: rows of trees and red mushrooms.
  - Deep Forest: a moonlit pine forest.
  - Coast: the sea and a lighthouse.
  - Jungle: palms, vines and old ruins.
  - Deep Jungle: a temple.
  - Crystal Caves: glowing crystals.
  - Misty Isle: fog and palms.
  - Frostpeak: snowy peaks.
- **Celebrations:** the big moments pop up with confetti.
  - They cover a level up, a quest done, a secret found, an egg hatched, a
    boss beaten, a room built, a new herb and a rare find.
  - Things that happened while you were away show when you come back, the
    last few at most.
  - Click one to close it.
  - They respect "reduce motion".
- Cards lift a little under the pointer.
- The sidebar's **Map** opens the whole map. Back, from a region's pages,
  still returns to the region.
- The climbing gear is now called a **climbing kit**.

## 1.0.58 — NeuroPets: Today, and the Map as the way around (7 October 2026)

- **Today** is the new first screen:
  - your pet and your stats
  - **what's going on now**: your trip, hunt, exploring, your pet's
    expedition, den pets, eggs and breeding, with live clocks
  - **what's ready for you**: quests to hand in, orders you can fill, herbs
    to identify, crates, eggs, ripe crops, a hurt or hungry pet, a room you
    can build, a full bag
  - **pick up where you left off**: gather, hunt or explore again in one
    click
  - your latest diary entries
  - Click anything to go straight there.
- **The Map is how you get around.**
  - Gathering, hunting and the village now live in its regions.
  - The sidebar keeps only what isn't a place: Today, Map, Home, Bag,
    Player, Equipment, then your pets and your books.
- **Region pages are where you do things.**
  - **Gather** at a spot, **Hunt here**, or **Fight the boss** when it's
    ready.
  - A bar shows what you're doing there, with **Come home**.
  - Clicking a pin on the scene starts it too.
- The map shows what's going on where, with a badge: ⛏ gathering, ⚔ hunting,
  🧭 exploring, 🐾 your pet's expedition.
- The farm is your garden, reached from the Shed at Home.

## 1.0.57 — NeuroPets: your house (7 October 2026)

- **The Workshop page is now Home**, with six rooms:
  - the **kitchen**
  - the **smithy**: furnace and anvil
  - the **shed**: crafting bench, spinning wheel, sawbench, tanner,
    fletching table and compost bin
  - the **library**: herb table, apothecary table and gem bench
  - the **bedroom**
  - the **store room**
- **Every room starts Basic.** Build it up to Sturdy, Fine and Grand.
- **A workshop room limits what its benches can make**, by recipe level:

  | Tier | Makes up to level | Extra xp |
  |---|---|---|
  | Basic | 15 | none |
  | Sturdy | 30 | +5% |
  | Fine | 45 | +10% |
  | Grand | 50 | +15% |

- **Building needs** Construction, planks, stone and coins:
  - Sturdy: plank and stone.
  - Fine: hardwood plank, granite and iron bars.
  - Grand: fine plank, sandstone and gold bars.
- **New skill: Construction.**
  - Train it by sawing logs into planks at the sawbench in your shed:
    - plank (birch, oak, willow)
    - hardwood plank (ash, teak, maple)
    - fine plank (yew, mahogany, magic logs)
  - Every room you build also gives Construction xp.
- **The bedroom:**
  - Your pet's bed shortens naps: Straw 5%, Wooden 8%, Cushioned 10%,
    Royal 15%.
  - Your own bed heals you 10%, 25% or 50% faster.
- **The store room:** chests for 20, 40, 70 or 120 kinds of things, out of
  your bag. What's stored is safe at home, even if you fall.
- **Already playing?** Your rooms start at the tier your skills need, so
  nothing you could make before is locked.
- Recipes that need a better room say which one.

## 1.0.56 — NeuroPets: the World map (part 2): new regions, people and quests (7 October 2026)

- **Three new closed regions:**

  | Region | Needs |
  |---|---|
  | Crystal Caves | a miner's lantern (Smithing 25: iron bars and quartz) and Mining 30 |
  | Misty Isle | a rowing boat, built by Old Salt, and Fishing 35 |
  | Frostpeak Mountains | climbing gear (Crafting 30) and Defence 35 |

  - Each has gathering spots and a lost cache.
  - Each has a hidden spot: the Geode chamber, Pirates' beach or the Ice
    cave.
  - Each has a hidden egg: Crystal Spider, Coral Crab or Frost Ram.
- **Someone lives in each region**, with quests to do in order.
  - Farmer Giles, Shepherd Bess, Beekeeper Nell, Ranger Ash, Old Mab,
    Old Salt and Explorer Reyes have two quests each.
  - Brokk the miner, Castaway Finn and Sigrun the guide have one each.
  - Quests ask you to bring things, beat a region's boss, hunt, find
    secrets or reach a level.
  - Rewards are coins, xp, crates, eggs and charms.
  - **Old Salt builds you the boat** for the Misty Isle.
  - **Explorer Reyes gives you his machete**: another way into the Deep
    Jungle.
- The map marks a region with a **!** when a quest there is ready to hand
  in. Each region's page shows its person, their quest and a checklist.
- The Misty Isle sits out at sea, reached by boat from the Farmyard.
  Frostpeak's snowy land is in the north-west.

## 1.0.55 — NeuroPets: the World map (part 1) (7 October 2026)

- **The World map** (sidebar, under My pet): the village and eight regions
  around it, joined by paths.
  - The regions: Farmyard, Pasture, Meadow, Forest, Deep Forest, Coast,
    Jungle and the Deep Jungle.
  - Click a region to go there.
  - Each region shows how many of its secrets you've found.
- **Each region has its own scene** with its places on it: gathering
  spots, its hunting ground, and its pet expedition. Click one to go
  straight there.
- **Explore**: half an hour out in a region.
  - Now and then you find one of its secrets: a cache of coins and
    crates, a hidden gathering spot, or a hidden egg.
  - Each empty-handed trip makes the next one likelier.
  - A fox, dog, wolf, mole or hare at your side sniffs things out.
  - Otherwise you come back with a few things from around the region.
- **Eight hidden eggs**, one per region, each hatching a pet found nowhere
  else:
  - Golden Hen, Black Sheep, Snow Hare, White Hart.
  - Selkie, Silver Fox, White Tiger, Emerald Serpent.
- **Hidden spots:** the Hidden glade (Forest, Foraging 22), Smugglers' cove
  (Coast, Digging 28) and the Lost temple (Deep Jungle, Digging 48).
- **The Deep Jungle** needs a **machete** (Smithing 35 at the anvil: 2
  mithril bars and a leather) and **Attack 40** to cut through the vines.
  - Inside: the Strangler fig (Foraging 45), the Lost temple, a lost
    explorer's camp, and a vine-wrapped egg.
- Gathering pages now group spots by region.

## 1.0.54 — NeuroPets: bag room, bag search, the notice board, 20 herbs (7 October 2026)

- **Search your bag**: type to find things by name, description or kind.
- **The bag has room for 40 kinds of things.**
  - A stack is one kind, however many are in it. What you wear and the
    tools you carry don't count.
  - More of something you already have always fits.
  - A new kind needs a free space. If there isn't one, it's left behind
    and the diary says what didn't fit.
  - Crafting, buying and opening crates won't start without room.
  - Already over? What's in your bag stays (it shows "over capacity").
    You just can't add new kinds until you make room.
- **Bigger bags from Marlow:**
  - Leather satchel: 55 kinds, 1,500 coins.
  - Rucksack: 70 kinds, 5,000 coins.
  - Explorer's pack: 90 kinds, 15,000 coins.
  - Bottomless bag: 120 kinds, 40,000 coins.
- **The notice board** (Village, Hazel): three orders a day for things you
  gather, mostly from spots you've outgrown.
  - Each order pays more than Marlow would, gives back some of the skill's
    xp, and comes with a wooden crate.
  - Fill all three in a day for an iron crate too.
- **Herbs come as one stack, "Unidentified herb".** Which herb each one is
  stays hidden until you identify it.
  - Wild herbs, crate herbs and expedition herbs can be from any tier,
    likelier near the place's difficulty.
  - **Identify** picks one at random. It either works, or tells you the
    Herblore level it needs.
  - **All** names every one you have the level for.
- **Herbs from crates are unidentified**, and expeditions from the Forest
  onwards bring herbs home.
- **Ten new herbs**, making four per tier:
  - Tier I: feverfew, marigold.
  - Tier II: sage, comfrey.
  - Tier III: valerian, yarrow.
  - Tier IV: mandrake root, wolfsbane.
  - Tier V: dragonroot, starbloom.
- **Ten new potions** at the Apothecary table:
  - Feverfew tonic, Marigold balm, Sage draught, Comfrey poultice,
    Valerian draught.
  - Stoneskin potion, Berserker brew, Hunter's draught, Dragon's blood
    potion, Starbloom draught.
- Pet draughts now say what they do.

## 1.0.53 — NeuroPets: crate hauls, tool wear, mending by hand (7 October 2026)

- **Opening a crate ends with the whole haul**: after each thing is revealed
  one at a time, they all pop up again together (alike ones counted, best
  first) before you close it.
  - Fixed: revealed things used to fade away after popping in.
- **Tools aren't mended by themselves any more**: mending is done by you at
  the workshop.
  - On a trip, when your last tool is nine tenths worn, you still come home
    before it breaks.
  - Auto-mending may come back later as a tool enchantment.
- **Wear climbs with each tier above the tool**: a find one tier above
  costs 1 durability, two tiers 3, three tiers 6, four tiers 10.
  - A bronze trowel barely notices a step up, but wears out fast far
    above it.
  - Spots show it: "Wears your tool ×3".

## 1.0.52 — NeuroPets: Herblore and the Herbarium (6 October 2026)

- **Every potion is made at the Apothecary table now** (Alchemy): the old
  Herb table potions, the salves, and a new top one, the **Moonlight
  draught** (Alchemy 48).
- **Herbs are found unidentified**, in five tiers:
  - **Foraging and digging**: now and then at any spot. The higher the
    spot and your level above it, the more often. Higher spots give
    higher tiers.
  - **Wild spots**: the Herb patch (I), the Wildflower meadow (II), the
    Hazel grove (III), Ginseng hollow and Orchid ledge (IV), and the
    Saffron terrace (V).
  - **Herb pots**: a herb you've never identified comes up unidentified,
    of its tier. Once it's in your Herbarium, it grows as itself.
- **The Herb table identifies them** (Herblore): one at a time or all at
  once.
  - Tiers open at Herblore 1, 10, 20, 30 and 40.
  - A herb you identify for the first time is worth six times the xp.
  - The higher your level above a tier, the more often its herbs come up
    in twos.
- **The Herbarium** (Skills) catalogues all ten herbs: how many you've
  identified, what each one brews, and where each tier is found. One new
  herb, **Moonpetal**, is in tier V.
  - Catalogue a whole tier and its herbs come up in twos more often.
  - Catalogue all ten and you're a **master herbalist**: every 8th potion
    you brew is free.
- Your save carries over:
  - Alchemy starts at your Herblore level, so you can still brew every
    potion you could before.
  - Herbs already in your bag are in your Herbarium.
- Alchemy has its own row on the Player page.

## 1.0.51 — NeuroPets: the Bestiary and the Camp (part 3 of 3) (6 October 2026)

- **The Bestiary** (Village & pets) records every creature your pets meet
  on expeditions, area by area: its stats once met, how often it's been
  beaten and how often it felled a pet.
  - Beat one **5 times** and your pets have **studied** it: they hit it more
    often, and harder.
  - Beat it **15 times** and they've **mastered** it.
- **Ancient relics** come home from clearing the deep areas: sometimes one
  from the Caves, and one or two from each later area.
- **The Camp** (Village & pets) spends relics on lasting upgrades for every
  pet, kept through deaths:
  - **Bigger packs:** a fourth, then a fifth, kind of thing to carry.
  - **Healer's hut:** a treated injury heals a fifth faster, per level.
  - **Training ground:** pets set off with 5% more health, per level.
  - **Scout's tower:** a pet too hurt to face the guardian comes home
    first, unhurt.
  - **Phoenix shrine:** once a day, a pet that would die comes home instead,
    gravely hurt.
- Together with 1.0.49 and 1.0.50, expeditions are now a roguelike: every
  run is risky, the deep areas can take a pet, and each run you make
  leaves the next one better.

## 1.0.50 — NeuroPets: the deadly later areas and the Graveyard (part 2 of 3) (6 October 2026)

- **All 13 expedition areas are open.** The Dungeons, Sky, Volcanic islands,
  Cemetery, Deep forest, Dark forest, Devil's plains and the Void each have
  their own creatures, a guardian, hazards and richer finds.
- **Areas open up as you go.** Each later area opens once a pet has cleared
  the one before it, and stays open for every pet after.
- **The Sky is for flying pets**: chickens, ducks and gulls.
- **Pets can die in the later areas.** A pet that falls there dies 40% of
  the time in the Dungeons, rising to 90% in the Void; otherwise it comes
  home with a grave injury. The Farm to the Caves never kill. What a pet
  wore is lost with it; what it found still comes home.
- **The Graveyard** (Village & pets) remembers every pet lost: its name,
  kind, rarity, level, age, how and where it died, and what it wore.
- **New pet armour:** adamant and rune helms, barding and shoes (Anvil, 44–50).
- Tuned over 250 simulated runs per area, at each area's entry level:

  | Preparation | Dungeons | The Void |
  |---|---|---|
  | Fully prepared (that tier's armour, a charm, 3 food, two draughts) | 90% clear, 3% die | 70% clear, 29% die |
  | Unprepared | nothing clears, and pets die | nothing clears, and pets die |

## 1.0.49 — NeuroPets expeditions become runs (part 1 of 3) (6 October 2026)

- **Expeditions from 3 days old** (was 5).
- **Pets have battle stats:** Health, Attack, Defence and Dodge. They come
  from the pet's level and kind (a tiger hits hard, a bunny dodges), its
  rarity, what it wears, and how happy and fed it is. They're shown at the
  top of Expeditions.
- **An expedition is a run of stages**: 3 on the Farm up to 6 in the Caves.
  Each stage is a fight, a hazard or a find, and the last is the area's
  guardian. Your pet's health carries from stage to stage. You watch it go
  stage by stage, and can call it back keeping what it found.
- **Pack for the road** (3 kinds of thing):
  - cooked food, eaten when it's hurt;
  - draughts, drunk at the start;
  - medicine, which treats an injury on the spot.

  What it doesn't use comes home.
- **Injuries need treating.** A pet that falls comes home with a light
  (Farm, Meadow), serious (Forest, Ocean) or grave (Caves) injury. It
  **won't start to heal until it's treated** with a poultice, salve, strong
  salve or restorative balm. Light injuries heal in 2 hours once treated,
  serious ones in 8, grave ones in 24.
- **New: the Apothecary table and the Alchemy skill.** It makes the
  poultices, salves and balms, plus pet draughts: Vigour, Fury, Guard and
  Swiftness. Salves moved here from the Herb table.
- **Pet armour and charms:**
  - helmets, coats and booties in leather (Crafting bench);
  - bronze, iron, steel and mithril helmets, coats and booties (Anvil);
  - Hunter's, Warding and Swift charms (Gem bench).
- Tuned over hundreds of simulated runs:
  - Unprepared, only the Farm is forgiving (about 6 in 10 first runs clear).
  - With the right armour, food and a draught, the Farm to the Ocean clear
    93–100% of the time.
  - The Caves still clear only about 8 in 10, even fully prepared.
- Coming next: the deadly later areas (Dungeons to the Void), a Graveyard,
  and areas opening up as you go. After that, the Bestiary and camp
  upgrades.

## 1.0.48 — NeuroPets: a fall costs what you carry, not the game (6 October 2026)

- **Falling in a fight no longer ends the game.** You wake at home, hurt,
  with **nothing you were carrying**:
  - gone: your bag, all your coins, the armour and weapon you wore, your
    tools and potions;
  - kept: your skills and levels, pets, farm, home, hatchery and everything
    you've unlocked.

  There's no gravestone, so what you lose is gone. The Hunting page says
  what you lost, and so does the diary. A game that had already ended
  carries on the same way.
- **Creatures drop coins**, more the further out you hunt. Bosses drop a
  bigger purse. Measured at each area's entry level, an hour's hunting now
  earns:

  | Area | Coins an hour (drops + coins) |
  |---|---|
  | Farmyard | about 770 |
  | Pasture | 815 |
  | Meadow | 865 |
  | Forest | 990 |
  | Coast | 1,055 |
  | Deep Forest | 1,145 |
  | Jungle | 1,550 |

  Before, drops alone earned 300–670 an hour and the Farmyard paid best.
- **Bosses are tougher**, now that a fall doesn't end everything: +8% health
  and +1 attack each. At an area's entry level, 5 food wins 9–55% of the
  time and 20 food 34–100%. Hard on arrival, fair a few levels on.

## 1.0.47 — NeuroPets battles: balance, and manual fights (6 October 2026)

- **Battle balance, checked over thousands of simulated fights.** Each boss
  was fought at its area's entry level, with the gear you'd have by then.
  - **Auto-eat now costs your next attack**, as eating by hand always did, and
    takes one bite a round. It used to heal up to three times a round for
    free, so food alone decided every boss fight.
  - **Bosses retuned to a steady climb:**
    - Gideon Fox is a little softer (the first boss).
    - Billy the Kid is a little softer.
    - Bambi no longer dodges 60% of blows. She was a wall: 9% wins even with
      20 steaks.
    - Snapjaw and Grizz are in order.
    - The Basilisk, the last boss, is now properly the toughest. It used to
      fall to 5 sharks.
  - Your question, beating Gideon at combat 6 with only a helmet: that was
    mostly the food. Without food a player like that wins 7% of the time,
    with 5 honeycombs 35%, and with 20 about 90%.
- **Manual boss fights.** Choose **Auto** or **Manual** beside Challenge (it's
  remembered).
  - In Manual, each round waits for your move: **Attack**, your special,
    **Eat** (uses your attack, then they swing), **Run**, **Style**, or
    **Auto** to let it play itself. An auto fight can switch to **Manual**
    too.
  - While a manual fight waits, time doesn't heal you, and the game won't run
    for you. When one more blow could finish you, Attack turns red and asks
    first. Hunting trips stay automatic, as they run while you're away.

## 1.0.46 — A laptop layout, brightness, and a lighter NeuroPets (6 October 2026)

- **Settings → Text & scale → This computer.** Kept on each computer, so the
  laptop and the ultrawide can differ:
  - **Layout: Auto, Roomy or Compact.** Compact puts the menu as icons (its
    arrow still opens it), takes less space around everything, and fits
    Training's tags on one row ("Show all tags" opens the rest), with
    tighter cards and panes. Auto is compact whenever NeuroNet's window is
    narrower than 1,500 points, so the laptop gets it by itself.
  - **Brightness: Normal, Brighter or Brightest.** For a dim screen, it
    lifts a dark theme's backgrounds and lines and makes its text lighter.
    On a light theme it makes the text darker. Pictures stay as they are.
  - **UI scale** is now this computer's own too.
- **NeuroPets closes itself after 10 minutes tucked away**, giving back
  about 1.3 GB. Nothing is lost and nothing pauses. When it opens again it
  catches up on the time that passed — trips, gathering, hatching, farms,
  battles — just as it always did after being shut, and the desktop pet
  card keeps showing your progress meanwhile. Super+Alt+G or the pet card
  start it again.

## 1.0.45 — Housekeeping from the audit (6 October 2026)

Nothing here changes what you see. It makes NeuroNet easier and safer to
change.

- **The backend is split by section.** The 3,500-line list of everything
  the page can ask Python for now lives in eleven files under `api/`:
  photos, creative tools, Media, settings, Kitchen, the desktop, Training,
  Mind and Divination, music and printing. Every one of its 293 calls is
  exactly as it was: checked side by side, the same code running with the
  same names.
- **A check for unescaped text.** A new test reads every page, finds each
  piece of HTML it builds, and fails if a name, title or note goes in
  without being escaped. Text you type must never be read as HTML. It
  found no real problems.
- **Photos uses one listener for the whole gallery** instead of two for each
  photo: 179 instead of 1,925 with 874 photos. Opening, selecting and
  dragging photos work as before.
- Checked and left as it is: splitting Training's data file. Saving the
  whole file takes 7 ms, and changing how your Training data is stored would
  put it at risk for no gain you'd notice.

## 1.0.44 — Find, and the last pictures by address (6 October 2026)

- **Find, on the top bar (or Ctrl+K).** Type a few letters to find:
  - pages and recipes
  - notes
  - Training sessions, circuits and guides
  - Media
  - albums, playlists and songs

  ↑ ↓ to choose, Enter to open:
  - a recipe, note or session opens straight on it
  - a Media item opens on its own page
  - a song, album or playlist plays

  In a note, Ctrl+K still makes a link.
- **Assets and journal pictures now load by address**, like photo thumbnails
  since 1.0.35. Asset tiles are small pictures made once, instead of the
  whole picture sent as text and shrunk in the page. Putting an asset into a
  scrapbook or drawing, and printing a journal book, still use the full
  picture.
- **Photos waiting to load show a soft frame** instead of a blank square.
- Checked from the audit:
  - Lighter desktop widgets: the puzzle engine and the music library cost
    the desktop shell only 10–20 MB. Most of its memory is Quickshell
    itself, the price of keeping the widgets apart from the bar. They stay
    as they are.
  - One shared clock: only one once-a-second clock still runs (the top
    bar's), so there's nothing left to share.

## 1.0.43 — The desktop widgets are back; drag sections into More (6 October 2026)

- **Fixed: no desktop widgets at all.** Since 1.0.36 moved the board, photo
  frame and logo into their own shell, that shell started but never made
  them, and said nothing about it. Now it does, and a test checks the way
  they're loaded.
- **Drag a section into More.** Hold the right mouse button on a section in
  the sidebar, as for moving it, and drop it on **More**, or among the
  sections already in More. Drag it back out among the others to take it
  out. Home always stays in the main list.

## 1.0.42 — Edit desktop: one place to arrange the desktop (6 October 2026)

- **Edit desktop.** Press **Super + Alt + L**, choose **Edit desktop** from
  any widget's right-click menu, or use the button in Settings → Desktop
  widgets. Every NeuroNet desktop widget then shows a dashed outline with
  its name, **⚙** (its settings) and **Hide**: the board's cards, the photo
  frame, the logo and the daily tarot, oracle and Lenormand cards. Drag any
  of them into place.
- **Done** (a bar at the top of the screen), or Super + Alt + L again, ends
  it, and **the widgets stay put**: outside Edit desktop they can't be moved
  by accident. Clicking them works as before.
- **Sticky notes still move whenever you like.** They're notes you work with,
  not part of the layout.

## 1.0.41 — One accent, and a More group (6 October 2026)

- **One colour for actions.** Every section's main buttons, Save buttons and
  selected chips now use the theme's accent. Code's blue, Training's and
  Divination's lighter orange and Music's green are gone from the buttons.
  Each section keeps its own colour where it belongs: its sidebar icon, its
  stripe and its tab.
- **A "More" group at the foot of the sidebar.** Code and Neuro Guide sit
  in it, closed until you press More, and it stays open while one of them is
  on screen. Section names are unchanged. Choose what goes in More in
  Settings → Sections shown ("In More").
- Checked from the audit: loading each section only when it's first opened
  would save about 5 ms of a 250 ms start (all the app's code takes 15 ms
  to start), so NeuroNet keeps loading it all at once.

## 1.0.40 — Media covers that look the part (6 October 2026)

- **Covers made for media without a picture now look like printed sleeves**:
  who it's by along the top, the title set like a poster, a large faint
  initial behind it, and the format along the bottom with the year.
  Before, they were just a title on a colour and looked like placeholders.
- **The Media shelf shows empty cases while covers load** on a first
  visit, instead of a blank space.

## 1.0.39 — Your recipes, Training and decks travel with each release (6 October 2026)

- **Each release now brings starter data with it**, taken from Cam's own
  NeuroNet when the release is made:
  - **Cooking:** every recipe, with its photos (they show in Photos too) and
    its tags.
  - **Training:** sessions, circuits, guides and the document library, with
    the exercise names, equipment and circuit types they use. Clients,
    programs, questionnaires and the calendar stay on their own computer.
  - **One deck of each kind:** Murder Of Crows (tarot), Carnival Of Souls
    (oracle) and Lenormand Of Enchantment (Lenormand). On a computer where
    the desktop's daily card has no deck chosen, these become its decks.
- **It's merged, never overwritten.** New items are added. An item nobody
  has changed on that computer takes the new version. One changed there
  keeps its own version, and one deleted there stays deleted. An item
  removed from the starter goes too, unless it was changed there.
- The deck pictures are large (about 440 MB), so they're downloaded once,
  apart from the release, and again only when they change. NeuroNet merges
  everything the next time it starts. On a brand-new computer it waits
  until the welcome is done.

## 1.0.38 — One source for shared widget code, and quicker saves (6 October 2026)

- **Media's Covers / List switch** now sits at the end of the action row,
  with Add, Formats, Print and Export, instead of between the title and the
  description.
- **The Random movie and Random album cards fit their card.** No more
  scrollbar inside them: the cover takes the room the card has.
- **Music saves in batches.** Your music library file (about 1 MB) used to
  be rewritten after every single change. Now the screen updates at once
  and the file is written once the changes stop (a third of a second), or
  straight away when NeuroNet is put away or closed.
- **The desktop widgets' shared code comes from one place.** Six widgets
  shared the same files, each with its own copy. Each file now has one
  source, and the update builds the widgets from those sources, so a copy
  that was missed can't reach your desktop.

## 1.0.37 — Tidier pages and a lighter Music (5 October 2026)

- **Star a page from its tab.** The ☆ on the open tab adds that page to
  Home's Favourites, and a starred tab keeps its ★.
- **Home's Quick note has a "Sticky note" button** that puts what you
  typed straight onto the desktop as a sticky note.
- **The player is a small pill when nothing is playing**, instead of large
  circles taking the top-left of the bar.
- **Quiet buttons now have an outline**, so "Print…", "Export…" and the
  like look clickable.
- **The bottom bar names a page once** (no more "Settings — Settings").
- **Slim, theme-coloured scrollbars.** The thick bar with arrow buttons is
  gone from every theme; Windows 98 keeps its classic one.
- **Music lets go of its Library list when you're away.** A few minutes
  after you leave music, the hidden list of every song (about 40,000
  elements with 3,243 songs) is cleared, and it's drawn again the moment
  you come back. Music that's playing carries on.
- Checked from the audit: the page's security policy still has to allow
  `eval`, because pywebview builds its bridge to Python with it.

## 1.0.36 — The desktop widgets in their own shell (5 October 2026)

- **The desktop board (with the sticky notes), the photo frame and the
  workspace-1 logo now run in a Quickshell of their own**, apart from
  Omarchy's bar. A problem in a widget can no longer freeze the bar or the
  whole desktop, and if the widgets ever stop, they start again by
  themselves. They look and behave exactly as before.
  - They run as the user service `neuronet-desktop`, started at login.
  - **Game mode** turns them off with the rest of NeuroNet, and back on
    after.
  - **Super+Alt+W** now restarts just the widgets, not Omarchy's bar.
  - The bar widgets, the dock and the tarot, oracle and Lenormand card tools
    stay in Omarchy's shell.
- The update moves them across by itself: it switches them off in Omarchy's
  shell and starts their own.

## 1.0.35 — Lighter and roomier: the audit's first fixes (5 October 2026)

- **Pictures by address.** Photo thumbnails and frames, album covers and card
  thumbnails no longer travel to the page as long strings of text. They come
  from NeuroNet's own private local server, as audio already did, and the
  page's engine keeps and frees them itself. With 874 photo thumbnails and
  217 covers on screen, the page's JavaScript memory fell from 35 MB to
  9 MB and its renderer from 893 MB to 821 MB, with less work on the Python
  side too. Anything that is embedded or edited (boards, scrapbooks, prints,
  full photos) still gets the picture itself.
- **Quieter in the background.** Divination's hidden clock no longer runs all
  day for nothing. The top-bar clock only draws when the window is drawn.
  Puzzles' clock stops while Puzzles is hidden. Training's every-10-seconds
  check runs only while Training is on screen.
- **More room for the page.** A section's pages are now a row of tabs across
  the top, in the section's colour, and the right-hand menu is gone, so every
  page is 210 px wider. Photos keeps its menu (your folders, albums and
  tags). To go back, press the menu button at the end of the tabs; the
  right-hand menu has a button to return to tabs.
- **+ Add photos** now shows only in Photos rather than on every screen.

## 1.0.34 — Sticky notes on the desktop (5 October 2026)

- **Sticky notes replace the Quick note card.** The board's new **Sticky
  notes** card makes notes (on the desktop, or straight on top of your
  windows) and lists them.
  - **Move and size them:** drag a note by its top strip, and size it from
    its corner.
  - **On each note:** **+** a new note beside it; **◐** its design; **📍**
    keep it on top of your windows on every workspace (press again to put it
    back on the desktop); **↪** add it to Fleeting notes, after which it goes;
    **✕** delete it (it asks once).
  - **Designs:** **Theme** follows your Omarchy theme. There are four paper
    colours, or **your own**. Each note can have its own design, with bigger
    or smaller writing, and any design can be the default for new notes.
  - Notes save themselves as you type, and are kept with the desktop's
    settings (`~/.config/omarchy/neuronet-sticky.json`).
- **Your own sticky note design:** Creative → Vector → **+ Sticky note**
  opens a template: the paper, a band along the top where the note's
  buttons sit, a strip of tape, and a dashed writing area. The guide words and
  dashes show while you draw and are never saved. Save it into Assets (it
  suggests the new **Sticky notes** category) and it appears in every note's
  ◐ Design list. For a design you add as a picture, the note offers light or
  dark writing.

## 1.0.33 — M&T: albums live in Media's CDs, and a faster way in (5 October 2026)

- **Albums are gone from the M&T menu.** Every album already stood in
  Media as a CD, with its songs and a Play button, so now that's their
  only home. On Media's covers, the **CD** shelf has:
  - **+ New album**: make one from songs in your library. It goes straight
    onto the shelf and opens so you can add songs and a sleeve.
  - **Shuffle…**: pick CDs, then **Shuffle play** them together or **Save
    as playlist**.
  - On a CD's page, **Edit album…** opens the album's songs, order and
    sleeve. **Back to the CD** returns you to the CD's page.
  - The dashboard's random album opens its CD.
  - The old Albums page's artist filter and drag-to-reorder are not carried
    over: Media's search finds an artist, and the shelf is alphabetical.
- **M&T opens faster.** Its first page, the music Library, drew all 3,000+
  songs at once, with seven listeners on every row and a search of the whole
  file list for each one. Now the first 200 songs appear straight away (in
  about 14 ms rather than 170 ms, in testing), the rest fill in behind, the
  list has one set of listeners, and songs off screen skip layout.

## 1.0.32 — Every printout in the new house style (5 October 2026)

- **One look for everything NeuroNet prints**, the one Training got in 1.0.30:
  clean sans-serif type, the letterhead saying what the document is, a title
  block under it with the name and its facts as small labels, light section
  headings with a green bar, tidy tables with a dark header row, notes in
  quiet panels, and a footer with the print date.
- **Recipes:** source, tags and counts in the title block; ingredients in two
  columns when the list is long; notes in a panel.
- **Shopping lists:** two columns of tick boxes.
- **Recipe books:** a centred cover, a numbered contents list, and each recipe
  on its own page ("Recipe 2 of 5").
- **Media lists and inventories** print as a numbered table per section, with
  only the columns that have something in them.
- **Notebooks:** a title-block cover, a numbered contents list showing what
  each item is, and each chapter opening the same way.
- **Notes guides** now print on the letterhead (they printed bare before).
- **App stats:** charts in the house green rather than the screen's blue.
- **Money:** sheets, the calculation and money books in the house style, with
  totals as tiles and labels.
- **Puzzle books and word searches** take the house type and headings; the
  grids are unchanged.
- **The Divination guidebook and fleeting notes PDFs** follow the same
  type and colours.
- The style is written once (beside the letterhead), so every printout stays
  matched.

## 1.0.31 — Training: the training log (5 October 2026)

- **Log, from a session's or a program's ⋯ menu.** It prints a log for
  tracking your lifts week by week:
  - the athlete, start date and units (kg or lb) at the top
  - a short **guide**: record the weight of your **middle set** (set 2 of
    3, set 3 of 5), why that one, and how to progress
  - every lift by block, in its block colour, with its target (sets × reps,
    load) and which set to record
  - a box for each week to write the weight in
- **Sessions:** choose 1 to 10 weeks.
- **Programs** use their own length: the weeks in their blocks, or else their
  months. Each week's target (RIR, RPE, load) is printed under its number.
- More than six weeks turns the page to landscape; more than ten carries on
  in a second table.
- **Save the log as Excel** to type your weights in instead.
- Warm-up and cool-down blocks are left off the log.

## 1.0.30 — Training: a professional print refresh, and the coaching stopwatch (5 October 2026)

- **New coaching mark.** The stopwatch is now Training's mark on every
  printout and every Word and PDF export, on its Bookshelf card, and in the
  sidebar and the bar's launcher.
- **Printouts look more professional.** Every Training printout has a cleaner
  layout:
  - The letterhead says what the document is ("Training session",
    "Training program").
  - A title block below it gives the name, with tags, equipment and how many
    exercises.
  - Coach's notes sit in a panel, keeping their paragraphs.
  - Section headings are lighter, and the exercise tables are tidier.
  - The footer has the print date.

  The block colours (A green, B yellow, C pink, warm-up amber) are kept.
- **Programs print as a full workbook:**
  - the overview as cards
  - a week-by-week table (RIR, RPE, load) for each block
  - a list of the sessions
  - then every session on its own page, laid out like a session printout,
    with its notes, tags, equipment and write-on post-session lines
- **Word exports** use Arial with proper margins and wider exercise columns,
  and print programs one session per page with their notes.
- The colours across print, Word, Excel and PDF move from navy to the
  coaching mark's deep green.

## 1.0.29 — NeuroPets: the spinning wheel (5 October 2026)

- **A spinning wheel in the Workshop** (your Crafting skill), as in
  RuneScape:
  - **Ball of wool** from wool (Crafting 1).
  - **Bow string** from a flax and a sap (Crafting 10), or two horsehairs (12).
  - **Crossbow string** from two flax and a sap (Crafting 15).
  - **Thread** from silk (Crafting 18).
- **A flax field** in the Meadow (Foraging 10), so flax is picked like in
  RuneScape as well as farmed. Because that makes flax easy, a bow string
  also takes sap, which comes from oak, willow and maple trees.
- **Knitting at your bench:** a woven rug from four balls of wool, and for
  your pet a bobble hat and a woolly jumper (a little better than the leaf hat
  and woven vest).
- Bow strings are no longer made from flax alone at the crafting bench, and
  wool no longer spins into thread; both moved to the wheel.

## 1.0.28 — NeuroPets: a use for nearly everything (5 October 2026)

- **Essence amulets.** At the gem bench (Gemology 32), 10 essences, a gold bar
  and a sapphire make an amulet for that gathering skill: +15% xp and 10%
  faster there. Essences finally have a use.
- **Pelts tan into leather:** fox pelts and sealskins into soft leather; wolf,
  bear and big-cat pelts into hard leather.
- **Fibres:** wool and silk spin into thread, horsehair into bowstrings,
  quills into feathers.
- **More woods for arrow shafts:** applewood, ash, driftwood and pine (more
  shafts per log the rarer the wood).
- **At the furnace:** gold nuggets smelt into gold bars, and sulphur works as
  a flux, so adamant and rune bars need half the coal.
- **At the compost bin:** pondweed or chalk with dung makes fertiliser, peat
  with dung makes rich fertiliser.
- **New jewellery:** a quartz ring (accuracy) and an obsidian necklace (+1 max
  hit).
- **Bird's nests open** like crates, with seeds inside.
- **Granite and sandstone** go into the hatchery's new nest and the
  windowsill shelf.
- **Six fish you could never catch now bite:** minnows, crayfish, eels,
  catfish, piranhas and lagoon snappers turn up as by-catch.
- Where there's more than one way to make something (leather from a hide or a
  pelt), each way has its own button.
- Things with no use other than selling: 44 → 14 (the rest are treasures,
  weeds, sand and seashells).

## 1.0.27 — NeuroPets: every pet has a knack, and the diggers arrive (5 October 2026)

- **Every kind of pet helps as your companion** (only bunnies, frogs and cats
  did before). Gathering and making pets add 10% xp (20% while happy) to
  their skill: chickens cook, cows farm, sheep and spiders craft, horses
  smith, boars smelt, snakes and deer brew, gulls fletch, crabs cut gems,
  goats mine, dogs and hedgehogs dig, ducks and seals fish, pigs and hares
  forage, elk cut wood. Fighting pets help in a fight: wolves add Attack,
  foxes and leopards Ranged, bears and rams Defence, tigers max hit.
- **Moles, tarantulas and giant anteaters** hatch from the new **Burrow egg**,
  found now and then digging at Digging 30 and up (and sometimes sold by
  Marlow). They're the pets that can go digging for you.
- **The exotic egg no longer hatches Gideon or Billy.** Boss pets come only
  from beating their boss. Moles and anteaters took their place.

## 1.0.26 — NeuroPets: tools that last a trip, reels and spades (5 October 2026)

- **No more tools breaking while you're away.** When a tool is nine tenths
  worn on a trip, it's mended on the spot if you carry what mending takes
  (half its makings and half the fee). If you don't, and it's your last one,
  you come home before it breaks, and the diary says what to bring.
- **Better reels:** steel (Fishing 20), mithril (30), adamant (40) and rune
  (50), smithed at the anvil. Fishing to 50 takes about 52 hours now (was 73).
- **Digging tools at last:** bronze and iron trowels, then steel, mithril,
  adamant and rune spades. Digging to 50 takes about 54 hours (was 108).
- **A magic basket** (Foraging 40, woven from magic logs) lasts all day at the
  Jungle's top spots.

## 1.0.25 — NeuroPets: a fairer economy (5 October 2026)

- **Prices follow the level.** What you gather now sells for more the higher
  the level of the place it comes from, so each ore, log and fish up the
  ladder is worth more than the one before (mithril is worth more than gold
  now, and gold rocks are no longer the best money until runite). Coins an
  hour climb steadily from about 650 at level 1 to about 2,600 at level 50.
- **Made things are worth what went into them**, plus a little: a smithed
  pickaxe sells for more than its bars and the fee.
- **Mira the alchemist is fairer:** 3 of one ore, log or gem make 1 of the
  next (2 copper and 2 tin make an iron ore), for a small fee. Still dearer
  than gathering it yourself, but a real way to get a material before you
  can gather it.
- **Things worth saving for:**
  - Marlow keeps **two rare things a day** (rare and uncommon eggs, iron
    crates, rich fertiliser, super healing potions and the rarer seeds).
  - **Another nest in the hatchery** (3,000 coins, then 8,000): one more egg
    at a time.
  - **A shelf for the windowsill** (2,500, then 6,000): three more herb pots.
  - Zeph's exotic egg is now 2,500 coins, and he brings iron crates.
- A merchant's price is never less than twice what the thing sells for, so
  nothing can be bought and sold on at a profit.

## 1.0.24 — NeuroPets: Farming to 50 (5 October 2026)

- **Six new crops** up to Farming 48: flax (20), cabbage (25), sweetcorn
  (30), melon (35), dragonfruit (42) and starfruit (48). Their seeds turn up
  while foraging in the Meadow, Forest, Deep Forest and Jungle; Marlow sells
  flax and cabbage seeds.
- **Two new herbs for the windowsill:** ginseng (32) and saffron (44), so the
  rarer Herblore ingredients can be grown as well as foraged.
- **Plots 5 and 6** at Farming 30 and 40.
- **New uses:** flax spins into bowstrings at your crafting bench; cabbage
  soup, corn chowder, dragonfruit tart and starfruit pie in the kitchen (they
  heal 12 to 26).
- **Less watering.** A **Water all** button waters every thirsty plot at
  once, and a **steel watering can** (Smithing 22) keeps a crop watered from
  the moment you water it until harvest.

## 1.0.23 — NeuroPets: adamant and rune (5 October 2026)

- **Rune bars.** Smelt runite ore with eight coal at the furnace (Smelting
  48). Adamant bars came in 1.0.21.
- **Adamant (level 40) and rune (level 50) at the anvil:** pickaxes and
  hatchets (tiers 5 and 6: faster, longer-lasting, and a rune pickaxe never
  wears on runite), full armour sets (Defence 10 and 12 a piece, with the
  metal's gathering xp bonus), and swords (attack 20 and 24).
- **Rune arrows and bolts** (Ranged 50) for a Hunter's last step.
- **Teak and mahogany have a use.** Adamant tools, the adamant sword and the
  adamant crossbow take teak; rune tools, the rune sword and rune bolts take
  mahogany.
- About 20 things that could only be sold now have a use (adamantite, runite,
  magic logs, teak, mahogany, snapshell and the rarer forage). The rest get
  uses in a later update.

## 1.0.22 — NeuroPets: Herblore to 50, with potions for you (5 October 2026)

- **Your own potions.** The herb table now has new brews every few levels up
  to Herblore 50, made from potted herbs and the rarer forage (ginseng,
  glowcaps, truffles, orchids, vanilla, saffron, royal jelly), moss and
  seaweed:
  - **Healing potions** (minor, healing, super: heal 8, 14, 24) work like
    food: drink one, or pick it for auto-eat.
  - **Combat potions** (attack, defence, ranging, strength, and super versions
    of each) last a number of fights.
  - **Gathering draughts** add gathering xp (10% or 20%), and the **Fortune
    draught** gives a 15% chance of a double find. They last a number of finds.
  - **Elixir of the isle** (Herblore 50) boosts attack, defence, ranged and
    max hit for 50 fights.
- **Drinking.** Use the new Drink button in the Bag, on the Hunting page or on
  a gathering page. When a potion wears off, you drink another of the same
  from the bag on your own, so it keeps going on a long idle trip.
- Herblore now takes about 129 hours of gathering to reach 50 (was 309), and
  there's something new to make all the way there.

## 1.0.21 — NeuroPets: a Hunter's road to 50, and swords that hold their own (5 October 2026)

- **Better arrows and bolts.** Steel (Ranged 20), mithril (30) and adamant
  (40) arrows and bolts, fletched from new arrowheads you smith at the anvil.
- **New bows.** A **yew longbow** (Ranged 30, from yew logs) and a **magic
  bow** (Ranged 40, from magic logs, which finally have a use), plus **steel,
  mithril and adamant crossbows** (Ranged 20, 30, 40) for bolts. Fletching
  now has new things to make all the way to level 49.
- **Adamant bars.** Smelt adamantite ore with six coal at the furnace
  (Smelting 40).
- **Swords are the steady choice.** The iron, steel and mithril swords hit
  harder (8, 12 and 16). Boss weapons are now side-grades: a little less
  power for their effect. The Sly Striker, Horn Maul, Pincers, Quickshot and
  Antler bows are toned down, Grizz's Claws gain +2 max hit and the Fang Spear
  gains accuracy. The long bow and compound bow are stronger (7 and 10).

## 1.0.20 — NeuroPets: every kind of armour has a job (5 October 2026)

- **Class leathers are the best armour for their class.** Every piece now has
  the same Defence across the set, and the class it suits gets +1 Defence a
  piece on top: **snakeskin** (Defence 20) gives a Hunter 6 Defence, +2 ranged
  and accuracy a piece; **armadillo** (Defence 30) gives a Berserker 9
  Defence, attack and damage soak a piece, more than mithril; **bat leather**
  gives the Arcane 6 Defence and dodge. **Hard leather** (Defence 10) is
  tougher than iron (5 a piece) for anyone.
- **Metal is the all-rounder.** Bronze to mithril keep solid Defence for
  their tier and the gathering xp bonus. It's the outfit for skilling, and a
  sound choice for fighting.
- **Boss sets trade a little Defence for their effect.** Nimble Fox, Brawler,
  Fleet, Sylvan, Snapshell, Grizzly and Gorgon pieces now have a bit less
  Defence than metal at the same level. Their effects (true strike, brace,
  dodge, healing, hard shell, max hit, reflect) are why you'd wear them. The
  Brawler set's brace is now 6% a piece (30% for the whole set, was 50%).
- **Cloth and soft leather are light**: you gather 2–3% quicker in each piece,
  so they're worth wearing for skilling early on instead of being skipped.

## 1.0.19 — NeuroPets: boss rematches, richer boss drops and Snapjaw's set (5 October 2026)

- **A boss's kill count is a one-time unlock.** The first time, a boss still
  shows up after the area's full count (50 in the Farmyard up to 500 in the
  Jungle). After that, win or lose, a rematch needs only a short count: 10
  kills in the early areas, rising to 25 in the Jungle.
- **Bosses drop more.** Every boss now drops 6–10 of its special material
  (was 3–5). A whole boss set and its weapon now takes about 120 kills
  (Nimble Fox) to 850 (Gorgon), where it used to take 750 to 14,500. The
  essence spots (50 wins) take about 540 to 1,725 kills, down from 2,500 to
  25,000.
- **Snapjaw's set.** The Coast's boss now has a set: **Snapshell** helm,
  plate, gauntlets, greaves and boots (Defence 22, made at your anvil from
  Snapjaw's shell and iron bars). Each piece takes 0.2 off every blow, so the
  full set takes 1 off each one. **Snapjaw's Pincers** (Attack 22) are a crushing
  weapon with a 20% chance of a second hit.

## 1.0.18 — NeuroPets: a fairer Coast and Jungle, and Basilisk can be beaten (5 October 2026)

- **The Coast is gentler.** Crabs, seagulls and seals hit like the Deep
  Forest's wolves and bears, though the Coast opens six levels earlier. They now
  hit less hard and less often, and Snapjaw is a little softer (200 health),
  so it can be beaten from around level 30.
- **The Jungle is survivable.** Tigers, leopards, anacondas and giant spiders
  hit less hard, so a Jungle hunt lasts the full 12 hours from about level 44
  without food, or from the moment you're allowed in with some on auto-eat.
- **Basilisk can be beaten.** Basilisk has 320 health (was 420) and hits less
  hard, so it's a fair fight at level 45–50, which opens up the Gorgon set,
  the Fang spear and the Jungle's essence spots.

## 1.0.17 — NeuroPets: auto-eat, faster healing, armour that soaks blows, safe retreats (5 October 2026)

- **Auto-eat.** On the Hunting page, pick a food to auto-eat and a health line
  (30–80%, half by default). While you hunt, and between fights, you eat it on
  your own whenever your health drops below the line, so an idle hunt can last
  the whole 12 hours. The hunt summary says how much you ate.
- **Healing grows with Hitpoints.** You heal 1.4 health a minute at
  Hitpoints 10, rising to 3 a minute at 50 (it was 1 a minute at every level).
- **Armour soaks damage.** Besides making you harder to hit, your armour's
  Defence now takes a share off every blow: a twelfth in full bronze, a third
  in full mithril, at most 40%. The Hunting page shows your share.
- **No more one-hit deaths.** You now run from a fight (and come home from a
  hunt) as soon as your health is low enough that one blow could finish you,
  as well as at your retreat line. You won't set out, or face a boss, in that
  state either. Setting the retreat to "never" is still a fight to the death.

## 1.0.16 — NeuroPets: a tidier game, class leathers and better foraging (4 October 2026)

- **A decluttered sidebar.** The row for every skill is gone. **Outskirts**
  holds the gathering skills (Foraging, Fishing, Mining, Lumbering, Digging,
  Farming) as cards with your level, tool and wear; **Workshop** holds every
  crafting station (furnace, anvil, benches, tanner, kitchen, compost bin).
  The **Village** is now just its people: Marlow, Zeph on Sundays, Mira and
  Iris. A "‹ Outskirts" link in the top bar takes you back from a skill page.
- **A new Player screen**: you up top (class, total and combat level, coins,
  health), combat stats and gear bonuses beside your class, and every skill
  as a compact row grouped Gathering / Making / Combat — click one to train it.
- **Foraging works like Mining**: one card per material, each mostly its own
  thing (acorns at Oak woodland, cotton at Cotton bushes, honeycomb at Wild
  hives ...), with dearer finds higher up — wild ginseng (28), truffle oaks
  (38), vanilla vines (47), saffron (50), rock pools with pearls (32), royal
  jelly from the hives. The top spots need a better basket: willow, then the
  new **maple** (tier 3) and **yew** (tier 4) baskets from your bench.
- **Class leathers.** Tan **hard leather** (cow hide, Crafting 15), **snake
  leather** (snakeskin), **bat leather** (bat wings) and **armadillo leather**
  (armadillo hide) at the tanner, then sew full sets at your bench. Anyone can
  wear them, but the class each suits gets more from every piece: snakeskin
  gives a **Hunter** extra ranged and accuracy, armadillo gives a
  **Berserker** extra attack and takes less damage, bat leather gives the
  **Arcane** extra dodge (once Arcane opens).
- **New creatures:** bats in the Forest and Deep Forest, armadillos in the
  Deep Forest and Jungle.

## 1.0.15 — NeuroPets: your own workshops, coins, wear and mending (4 October 2026)

- **No more crafters — the skills are yours.** Bram, Fen, Opal, the tailor,
  the carpenter, the apothecary and Fern have handed over: the village is now
  your own **Furnace** (Smelting), **Anvil** (Smithing), **Crafting bench**,
  **Tanner**, **Fletching table**, **Herb table** (Herblore), **Gem bench**
  (Gemology), **Kitchen** and **Compost bin** (Farming). What the crafters had
  learned becomes your level (Bram's level is your Smithing, and so on).
- **Smelt bars, then smith.** Ore goes into the furnace as bars (bronze from
  copper + tin, iron, silver, gold, steel, mithril); the anvil makes tools,
  armour, weapons, needles and chisels from bars.
- **Coins.** The furnace, anvil and tanner cost a few coins to run (a bronze
  bar 1, a bronze pickaxe 5, tanning a hide 5). Everyone gets a purse of 100.
- **Marlow the merchant** buys anything you can spare and sells needles,
  chisels, clay pots, seeds, worms, feathers and stone pickaxes.
- **Zeph the travelling merchant** is in the village **on Sundays only**: he
  sells **exotic eggs** (rare, special and sometimes legendary pets) and pays
  half as much again for your goods.
- **Mira the alchemist** turns a lot of one thing into one of the next: 20
  copper + 20 tin into an iron ore, and so on up to runite; logs up to magic
  logs; cut gems up to diamonds. For a fee, and no xp.
- **Iris the reskinner** arrives once you've beaten two bosses: paint any pet
  in your own colours (150 coins), or buy an exotic skin — Starlight, Lava,
  Frost, Gilded, Shadow, Bubblegum (600–1,200 coins). It shows on the desktop
  card too.
- **Tools wear on harder materials.** A tool gathers its own tier forever (a
  bronze pickaxe mines copper and tin indefinitely), but each ore or log above
  its tier wears it: bronze lasts 150, iron 250, steel 400, mithril 600. You're
  warned at 75% and 90%; **mend it** at the anvil (or bench) before it breaks
  for half the materials and half the fee — a "Mend it" button sits on the
  skill page and in your tools. If it breaks, it's gone.
- **Everything you make with is used up**: needles go with each thing sewn,
  pots of water with each gem cut (the chisel is kept).
- **Gemology** is its own skill: cutting gems and setting rings and necklaces.

## 1.0.14 — NeuroPets: stone tools, steel, mithril and gem cutting (4 October 2026)

- **Mining: copper and tin have their own rocks.** The Quarry is now Copper
  rocks and Tin rocks (both level 1) — a trip already at the Quarry carries
  on at the Copper rocks.
- **Iron rocks at level 15**, RuneScape-style (silver moved to 18, after iron).
- **Stone tools for beginners.** Stone, flint and clay can be mined by hand
  at the Stone wall and Clay pit. At your Crafting bench: a **stone pickaxe**
  (10 stone, 5 twigs) — used up by each copper or tin ore, about as quick a
  road to ore as digging fragments — and a **stone hatchet** (8 stone, 6 twigs)
  that lasts 15 logs on the softest trees. Stone is too soft for iron and
  above: that needs bronze or better.
- **Steel and mithril.** Bram smelts steel bars (an iron ore and two coal) and
  mithril bars (a mithril ore and four coal), and makes steel and mithril
  pickaxes, hatchets, armour and swords (Defence/Attack 20 and 30).
  Adamantite rocks now need a steel pickaxe, runite rocks mithril, the magic
  tree a steel hatchet.
- **Gem cutting in Crafting.** Rough gems become opal, jade, topaz, sapphire,
  emerald, ruby and diamond — finer gems need a higher level and more rough
  gems. You need a chisel (Bram makes them) and a pot of water (a clay pot,
  made and filled at your bench); both are kept. Opal the jeweler sets cut gems
  into rings and necklaces.

## 1.0.13.1 — A tidier Vector toolbar (4 October 2026)

- **Vector: the tool column no longer spills into the drawing.** The Sides
  and Points boxes were wider than the column and ran out over the canvas;
  each label now sits above its box, inside the column.

## 1.0.13 — Vector (4 October 2026)

- **Creative → Vector — a vector drawing tool.** Shapes, paths and lettering
  that stay sharp at any size, laid out like Inkscape and Illustrator:
  - Tools: select, direct select (edit nodes and their handles), pen,
    pencil (smoothed), line, rectangle, ellipse, polygon, star, text,
    eyedropper and hand, with the usual letter keys. Shift and Alt work as
    you'd expect (square, circle, from the centre, 45° lines, drag a copy).
  - Fill and stroke with colours, linear and radial gradients, stroke
    width, dashes, ends and corners, opacity; swatches from the built-in
    palettes or the drawing's own colours.
  - Size, move and turn with handles or exact numbers; flip; align and
    space evenly; front/back ordering; group and ungroup; layers you can
    hide and lock.
  - **Combine shapes:** union, subtract, intersect and exclude, plus
    simplify and add-a-node.
  - Start from any of the 62 clip art pieces as real, editable shapes;
    place assets and photos; open or import **SVG files (Inkscape's
    too)** — transforms, colours, see-through and text come with them.
  - Export **SVG** (for Inkscape, the web, cutting machines) or **PNG** at
    any size. Save into Assets as In progress or Completed works — saved as
    an SVG picture that's sharp on any scrapbook page or cover, and Edit
    opens it again in Vector.

## 1.0.12 — Pixel art (4 October 2026)

- **Creative → Pixel art — an Aseprite-style sprite editor.** Tools down the
  side (pencil, eraser, paint bucket, line, rectangle, ellipse, eyedropper,
  move — with Aseprite's letter keys), brush sizes, mirror drawing, a pixel
  grid and zoom. Layers (show/hide, opacity, reorder, duplicate, merge down)
  and animation frames in a timeline along the bottom, with frame timings,
  onion skin and Play. Palettes: NeuroPets, PICO-8, DawnBringer 16, Sweetie 16,
  Endesga 32, Game Boy and Greys built in; make your own, or import GIMP .gpl,
  Lospec .hex, JASC .pal, Paint.NET .txt or the colours of a picture.
  Export to **.aseprite** (layers, frames, timings, palette) or **PNG** — one
  frame or a sprite sheet, at any scale.
- **Start from a NeuroPets template** — every pet, creature, egg, item and
  your player. Pets come as a four-frame idle animation (open, blink, open,
  happy) on Colour, Outline and Face layers, ready to build on.
- **Assets: In progress and Completed works.** Sprites (and anything you
  create) can be saved as in progress; one click moves a piece to Completed
  works. Uploads are completed works.
- **Assets: Game assets** — all of NeuroPets' art, each one opening in Pixel
  art as a starting point.

## 1.0.11.1 — The NeuroPets key works again (4 October 2026)

- **Super+Alt+G opens and tucks away NeuroPets again.** Omarchy's own
  default uses that key for "move window out of group", so the updater had
  stopped adding NeuroPets' shortcut (and had tidied away the copy you'd been
  using). NeuroNet now deliberately takes that key over from Omarchy's default,
  but still never takes a key you've set up yourself.

## 1.0.11 — Creative and Scribe (4 October 2026)

- **New main section: Creative.** Scrapbook, Boards, Paper creator and Assets
  now live together in Creative (room for a vector-graphics tool and a pixel-art
  tool later). **Super+Alt+B** opens it from anywhere; it's in the launcher on
  the bar and in the Omarchy menu too.
- **The Vault is now called Scribe** — Notes, Cells, Fleeting, Notebooks,
  Ebooks, Bookmarks and Guides. Still Super+Alt+N; nothing inside it moved.
- A section NeuroNet adds later now appears beside its neighbours in a menu
  you've rearranged, not at the very bottom.

## 1.0.10.1 — Landscape printing (3 October 2026)

- **Print landscape as well as portrait.** In the Paper creator the page is
  now a clear Portrait / Landscape choice, and when printing several to an A4,
  A3 or Letter sheet you choose which way up the sheet goes (Best fit,
  Portrait or Landscape) — it tells you how many fit each way.
- **The Scrapbook prints.** A new Print… button in the scrapbook editor: every
  page or the one on screen, on A4 / A3 / Letter or its own size, portrait or
  landscape, shrunk to fit the sheet when a page is bigger (a 12 × 12 page fits
  a landscape A4 at 65%). New scrapbooks can also be 11 × 8½ landscape.
- Covers print with the same choices.

## 1.0.10 — Paper creator, notebook covers and Assets (3 October 2026)

- **Vault → Paper creator — paper printed at exactly your size.** Lined,
  grid, dot grid, isometric dots, Cornell notes, music staves or blank, at A4,
  A5, A6, B6, pocket (3½ × 5½ in), passport, traveler's notebook, Letter, half
  letter or any size you type. Set the spacing, margins, line weight and
  colours, add a margin line or a title-and-date line, and save the ones you
  like as **My papers**. Print any number of pages at the page's own size, or
  several to an A4 / A3 / Letter sheet with cut marks (two A5s or four A6s to an
  A4, edge to edge, with dashed cutting lines).
- **Notebook covers.** Design a cover with the Scrapbook's tools — tape,
  frames, stickers, words, photos, clip art and your assets — at your
  notebook's size: front only, or wrap-around (back, spine, front) with any
  spine width (0 for a stapled pocket notebook) and optional 3 mm bleed, on
  leather, kraft, wood, linen, denim and more. Fold and safe-area guides show
  while you work and never print. Add a page for the inside of the cover.
  Prints at its real size, or on a bigger sheet with cut marks.
- **Vault → Assets.** One place for everything the Scrapbook, Boards and
  covers use, by category: clip art, stickers, backgrounds & papers, borders &
  frames, tapes & ribbons, words & labels. Upload pictures, import a whole pack
  of bought files at once, take them from Photos, drop them on the page — or
  create your own with the Scrapbook's editor (it saves as a see-through
  picture and opens again for changes).
- **62 pieces of built-in clip art** — leaves, flowers, mountains, compasses,
  anchors, banners, laurels and more — each recolourable from the palette.
- **Assets in your projects.** The Scrapbook's materials panel now has
  *Assets & clip art* (filter by category, search), and Boards has the same
  panel, folded away until you want it. A background asset fills the page.
- **Notes: choose a note and press Delete.** Click a note (or folder) in the
  sidebar and press Delete; Ctrl+click chooses several. It still asks first.

## 1.0.9.2 — Daily updates that always run (3 October 2026)

- **The daily update check now actually runs every day.** If you logged in
  more than 10 minutes after the computer started, the check never ran that
  day. It now runs 10 minutes after you log in and once a day, and catches up
  on a day it missed while the computer was off.

## 1.0.9.1 — Steadier updates (3 October 2026)

- **Updates no longer crash the top bar and desktop widgets.** An update
  restarted the shell while it was still loading the widget files it had
  just been given, and the shell crashed (it came straight back, but left a
  crash report and a "process crashed" notice). It now waits a moment first.
- **NeuroPets: bronze tools need less tin** — the pickaxe and hatchet take 2
  tin again (they'd gone up to 4), the bronze reel 1 (from 3).

## 1.0.9 — NeuroPets, a game of its own (3 October 2026)

- **NeuroPets — a new game, in its own window.** Raise a pixel pet from a
  surprise egg, then grow it into an idle game: your own character with
  Foraging, Fishing, Mining, Lumbering, Digging, Cooking, Crafting and
  Farming; a village of crafters who level up as they work; expeditions,
  crates and eggs; a hatchery, breeding and a Petapedia; hunting with live,
  turn-by-turn battles (fight styles, specials, eating, running), bosses and
  boss pets; essence spots that open after 50 boss wins; a farm with plots
  and a windowsill of herb pots. Every area has its own gathering spots for
  every skill (Farmyard to Jungle, levels 1 to 46, with new fish, fruit, ores,
  woods and buried finds), and RuneScape-style tiers: fish from shrimp and
  sardines up to sharks and manta rays (small net, rod and bait, fly rod,
  lobster cage, harpoon — the village makes them), cooked fish that heal more
  the better the catch, ores up to runite and logs up to magic, and a new
  Coast area with crabs, seagulls, seals and Snapjaw the boss. Each skill's
  page is a grid of cards, one per material, Melvor-style. It has its own app icon and shortcut
  (**Super+Alt+G** — again to tuck it away), a Melvor-style look (a sidebar of every skill with its
  level, a coloured bar on top showing what you're doing, toasts for every
  message), and a developer **Sandbox** switch for testing on a copy.
- **NeuroPets on the desktop**: a widget with your pet walking about its card
  (feed, play, rest, clean), and Skill, Farm and Hunt views — a live mini
  battle with Fight, Special, Eat and Run, and what each trip or hunt has
  collected so far.
- **Desktop widgets stopped taking clicks** (clicks went through to the
  wallpaper and opened the wallpaper picker) after switching back to
  workspace 1. Fixed.
- **Training viewer**: picking a session from the list while scrolled down
  kept the old scroll position and logged an error. Fixed.

## 1.0.8 — Glowing borders, desktop widgets that do more, and a safer NeuroNet (2 October 2026)

- **Glowing window borders in every theme.** Settings → Appearance: one
  switch gives every Omarchy theme the NeuroNet theme's lit-up border, in
  that theme's own colours. Every theme on this computer has its colours
  built in, and one added later gets colours picked for it. Off, each theme
  has its own border again.
- **How solid the desktop widgets are**: a slider in Settings → Desktop
  widgets, from see-through to solid. Reset puts each widget back to its own.
- **Training viewer on the desktop**: your sessions and circuits on a board
  card, in Training's block colours, with ‹ › and a list to choose, and
  **Print** for the same sheet the app prints. NeuroNet needn't be open.
- **Training viewer: settings and notes.** Right-click its title (Settings…)
  or ⚙: text size, and how solid the box behind the session is. **Note** adds
  a dated note to the session or circuit on screen, in a pinch.
- **Session builder on the desktop**: build and save a session without
  opening anything. Type to find exercises, blocks follow on (A1, A2 … New
  block: B1), with sets, reps, load and rest on each row. It saves into
  Training → Sessions.
- **Code → Web playground**: HTML and CSS on the left, the page on the right,
  changing as you type (or on Ctrl+Enter). Your pages are kept, and Export
  saves one as an .html file. The preview is sealed: scripts never run in it,
  and nothing in it can reach NeuroNet or the internet.
- **Recipes on the desktop**: a widget of your recipes as pictures (or a
  word list, in its settings, with the text size too), searchable, with your
  favourites first. Click one and it opens right there, with Print.
- **Favourite recipes**: ♥ a recipe in the Kitchen or on the desktop, and it
  sits above the A to Z list in both.
- **A modern Kitchen**: recipes as photo cards, and a recipe page with its
  photo across the top, ingredients you can tick off as you cook and numbered
  steps. It opens beside the list now, not below it.
- **New visualizers**: six free-flowing styles (Ribbons, Silk, Bars, Dots,
  Pulse, Waves) in Neon, Aurora, Sunset or your theme's colours. They move
  with the music's real highs and lows, in Music → Visualizer and on the
  desktop.
- **A visualizer in the Music widget**: ≋ shows it, and its settings pick
  the size (Small, Medium, Large), the style and the colours.
- **Session builder**: every exercise that matches your search, in a list
  that scrolls.
- **Settings for every desktop widget**: ⚙ on each one (or right-click its
  title → Settings…). **Size** (Small, Medium, Large: one to three columns
  wide, and taller too), **text size**, and its own **background** from
  see-through to solid. Plus what fits each one:
  - the Random album deals a new album when you ask, every hour or each
    morning, and can land face up;
  - Quick media starts on your format;
  - the Puzzle opens on your game, bigger with Size;
  - Today shows only the parts you want;
  - the Fleeting viewer starts at the oldest or the newest note;
  - the Clock grows with Size.
- **Super+Alt+W restarts the desktop widgets** (the shell), when you need it.
  It keeps a short report of how they were first, to help track down what
  went wrong.
- **♥ your songs and add them to playlists**: ♥ and + in NeuroNet's player
  bar, the desktop Music widget and the top bar's music player. + opens a
  small list of your playlists right by the button, and goes away when
  you're done. Your ♥'d songs gather in **♥ Favourites**, at the top of
  Playlists.
- **The guide on the back of your daily card**: right-click a turned card
  (tarot, oracle or Lenormand) and it turns again to its guide, on purple
  fading to black at the bottom. Click to turn back.

Fixed:

- **Updates no longer switch your theme to NeuroNet.** Every update put the
  NeuroNet theme back; the theme is now only offered the first time NeuroNet
  is installed.
- **Security, the whole app.** NeuroNet's window now only ever shows
  NeuroNet's own pages. Web links open in your browser, and nothing can steer
  the window to a website, which would have been handed NeuroNet's connection
  to your computer. Pages can only run NeuroNet's own scripts. PDFs open with
  pdf.js's script engine off. Another way into NeuroNet, through its local
  server, is sealed shut.
- **Desktop widgets that stopped taking clicks.** A drag the desktop never
  saw finish could leave an invisible layer over the widgets. Now a drag that
  stops moving is let go after 3 seconds, and the widgets' clickable areas
  are refreshed every few seconds.

## 1.0.7 — Scrapbook, a Drop zone, and your bug list (2 October 2026)

- **Scrapbook**, a new page in the Vault, after Boards. A shelf of your
  scrapbooks, each showing its cover. Inside are the **same tools as Boards**
  (text, photos, shapes, pencil, layers, pages, undo, snapshots, Export PNG),
  plus:
  - **A materials panel** down the right, which folds away. Click a material
    to put it on the page, or drag it where you want it. The colour palette
    recolours whatever is chosen.
    - **Tape:** striped, polka-dot, gingham, floral, heart, star, chevron and
      plain washi, masking tape and clear tape, all with torn ends.
    - **Frames:** Polaroid (with a caption underneath), film strip, torn edge,
      scalloped, vintage ornate, photo corners, mat board, round and stitched.
      Double-click a frame to put a photo in it.
    - **Stickers made from your photos.** Cut to a circle, heart, star,
      scallop or rounded square, or **cut out** from a plain background, with
      a white die-cut border. They're kept in a **sticker book** to use again.
    - **Embellishments:** ribbon bow, twine, button, paper clip, push pin,
      doily, pressed flower, leaf, glitter, sequins, ticket stub, gift tag,
      bracket label, postage stamp, postmark, heart, star and staple.
    - **Words:** label maker, typewriter slip, handwritten, letter stickers,
      pennant banner, rubber stamp and a lined journal card.
  - **Paper for each page:** cardstock, kraft, linen, dotted, lined, squared,
    watercolour, vintage, cork or glitter card, in any colour. Change one
    page, or every page at once.
  - **A cover:** wood, fur, colour, metal, leather, linen, denim, velvet, cork
    or kraft, in any colour, with its title on a label.
  - **Turn left / Turn right** angles what's chosen.
- **A scrapbook can go in a notebook**, so it prints and exports with the rest.
- **Drop zone on the desktop.** A new desktop board card: drag files onto it.
  Pictures go to Photos (folder *Dropped*), PDFs and EPUBs to Ebooks, and text
  files (or dragged words) become Fleeting notes. It says where each one went;
  the file you dragged stays where it was.
- **Photos in the Scrapbook's materials panel.** Your newest photos at the
  top of the panel, with a search. Click one to put it on the page (or into
  the frame that's chosen), or drag it: onto a frame, it fills the frame.
- **Move a photo inside its frame.** Right-click a photo (in a frame, or on a
  board): the rest of it shows faintly round the frame. Drag to choose what
  shows, scroll to zoom in, and Esc or a click elsewhere when it's right.
- **Copy on the desktop Fleeting viewer**, so a note can go anywhere without
  opening NeuroNet.
- **Export all to PDF** in Vault → Fleeting: every fleeting note in one PDF,
  in queue order, then opened.
- **Reset stats** in Settings → App stats. Time, sections, music, launches,
  prints and exports start again from now (the old record is kept as a
  backup).
- **Enter answers the box on screen**: a Delete box, an Add or Edit form,
  anywhere in NeuroNet. A field that uses Enter itself (adding a type, a tag)
  still does; a text area still takes a new line.
- **A NeuroNet screensaver**: Omarchy's screensaver with NeuroNet's name.
  Switch between NeuroNet's and Omarchy's (kept as it was) in Settings →
  Desktop widgets → Screensaver, with a Preview.

Fixed:

- **Scrapbook: double-click to add a photo works every time** (it often did
  nothing). It opens NeuroNet's own photo picker.
- **Oracle and Lenormand daily cards** no longer flash on and off the desktop,
  and their pulls show in the Today card's slots (on a new install the
  desktop never saw them).
- **Desktop widgets switched off in Settings hide at once**, with no restart.
- **Widgets can go in the top left again.** Hidden widgets left invisible
  spots there that pushed the others away; a hidden widget now gives its spot
  up. On a new install the widgets now share one layout from the start.
- **The daily cards stay off the desktop until you choose Show on desktop.**
- **Closing a daily card's reading goes back to the desktop**, never into a
  NeuroNet tool.
- **Playing an album from the bar** when NeuroNet isn't open starts it hidden,
  instead of opening the whole app.
- **App stats count time only while NeuroNet is in front.** Putting the popup
  away (or using another window) stops the clock at once; it used to go on
  for up to five minutes.

## 1.0.6.1 — Vault and Notes swap names (2 October 2026)

- **The Vault is the main section now, and Notes its first page** (they were
  the other way round): Vault → Notes, Boards, Cells, Fleeting, Guides,
  notebooks and ebooks. Super+Alt+N opens it as before.
- The NeuroNet ISO is built from this version, with automatic updates on.

## 1.0.6 — M&T, the Bookshelf, and your photos by name (2 October 2026)

- **M&T (Media and Things).** Music and Stuff are one main section now: your
  music (Library, Albums, Playlists, Visualizer) and your Media and
  inventories, in one place. Super+Alt+M opens its music pages, Super+Alt+I
  its media pages.
- **Media and Shelf are one page.** M&T → Media opens on your covers, with a
  **Covers / List** switch, and one **+ Add** (with Formats, Print and Export).
- **Covers are chosen when you add something**, in the Add / Edit dialog,
  from your Photos (it opens on Photos → Covers; type to search the rest). A
  new picture, a still from a film, or one you paste or drop goes into
  Photos → Covers first. Covers you'd already set were moved there too.
- **Every case is the shape of the real thing.** A CD is square like an album
  sleeve, and so is vinyl; books, cassettes, Switch, PlayStation, Xbox,
  SNES / N64 and DS / Game Boy cases each have their own shape.
- **Your Music albums are on the shelf as CDs**: all 227, with their covers,
  artist and year (four CDs you already had were joined to their albums).
  Making a new album in Music asks whether to put it on the shelf too. A CD's
  page lists the album's songs and plays from any of them.
- **The Bookshelf, on the desktop.** A workspace-1 widget with all your books
  on a shelf: Ebooks with their covers, and the books you make in Training,
  Puzzles, Notes, the Kitchen and Money, each in its section's colour. Click
  one to read it; closing it takes you back to the desktop.
- **A reader for every book.** Day, Sepia or Night paper, zoom in and out
  (A− / A+, Ctrl + mouse wheel, Ctrl + / −), and Print.
- **Money → Books.** A book of your budget: a run of months or fortnights,
  with the Calculation sheet and your savings goals if you like. Always up to
  date, on the Bookshelf, and printable.
- **Photo files are named like your photos.** A photo you've named has a file
  of that name (Dad Mum and Milly.jpg), so you can find it when browsing your
  files. Every named photo was renamed once (with a backup first), and any
  you name or add from now on follows.
- **Fleeting viewer text size.** A− / A+ on the desktop's Fleeting notes card
  and the dashboard's Fleeting viewer, remembered; a long note gets a
  scrollbar you can drag.

**Fixed**

- **The file picker opens in front of the tool.** Choosing a picture (a cover,
  say) opened the file explorer behind the tool window.
- **Apps opened while a tool is up stay separate from it.** Print, a browser
  or a film opened from a tool used to sit inside the popup and close with
  it; now the tool turns into a window beside the new app. Its key puts it
  away again.
- **Opening a second note, recipe or book from the desktop no longer hides
  NeuroNet.**
- **Renaming a photo keeps the Kitchen's pictures.** A recipe's photo could be
  left pointing at the old name.
- **NeuroNet's own tests can't touch your things any more** (on 1 October a
  test run wrote junk into your library and emptied the photo index; it was
  restored the same day).

## 1.0.5 — the NeuroNet logo, your way (1 October 2026)

- **Workspace 1 has your usual wallpaper again**, the same as every other
  workspace, with the NeuroNet logo on top.
- **The logo is a desktop widget.** Drag it anywhere, and your other widgets
  keep clear of it wherever it goes. Right-click it for **Settings**: its size
  (a slider), its colour (NeuroNet green, your theme's accent, or one of eight
  others), a shadow so it reads on any wallpaper, and **Back to the top
  centre**. **Hide** it from the same menu, and bring it back in NeuroNet's
  **Settings → Desktop widgets**.
- **The eye under the logo** only shows while NeuroNet or NeuroNet Light is
  your theme, since those are the two it switches between.
- **Moving widgets is smooth now.** Dragging the logo, the photo frame, a
  board card or a daily card no longer lets go part-way, so you can carry one
  right across the screen in one go.

## 1.0.4 — Code: an IDE, guides, research and data structures (1 October 2026)

- **A new Code section** (Super+Alt+E, E for editor). **IDE** is Algorithm,
  built in: projects, an editor that colours Python, JavaScript, Rust, HTML
  and CSS, a PDF or markdown guide beside your code, and a terminal.
- **Guides**: snippets, tutorials and notes on good design, laid out like
  the Neuro Guide. Code in them can be copied, and some can be run right
  there. Fourteen to start with, and you can add and edit your own.
- **Data Structures**: eleven classic structures, each explained (what it
  costs, the design lesson in it) beside Python and JavaScript you can run.
  Each one checks itself when it runs, and Side by side shows both languages
  at once. Add your own, or add more languages to any of them.
- **Research**: study a folder of your own code like a code review.
  Highlight, add notes and draw labelled boxes, write an overview, and export
  it all as one markdown review. Your code is never changed.

## 1.0.3 — shortcuts that stay open, a safer install (1 October 2026)

- **NeuroNet's shortcuts open it and leave it open.** If a computer still had
  its own NeuroNet shortcuts from before the installer, each key worked twice —
  NeuroNet flashed up and hid again at once. The installer now replaces those
  older lines with its own (keeping any it doesn't have, like a class-timer
  key) and says what it replaced.
- **NeuroNet can't be installed into the computer's system folders.** If a
  copy lands in `/` or a system folder, the installer stops and says where to
  put it instead, and the daily update won't copy anything there.

## 1.0.2 — new wallpapers (1 October 2026)

- **New wallpapers for both themes**, Cam's own pictures. NeuroNet: seven —
  the green brain (the one it opens with), the brain in colour, the glowing
  brain, the cosmic brain, the spine, the book and the barbell. NeuroNet
  Light: four — the brain in the clouds (the one it opens with), the brain in
  a server room, the notebook outside and the barbell. Cycle through them with
  Omarchy's next-background shortcut.
- A computer that had the old drawn wallpapers gets the new ones with this
  update, and its NeuroNet theme is refreshed so they show straight away.

## 1.0.1 — Oracle and Lenormand, each on its own (1 October 2026)

- **Oracle and Lenormand are separate tools now**, like Tarot: three glyphs
  on the bar (✦ Tarot, ☾ Oracle, ❖ Lenormand), each pulling only its own
  kind, each with its own *Show on desktop*. Before, one tool did both and
  reopened on whichever kind was used last — so the Today card's Oracle slot
  could pull a Lenormand card, leaving the Oracle space empty, and the desktop
  cards could keep popping up and down.
- Today's Lenormand card and its past pulls move across on their own.
- **Desktop widgets** (Settings) has a switch for each.

## 1.0.0 — the first NeuroNet System (30 September 2026)

The first NeuroNet you can install on a new computer from a USB stick.

**A NeuroNet computer**
- **The NeuroNet ISO.** Boot it, install, log in: Omarchy with NeuroNet on
  it, installed offline from the stick. At first login NeuroNet sets itself
  up — widgets, dock, themes, shortcuts — and opens on its welcome.
- **The welcome.** *Bring my NeuroNet across* imports an export from another
  computer; *Start fresh* begins with nothing.
- **Export & import** (Settings). Everything of yours in one file, optionally
  locked with a password, to move NeuroNet to another computer — including how
  the desktop was set up. Music and films are copied across separately.
- **Data folder** (Settings). Move NeuroNet's things to another drive: copied,
  checked file by file, the old folder kept. If that drive isn't plugged in,
  NeuroNet says so rather than opening empty.

**The desktop**
- **Desktop widgets** (Settings) and **right-click → Hide** on any widget.
- Hiding a section in **Sections shown** also turns its keyboard shortcut off.
- On a laptop with two graphics cards, NeuroNet draws on the built-in one —
  the NVIDIA card is left free (better battery).
- Lighter widgets: the board's clock, the photo frame and the bar's music
  title no longer work while no one can see them.

**The Neuro Guide**
- A manual for all of NeuroNet and Omarchy, with pictures, *Open in NeuroNet*
  buttons and a printable / PDF edition.

**Also**
- "Coach Cam" is now "Coaching" everywhere you see it.
- The class timer is gone (it wasn't used).
- PowerPoint export needs one extra piece on a new computer, once it's
  online: `omarchy pkg aur add python-pptx`.
