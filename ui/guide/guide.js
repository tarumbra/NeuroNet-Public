/* ==========================================================================
   SS.NeuroGuide — the Neuro Guide: NeuroNet's (and Omarchy's) manual.
   ==========================================================================
   NeuroNet System plan, Stage 4 (2026-09-29). Cam: "a manual built for
   NeuroNet based off omarchys one. That breaks everything down and how to
   use but in an easy to digest manner and using a split UI like training
   uses atm, so when you click an item it will display on the right. This
   can even be built into NeuroNet now as a main section and then the sub
   sections on the right hand sidebar can be the sections of the manual. I
   want the manual to have some colour and match neuronets branding."
   Then: "Manual should be called Neuro Guide", "Yes Manual should include
   all omarchy and NeuroNet", and screenshots from sample data, not Cam's.

   THE SHAPE. A main section, "Neuro Guide", whose subsections -- the right
   sidebar -- are its chapters. A chapter is a split: its topics listed on
   the left (searchable), the chosen one read on the right. Every chapter
   has its own colour; the section is in NeuroNet's brand green.

   BUILT IN, like Notes -> Guides (ui/notes/guides.js): the guide describes
   the system, so it ships with it -- nothing to save, nothing to lose.

   KEPT TRUE BY A TEST (test/test_neuro_guide.js), as Notes' guides are:
   every NeuroNet shortcut here is the one in system/hypr/bindings.lua.block,
   every Omarchy one is in Omarchy's own bindings, and every main section of
   NeuroNet has a page. A manual that quietly goes out of date is worse than
   none, because it's believed.
   ========================================================================== */
(() => {
  "use strict";
  const esc = (s) => String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  /* ---- little helpers for the pages (all content below is written here,
          trusted, never typed in by anyone) ---- */
  const KEYNAME = {backslash: "\\", bracketright: "]", bracketleft: "[", RETURN: "Enter",
                   SUPER: "Super", ALT: "Alt", SHIFT: "Shift", CTRL: "Ctrl", SPACE: "Space",
                   ESCAPE: "Esc", PRINT: "Print", TAB: "Tab", DELETE: "Delete"};
  /** "SUPER + ALT + N" -> key caps */
  const keys = (combo) => combo.split("+").map((k) => k.trim()).filter(Boolean)
    .map((k) => `<kbd>${esc(KEYNAME[k] || (k.length === 1 ? k.toUpperCase() : k[0] + k.slice(1).toLowerCase()))}</kbd>`)
    .join('<span class="ng-plus">+</span>');
  const tip = (html) => `<div class="ng-tip"><b>Tip</b>${html}</div>`;
  const know = (html) => `<div class="ng-know"><b>Good to know</b>${html}</div>`;
  const steps = (...li) => `<ol class="ng-steps">${li.map((x) => `<li>${x}</li>`).join("")}</ol>`;
  const keyTable = (rows) => `<div class="ng-scroll"><table class="ng-keys">
    <tbody>${rows.map(([combo, what]) => `<tr><td class="ng-k">${keys(combo)}</td><td>${esc(what)}</td></tr>`).join("")}</tbody>
    </table></div>`;

  /* ---- the shortcuts: data, so the test can check every one ---- */
  // NeuroNet's own -- exactly system/hypr/bindings.lua.block (checked by the test)
  const NEURONET_KEYS = [
    ["SUPER + ALT + O", "NeuroNet, the whole app (again to hide it)"],
    ["SUPER + ALT + H", "Home"],
    ["SUPER + ALT + N", "Scribe"],
    ["SUPER + ALT + B", "Creative"],
    ["SUPER + ALT + P", "Photos"],
    ["SUPER + ALT + W", "NeuroStream: music, your films and shows, and TV (again to tuck it away)"],
    ["SUPER + ALT + M", "NeuroStream too (M for music)"],
    ["SUPER + ALT + T", "Training: NeuroTrain, where it's installed (again to tuck it away)"],
    ["SUPER + ALT + C", "Money (Cashbox)"],
    ["SUPER + ALT + R", "Kitchen"],
    ["SUPER + ALT + Z", "Mindfulness"],
    ["SUPER + ALT + Q", "Puzzles"],
    ["SUPER + ALT + D", "Divination"],
    ["SUPER + ALT + I", "M&T: your inventories"],
    ["SUPER + ALT + E", "Code (E for editor)"],
    ["SUPER + ALT + A", "Search NeuroNet in the Omarchy menu — notes, recipes, and NeuroStream's albums"],
    ["SUPER + ALT + X", "Capture: drag a box on screen, and it goes into Photos"],
    ["SUPER + ALT + U", "Claude dock: tuck the chat you're in into the bar, or bring one back"],
    ["SUPER + ALT + backslash", "NeuroStream music: play / pause"],
    ["SUPER + ALT + bracketright", "NeuroStream music: next track"],
    ["SUPER + ALT + bracketleft", "NeuroStream music: previous track"],
  ];
  // Omarchy's — each is in `omarchy menu keybindings` (checked by the test)
  const OMARCHY_KEYS = [
    ["SUPER + SPACE", "The Omarchy menu — open any app by typing its name"],
    ["SUPER + K", "Every shortcut, listed"],
    ["SUPER + RETURN", "A terminal"],
    ["SUPER + SHIFT + B", "The browser"],
    ["SUPER + SHIFT + F", "The file manager"],
    ["SUPER + W", "Close the window"],
    ["SUPER + F", "Full screen"],
    ["SUPER + T", "Float a window / tile it again"],
    ["SUPER + 1", "Workspace 1 — NeuroNet's home screen (2 to 9 the others)"],
    ["SUPER + SHIFT + 2", "Move the window to workspace 2 (any number)"],
    ["SUPER + TAB", "The next workspace"],
    ["ALT + TAB", "The next window"],
    ["SUPER + LEFT", "Focus the window to the left (any arrow)"],
    ["SUPER + C", "Copy (in any app)"],
    ["SUPER + V", "Paste (in any app)"],
    ["SUPER + CTRL + V", "Everything you've copied lately"],
    ["SUPER + CTRL + E", "Emoji"],
    ["PRINT", "Screenshot"],
    ["ALT + PRINT", "Record the screen"],
    ["SUPER + CTRL + L", "Lock the computer"],
    ["SUPER + ESCAPE", "Lock, suspend, restart or shut down"],
    ["SUPER + SHIFT + CTRL + SPACE", "Pick a theme"],
  ];

  /* ---- the chapters ---- */
  const CHAPTERS = [
    {
      id: "start", name: "Getting started", icon: "i-bulb", colour: "#5FA665",
      intro: "What NeuroNet is, and the few things worth knowing on day one.",
      topics: [
        {id: "what", title: "What NeuroNet is",
         blurb: "One place for the things you do for yourself — on a desktop built around it.",
         body: `
          <p>NeuroNet is two things that work as one:</p>
          <ul>
            <li><b>The NeuroNet app</b> — your photos, music, notes, journal, training,
              recipes, money, puzzles, divination and more, in one window.</li>
            <li><b>The NeuroNet desktop</b> — built on <b>Omarchy</b> (a clean, fast Linux
              desktop): a home screen with NeuroNet's widgets, a dock, its own themes, and
              shortcuts that bring any part of NeuroNet up in a second.</li>
          </ul>
          <p>You rarely need to "open NeuroNet": it's already running quietly in the
            background. Press a shortcut and the part you want appears over whatever
            you're doing; press it again and it tucks away.</p>
          ${tip(`Start with ${keys("SUPER + ALT + O")} — the whole app — and ${keys("SUPER + 1")},
            the home screen.`)}`},
        {id: "welcome", title: "The welcome, on a new computer",
         blurb: "Bring your NeuroNet across in one go, or start fresh.",
         body: `
          <p>The first time you log in on a new computer, NeuroNet opens by itself on
            <b>Welcome to NeuroNet</b>. Three choices:</p>
          <ul>
            <li><b>Bring my NeuroNet across</b> — pick the export file you made on your other
              computer, type its password, and everything comes over: photos, notes,
              journal, training, money, cards, and how your desktop looked.</li>
            <li><b>Start fresh</b> — an empty NeuroNet, yours to fill.</li>
            <li><b>Later</b> — it asks again next time you log in.</li>
          </ul>
          ${know(`Music and films don't come in the export — they're far too big. Copy them
            across on their own (see <b>Moving to a new computer</b>).`)}`},
        {id: "moving", title: "Moving to a new computer",
         blurb: "One export, one file, one import.",
         body: `
          <p>On the computer you're moving <i>from</i>:</p>
          ${steps("Open NeuroNet, then <b>Settings → Export &amp; import</b>.",
                  "Type a password, twice. It's recommended — the file holds your journal, money and contacts.",
                  "<b>Export to a file…</b> and choose where to save it. With a password it's a <b>.nnx</b> file.",
                  "Send the file to the new computer — LocalSend, or a USB stick.")}
          <p>On the new computer, use <b>Bring my NeuroNet across</b> on the welcome, or
            <b>Settings → Export &amp; import → Import from a file…</b></p>
          ${know(`An import adds and replaces; it never deletes. Anything it replaces is kept
            first, in <b>import-backups</b> inside NeuroNet's data folder.`)}
          ${tip(`To bring your music too, copy the <b>chords/music</b> folder from NeuroNet's
            data folder across, into the same place on the new computer: NeuroStream plays it from there.`)}
          <p>There's no way into a locked export without its password — keep it somewhere safe.</p>`},
        {id: "eye", title: "Light and dark: the eye",
         blurb: "One click switches the whole computer between NeuroNet and NeuroNet Light.",
         body: `
          <p>Under the NeuroNet name on the home screen (workspace 1) is a small eye.</p>
          <ul>
            <li><b>Closed</b> — you're in <b>NeuroNet</b>, the dark theme.</li>
            <li><b>Open</b> — you're in <b>NeuroNet Light</b>.</li>
          </ul>
          <p>Click it to switch. Everything follows: windows, the bar, the dock, the widgets,
            the terminal — and your wallpaper stays the same picture, in its light or dark version.</p>
          ${know(`The eye is only there while NeuroNet or NeuroNet Light is the theme — the two
            it switches between. Pick any other theme and it goes; pick one of NeuroNet's again
            and it's back.`)}
          ${tip(`Change the wallpaper itself from the Omarchy menu (${keys("SUPER + SPACE")}), or
            pick any other theme with ${keys("SUPER + SHIFT + CTRL + SPACE")}.`)}`},
        {id: "gamemode", title: "Game Mode",
         blurb: "Free up memory for a game, then bring NeuroNet back.",
         body: `
          <p>The gamepad icon at the right of the top bar is <b>Game Mode</b>.</p>
          <ul>
            <li><b>On</b> (it lights up) — NeuroNet, its widgets and its shortcuts stop, and
              the memory they used is free for your game. Omarchy's own shortcuts keep working.</li>
            <li><b>Off</b> — everything comes back where it was.</li>
          </ul>
          ${know(`If the computer restarts while Game Mode is on, it switches itself off at the
            next login.`)}`},
      ],
    },
    {
      id: "desktop", name: "Your desktop", icon: "i-home", colour: "#6aa9e0",
      intro: "The home screen, its widgets, the dock and the top bar.",
      topics: [
        {id: "dock", title: "The dock",
         blurb: "Your apps along the bottom — and three ways for it to hide.",
         body: `
          <p>The dock sits at the bottom of every workspace. The <b>neuron</b> on its left opens
            all your apps. The line running under the icons lights up a dot for each open window;
            the focused one glows.</p>
          <ul>
            <li><b>Click</b> an app to open it or switch to it; <b>middle-click</b> for a new window.</li>
            <li><b>Right-click</b> an app to pin it, unpin it, move it, or close it.</li>
            <li><b>Right-click the neuron</b> for the dock's settings.</li>
          </ul>
          <p>In its settings choose how it hides:</p>
          <ul>
            <li><b>Always show</b> — windows keep clear of it.</li>
            <li><b>Auto-hide</b> — touch the bottom edge of the screen to bring it up.</li>
            <li><b>Tuck away</b> — touch the bottom edge and a small neuron appears; click it to
              bring the dock up.</li>
          </ul>
          <p>Its settings also set the background's see-through-ness, the icon size, and let you
            search for any app to pin.</p>`},
        {id: "bar", title: "The top bar",
         blurb: "Workspaces, the clock, and NeuroNet's quick tools.",
         body: `
          <ul>
            <li><b>Left</b> — the Omarchy menu, NeuroNet's quick access (every section, one
              click away), and your workspaces.</li>
            <li><b>Middle</b> — the day and time (click for the date), weather, updates.</li>
            <li><b>Right</b> — Game Mode, music, a fleeting note, today's tarot, oracle and Lenormand cards,
              and Omarchy's own: Wi-Fi, Bluetooth, sound, battery, power.</li>
          </ul>
          ${tip(`The fleeting-note icon lets you jot a thought from anywhere — it lands in
            Scribe → Fleeting as the next numbered note.`)}`},
      ],
    },
    {
      id: "omarchy", name: "Omarchy basics", icon: "i-grid", colour: "#8f7ad6",
      intro: "The desktop NeuroNet is built on: windows, workspaces, apps and settings.",
      topics: [
        {id: "tiling", title: "Windows arrange themselves",
         blurb: "Open a window and it takes its share of the screen — no dragging.",
         body: `
          <p>Omarchy is a <b>tiling</b> desktop: each new window gets its share of the screen,
            and the others make room. You move between them with the keyboard.</p>
          ${keyTable([["SUPER + LEFT", "Focus the window to the left (any arrow key)"],
                      ["SUPER + SHIFT + LEFT", "Swap it with the one to the left (any arrow)"],
                      ["SUPER + T", "Float a window over the others / tile it again"],
                      ["SUPER + F", "Full screen"],
                      ["SUPER + W", "Close the window"]])}
          ${tip(`Hold ${keys("SUPER")} and drag with the left mouse button to move a window, or
            with the right button to resize it.`)}`},
        {id: "workspaces", title: "Workspaces",
         blurb: "Nine desktops, one key each.",
         body: `
          <p>Think of workspaces as separate desks. ${keys("SUPER + 1")} to ${keys("SUPER + 9")}
            jump between them; ${keys("SUPER + SHIFT + 2")} (any number) moves the window you're
            in to another.</p>
          <p><b>Workspace 1 is NeuroNet's home screen</b>, with your widgets — keep your work on
            the others, and come back to 1 for the quick things.</p>`},
        {id: "apps", title: "Opening apps",
         blurb: "Super + Space, type, Enter.",
         body: `
          <p>${keys("SUPER + SPACE")} opens the Omarchy menu. Start typing an app's name and press
            ${keys("RETURN")}. The same menu has <b>Setup</b> (Wi-Fi, displays, keyboard),
            <b>Install</b> (more apps), <b>Style</b> (themes, wallpapers, fonts) and more.</p>
          ${tip(`${keys("SUPER + ALT + A")} opens the same menu on NeuroNet: search your notes,
            albums and recipes and open them straight in NeuroNet.`)}`},
        {id: "copy", title: "Copy, paste and screenshots",
         blurb: "The same keys in every app.",
         body: `
          ${keyTable([["SUPER + C", "Copy — in any app, terminal included"],
                      ["SUPER + V", "Paste"],
                      ["SUPER + CTRL + V", "Everything you've copied lately — pick one to paste"],
                      ["PRINT", "Screenshot: drag a box, or click a window"],
                      ["ALT + PRINT", "Record the screen"],
                      ["SUPER + ALT + X", "Capture straight into NeuroNet's Photos"]])}`},
        {id: "look", title: "Themes and wallpapers",
         blurb: "NeuroNet's two themes — and every Omarchy one.",
         body: `
          <p>NeuroNet comes with <b>NeuroNet</b> (dark) and <b>NeuroNet Light</b>; the eye on the
            home screen switches between them. Each has five wallpapers drawn for it — a neural
            field, a brain, a spider web, a library and the NeuroNet name.</p>
          ${keyTable([["SUPER + SHIFT + CTRL + SPACE", "Pick any theme"],
                      ["SUPER + SPACE", "The Omarchy menu — Style → Background for the wallpaper"]])}
          ${know(`NeuroNet's app has its own themes too (Settings → Appearance). "Follow Omarchy"
            makes the app take its colours from the desktop's theme.`)}`},
        {id: "updates", title: "Updates and power",
         blurb: "Keeping it current, locking up, shutting down.",
         body: `
          <p>When updates are waiting, an icon shows in the middle of the top bar — click it.
            Or: ${keys("SUPER + SPACE")} → <b>Update</b>. Updates ask for your password.</p>
          ${keyTable([["SUPER + CTRL + L", "Lock the computer"],
                      ["SUPER + ESCAPE", "Lock, suspend, restart or shut down"]])}
          ${know(`A new computer's first update matters: until it's done, nothing new can be
            installed. NeuroNet's installer offers to run it for you.`)}`},
      ],
    },
    {
      id: "keys", name: "Keyboard shortcuts", icon: "i-letters", colour: "#e2a03f",
      intro: "Every NeuroNet shortcut, and the Omarchy ones worth knowing.",
      topics: [
        {id: "neuronet", title: "NeuroNet's shortcuts",
         blurb: "Super + Alt + a letter: any part of NeuroNet, over whatever you're doing.",
         body: `
          <p>Each of these floats NeuroNet over your screen on that section; the same keys again
            put it away.</p>
          ${keyTable(NEURONET_KEYS)}
          ${know(`Game Mode switches these off (and back on) — Omarchy's own keep working.`)}`},
        {id: "omarchy", title: "Omarchy's shortcuts",
         blurb: "The desktop's own keys.",
         body: `
          ${keyTable(OMARCHY_KEYS)}
          ${tip(`${keys("SUPER + K")} shows every shortcut on the computer — searchable.`)}`},
      ],
    },
    {
      id: "sections", name: "NeuroNet's sections", icon: "i-neuron", colour: "#c98ad6",
      intro: "What each part of NeuroNet is for.",
      topics: [
        {id: "home", title: "Home", blurb: "Your dashboard, calendar and contacts.",
         body: `<p>Where NeuroNet opens: a dashboard of widgets you arrange yourself (press
          <b>Edit layout</b> and drag them), your <b>calendar</b> and <b>contacts</b>.
          Your favourite sections live here too.</p>`},
        {id: "photos", title: "Photos", blurb: "Your photo library: albums, folders, tags.",
         body: `<p>All your photos, sorted by date, with <b>albums</b>, <b>folders</b> and
          <b>tags</b>. <b>Add photos</b> at the bottom of the left menu, or drag them onto the
          window. ${keys("SUPER + ALT + X")} captures a part of the screen straight in.</p>`},
        {id: "training", title: "Training", blurb: "Coaching: sessions, circuits, programs, athletes.",
         body: `<p><b>Coaching</b> lives here: sessions, circuits, an exercise library, guides,
          a calendar, programs, training books, athletes and calculators. Sessions and books
          print on NeuroNet's letterhead.</p>`},
        {id: "notes", title: "Scribe", blurb: "Notes, Cells, Fleeting, notebooks, ebooks and bookmarks.",
         body: `<p>Everything written: <b>Notes</b> (Markdown notes, linked together — choose one
          and press Delete to delete it, Ctrl+click to choose several),
          <b>Cells</b> (spreadsheets), <b>Fleeting</b> (quick numbered
          thoughts), notebooks, ebooks and bookmarks. <b>Scribe → Guides</b> explains Notes,
          Boards and Cells in detail.</p>`},
        {id: "creative", title: "Creative", blurb: "Scrapbook, Boards, Paper creator, Pixel art, Vector and Assets — making things.",
         body: `<p>Everything you make: the <b>Scrapbook</b> (pages of photos, tape, stickers and words,
          each on its own paper, in a cover of wood, fur, metal and more), <b>Boards</b> (a canvas for
          shapes, arrows, text and mind maps), the <b>Paper creator</b> (lined, grid, dot and more,
          printed at exactly A4, A5, A6, pocket or your own size, portrait or landscape, several to a
          sheet with cut marks — and notebook covers designed with the Scrapbook's tools),
          <b>Pixel art</b> (sprites and game assets the Aseprite way: tools down the side, layers and
          animation frames in a timeline, onion skin, mirror drawing, palettes built in, made by you or
          imported from .gpl, .hex, .pal or a picture; every NeuroPets sprite as a starting template;
          export to .aseprite or PNG, one frame or a sprite sheet), <b>Vector</b> (shapes, paths and
          lettering that stay sharp at any size: pen and pencil, shapes, editable nodes, gradients, align,
          group, and combining shapes — union, subtract, intersect, exclude; clip art opens as real
          shapes; SVG in and out, so Inkscape picks up where it leaves off) and
          <b>Assets</b> (clip art, stickers, backgrounds, game assets and your own pictures by category,
          with an <b>In progress</b> folder for what you're still working on and <b>Completed works</b>
          for what's finished). ${keys("SUPER + ALT + B")} opens it from anywhere.</p>`},
        {id: "kitchen", title: "Kitchen", blurb: "Recipes, menus and shopping lists.",
         body: `<p>Your <b>recipes</b> (with scaling and conversions), <b>menus</b>,
          <b>shopping lists</b> and recipe books — and a printout for any of them.</p>`},
        {id: "money", title: "Money", blurb: "Bills, income, spending and savings (Cashbox).",
         body: `<p><b>Cashbox</b>: what's due this week and next, what's left to spend this
          fortnight, repeating bills, savings goals and a calculator. Log a spend in a tap.</p>`},
        {id: "puzzles", title: "Puzzles", blurb: "Sudoku, Kakuro, Mines, Words and more.",
         body: `<p>Every puzzle has its own page in the right sidebar; <b>Stats</b> shows how
          you're going.</p>`},
        {id: "divination", title: "Divination", blurb: "Tarot, oracle, Lenormand, runes, I Ching, astrology.",
         body: `<p>Readings with your own decks — tarot, oracle, Lenormand, runes and I Ching --
          and astrology. A daily pull from the desktop saves into your journal.</p>`},
        {id: "mind", title: "Mindfulness", blurb: "Meditation, breathwork, journal and gratitude.",
         body: `<p>Four quiet places: a <b>journal</b> to write in, <b>gratitude</b> for the good
          things, <b>meditation</b> with your own recordings, and <b>breathwork</b> to follow along
          with. The desktop's Today card nudges you when the journal is still empty for the day, and
          a daily card pulled from the desktop is saved into the journal too.</p>`},
        {id: "stuff", title: "M&T", blurb: "Things: your inventories.",
         body: `<p><b>M&amp;T</b> keeps your <b>inventories</b>: the tools in the garage, the
          kitchen drawer, anything you want a list of, each with a quantity and a place.
          ${keys("SUPER + ALT + I")} opens it.</p>
          <p>Your <b>music</b>, <b>films</b>, <b>shows</b> and the list of everything you own (what was
          Media) are in <b>NeuroStream</b> now, an app of its own: ${keys("SUPER + ALT + M")} or
          ${keys("SUPER + ALT + W")}.</p>`},
        {id: "code", title: "Code", blurb: "Write code, learn to write it well, and study code you've written.",
         body: `<p><b>IDE</b> is Algorithm, built in: each <b>project</b> is a real folder of files
          (in your NeuroNet data folder, under code), with an editor that colours Python,
          JavaScript, Rust, HTML and CSS. Open a <b>guide</b> — a PDF or markdown — beside your code
          with the split button, and run your code in the <b>terminal</b> underneath (Ctrl+Enter runs
          the last command again). Ctrl+S saves, Ctrl+F finds, Ctrl+H replaces; anything unsaved is
          kept as a draft and offered back if NeuroNet closes. ${keys("SUPER + ALT + E")} opens it
          from anywhere.</p>
          <p><b>Guides</b> are snippets, tutorials and notes on good design, read like this guide —
          a list on the left, the guide on the right. Code in them is coloured and copyable, and a
          block marked to run has a <b>Run</b> button. <b>Data Structures</b> explains each classic
          structure — what it costs and the design lesson in it — beside working Python and
          JavaScript you can run (each checks itself), with <b>Side by side</b> to read two languages
          at once. Add your own with <b>New</b>, or <b>Edit</b> any: editing one of NeuroNet's saves your
          own copy, and more languages (TypeScript, Rust, Go, C, Java…) can be added to any structure.</p>
          <p><b>Research</b> is a code review of your own code: choose a folder, then select code to
          <b>highlight</b> it, write a <b>note</b> on it, or draw a labelled <b>box</b> round it (click line
          numbers to pick whole lines; shift-click for a range). Write an <b>overview</b> of how it hangs
          together, and <b>Export</b> the study as one markdown review. The folder is only ever read, and
          a mark finds its code again if the lines move.</p>`},
        {id: "settings", title: "Settings", blurb: "Appearance, text size, sections, export and import.",
         body: `<p>The gear at the bottom of the left menu: <b>Appearance</b> (themes, including
          "Follow Omarchy"), <b>Text &amp; scale</b>, <b>Sections shown</b> (hide the ones you don't
          use; a hidden section's shortcut is switched off too), the <b>photo library</b>, <b>App stats</b>, <b>Export &amp; import</b> and <b>Data folder</b>
          (where your things are kept; <b>Choose the drive…</b> moves them all to another drive,
          checked file by file, keeping the old folder until you delete it).</p>`},
      ],
    },
    {
      id: "help", name: "When something goes wrong", icon: "i-info", colour: "#e06c6c",
      intro: "What to try, and how to get help.",
      topics: [
        {id: "didnt", title: "\"NeuroNet didn't open\"",
         blurb: "When a shortcut brings up nothing.",
         body: `
          ${steps(`Wait a few seconds and try ${keys("SUPER + ALT + O")} again — NeuroNet may
                   still have been starting.`,
                  "Check Game Mode isn't on (the gamepad icon on the top bar).",
                  "Run <b>neuronet-doctor</b> in a terminal (see below).")}
          <p>The notification says what NeuroNet said when it tried to start; if it mentions
            <b>python-qtpy</b>, install it: ${`<code>omarchy pkg add python-qtpy</code>`}.</p>`},
        {id: "doctor", title: "neuronet-doctor",
         blurb: "One command that gathers everything needed to see what's wrong.",
         body: `
          <p>Open a terminal (${keys("SUPER + RETURN")}) and type <code>neuronet-doctor</code>.
            It writes <b>neuronet-doctor.txt</b> in your home folder and starts with
            <b>Problems found</b> — the known causes, said plainly.</p>
          ${tip(`If you need someone else to look, send them that file — it has no passwords in it,
            only names of folders, versions and messages.`)}`},
        {id: "reinstall", title: "Installing again, or taking it out",
         blurb: "Put NeuroNet's desktop back as it should be.",
         body: `
          <p>In a terminal:</p>
          <ul>
            <li><code>bash ~/NeuroNet/system/install.sh --check</code> — what's not as it should be,
              without changing anything.</li>
            <li><code>bash ~/NeuroNet/system/install.sh</code> — puts it right.</li>
            <li><code>bash ~/NeuroNet/system/install.sh --uninstall</code> — takes NeuroNet's desktop
              out, and puts back the theme and dock you had.</li>
          </ul>
          ${know(`None of these touch your data — your photos, notes and the rest stay exactly
            where they are.`)}`},
        {id: "backups", title: "Your data is kept safe",
         blurb: "Where NeuroNet keeps copies before changing things.",
         body: `
          <ul>
            <li>An <b>import</b> keeps every file it replaces, in <b>import-backups</b> in
              NeuroNet's data folder.</li>
            <li>The <b>installer</b> keeps what it replaces beside it (<code>.bak</code> files, and
              <code>plugins-before-neuronet-…</code> folders).</li>
            <li>Your <b>export</b> is your backup — make one now and then, and keep it somewhere
              other than this computer.</li>
          </ul>`},
      ],
    },
  ];

  /* ---- "Open in NeuroNet": where a page can take you (a section, or a
          view) -- checked by the test to be real ---- */
  const OPENS = {
    "start/moving": ["settings:transfer", "Export & import"],
    "start/welcome": ["settings:transfer", "Export & import"],
    "sections/home": ["home", "Home"], "sections/photos": ["photos", "Photos"],
    "sections/training": ["training", "Training"],
    "sections/notes": ["notes", "Scribe"], "sections/creative": ["creative", "Creative"], "sections/kitchen": ["cookery", "Kitchen"],
    "sections/money": ["money", "Money"], "sections/puzzles": ["games", "Puzzles"],
    "sections/divination": ["divination", "Divination"], "sections/mind": ["mind", "Mindfulness"],
    "sections/stuff": ["stuff", "M&T"], "sections/code": ["code:ide", "Code"],
    "sections/settings": ["settings:appearance", "Settings"],
  };

  /* Pictures of NeuroNet, taken from a made-up household (Cam: "screenshots
     from sample data", never hers) by system/guide-shots.sh -- run it again
     after a section changes. Keyed like OPENS; files in guide/shots/. */
  const SHOTS = {
    "start/welcome": "welcome", "start/moving": "transfer",
    "sections/home": "home", "sections/photos": "photos",
    "sections/training": "training", "sections/notes": "notes", "sections/creative": "creative", "sections/kitchen": "kitchen",
    "sections/money": "money", "sections/puzzles": "puzzles", "sections/divination": "divination",
    "sections/mind": "mind", "sections/stuff": "stuff", "sections/code": "code",
    "sections/settings": "settings",
  };
  /* A full address: the printable edition opens from a temporary file, where
     a relative one would find nothing. */
  const shotUrl = (name) => new URL("guide/shots/" + name + ".jpg",
    typeof location !== "undefined" ? location.href : "http://localhost/").href;
  function shotHtml(ch, topic) {
    const name = SHOTS[ch.id + "/" + topic.id];
    return name ? `<img class="shot" src="${esc(shotUrl(name))}" alt="${esc(topic.title)} in NeuroNet" loading="lazy">` : "";
  }

  /* ---- the printable edition: the whole guide, or one page ----
     A document of its own for paper -- light, NeuroNet's deep green (the
     one the app uses on light themes; #5FA665 is too pale on white), each
     chapter in its colour. Saved as a PDF by guide_save_pdf (headless
     Chromium) or printed a page at a time with Ctrl+P. */
  function wordmark(fill) {
    const sym = typeof document !== "undefined" && document.getElementById("i-neuronet");
    const path = sym && sym.querySelector("path");
    if (!path) return `<div style="font:800 34px sans-serif;color:${fill}">NeuroNet</div>`;
    return `<svg viewBox="${sym.getAttribute("viewBox")}" width="320" aria-label="NeuroNet">
      <path fill="${fill}" d="${path.getAttribute("d")}"/></svg>`;
  }
  const PRINT_CSS = `
    @page { size: A4; margin: 16mm 16mm 18mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font: 10.5pt/1.55 "Inter", "Helvetica Neue", Helvetica, Arial, sans-serif; color: #1F2A24; margin: 0; }
    h1, h2, h3 { color: #1F2A24; margin: 0; }
    .cover { height: 250mm; display: flex; flex-direction: column; justify-content: center; gap: 14px;
      padding: 0 12mm; background: #e9f0ea; border-radius: 10px; page-break-after: always; }
    .cover h1 { font-size: 40pt; } .cover p { font-size: 13pt; color: #4d6453; margin: 0; }
    .toc { page-break-after: always; } .toc h2 { font-size: 20pt; margin-bottom: 10px; }
    .toc li { margin: 6px 0; font-size: 11.5pt; } .toc .sw { display: inline-block; width: 10px; height: 10px;
      border-radius: 3px; margin-right: 8px; vertical-align: middle; }
    .toc ul { margin: 2px 0 8px 20px; padding: 0; } .toc ul li { font-size: 10pt; margin: 2px 0; color: #4d6453; }
    .chapter { page-break-before: always; } .chapter:first-of-type { page-break-before: auto; }
    .ch-head { padding: 12px 16px; border-radius: 10px; color: #fff; margin-bottom: 14px; }
    .ch-head h2 { color: #fff; font-size: 20pt; } .ch-head p { margin: 2px 0 0; opacity: 0.92; }
    .topic { break-inside: avoid-page; margin: 0 0 16px; padding-left: 12px; border-left: 3px solid var(--c); }
    .topic h3 { font-size: 13.5pt; } .blurb { margin: 1px 0 8px; font-weight: 600; color: var(--c); }
    kbd { display: inline-block; padding: 0 6px; border: 1px solid #b9c7bc; border-bottom-width: 2px; border-radius: 5px;
      font: 600 9pt/1.6 monospace; background: #f5f9f5; color: #1b2a1f; }
    .ng-plus { margin: 0 2px; color: #7a8c7e; }
    code { background: #eef3ef; padding: 0 4px; border-radius: 4px; font-size: 9.5pt; }
    table { border-collapse: collapse; width: 100%; margin: 4px 0 10px; }
    td { padding: 4px 8px; border-bottom: 1px solid #dbe5dd; vertical-align: middle; } td.ng-k { white-space: nowrap; width: 1%; }
    .ng-tip, .ng-know { margin: 8px 0; padding: 8px 12px; border-radius: 8px; border-left: 4px solid #2E6B38; background: #eef4ef; }
    .ng-know { border-left-color: var(--c); background: #f4f6f4; }
    .ng-tip > b:first-child, .ng-know > b:first-child { display: block; font-size: 8pt; letter-spacing: 0.1em; text-transform: uppercase; color: #2E6B38; }
    .ng-know > b:first-child { color: var(--c); }
    img.shot { max-width: 100%; border: 1px solid #dbe5dd; border-radius: 8px; margin: 6px 0 10px; }
    .foot { margin-top: 18px; padding-top: 8px; border-top: 1px solid #d6d9d3; font-size: 8.5pt; color: #5d665f; }`;

  function printDoc(chapters, withCover) {
    const toc = chapters.map((c) => `<li><span class="sw" style="background:${c.colour}"></span><b>${esc(c.name)}</b>
      <ul>${c.topics.map((t) => `<li>${esc(t.title)}</li>`).join("")}</ul></li>`).join("");
    return `<!doctype html><html><head><meta charset="utf-8"><title>Neuro Guide</title>
      <style>${PRINT_CSS}</style></head><body>
      ${withCover ? `<section class="cover">${wordmark("#2E6B38")}
        <h1>Neuro Guide</h1><p>How NeuroNet and its desktop work — everything in one place.</p>
        <p style="font-size:10pt">${esc(new Date().toLocaleDateString(undefined, {day: "numeric", month: "long", year: "numeric"}))}</p></section>
        <section class="toc"><h2>Contents</h2><ol>${toc}</ol></section>` : ""}
      ${chapters.map((c) => `<section class="chapter" style="--c:${c.colour}">
        <div class="ch-head" style="background:${c.colour}"><h2>${esc(c.name)}</h2><p>${esc(c.intro)}</p></div>
        ${c.topics.map((t) => `<div class="topic"><h3>${esc(t.title)}</h3><p class="blurb">${esc(t.blurb)}</p>
          ${shotHtml(c, t)}${t.body}</div>`).join("")}</section>`).join("")}
      <p class="foot">Neuro Guide — NeuroNet · printed ${esc(new Date().toLocaleDateString("en-GB", {day: "2-digit", month: "short", year: "numeric"}))}</p></body></html>`;
  }

  async function savePdf(chapters, name) {
    const api = window.pywebview && window.pywebview.api;
    if (!api || !api.guide_save_pdf) return;
    SS.shared.toast("Making the PDF…");
    const r = await api.guide_save_pdf(printDoc(chapters, chapters.length > 1), name);
    if (!r || r.cancelled) return;
    if (r.error) { SS.shared.toast(r.error, "error"); return; }
    SS.shared.toast("Saved: " + r.path, "good");
  }

  /* ---- the page ---- */
  const PLAIN = (html) => String(html).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const VIEW = (ch) => "guide:" + ch.id;
  const state = {};   // chapter id -> {open, query}

  function chapterOf(view) {
    const id = String(view || "").split(":")[1];
    return CHAPTERS.find((c) => c.id === id) || CHAPTERS[0];
  }

  function render(host, ch) {
    const st = state[ch.id] = state[ch.id] || {open: ch.topics[0].id, query: ""};
    host.innerHTML = `
      <div class="ng" style="--ng: ${ch.colour}">
        <header class="ng-head">
          <div class="ng-kicker">Neuro Guide</div>
          <h2 class="page-h">${esc(ch.name)}</h2>
          <p class="stamp">${esc(ch.intro)}</p>
          <button class="btn btn-quiet ng-pdf" id="ng-pdf">Save the whole guide as a PDF…</button>
        </header>
        <div class="ng-split">
          <aside class="ng-list">
            <input class="input" type="search" id="ng-q" placeholder="Search the guide"
                   value="${esc(st.query)}" autocomplete="off">
            <div id="ng-items"></div>
          </aside>
          <article class="ng-page" id="ng-page"></article>
        </div>
      </div>`;
    const items = host.querySelector("#ng-items");
    const page = host.querySelector("#ng-page");

    const show = (topic) => {
      st.open = topic.id;
      const open = OPENS[ch.id + "/" + topic.id];
      page.innerHTML = `<h3 class="ng-title">${esc(topic.title)}</h3>
        <p class="ng-blurb">${esc(topic.blurb)}</p>
        ${open ? `<button class="btn ng-open" id="ng-open">Open ${esc(open[1])} in NeuroNet →</button>` : ""}
        ${shotHtml(ch, topic)}
        <div class="ng-prose" id="ng-body">${topic.body}</div>`;
      if (open) page.querySelector("#ng-open").onclick = () => SS.openSection(open[0]);
      items.querySelectorAll(".ng-item").forEach((b) => b.classList.toggle("on", b.dataset.id === topic.id));
      if (SS.Print && typeof SS.Print.offer === "function") {
        SS.Print.offer(page.querySelector("#ng-body"), topic.title, () => SS.Store.call("open_print_document",
          [printDoc([Object.assign({}, ch, {topics: [topic]})], false), "neuro-guide"], "Printing the guide"));
      }
    };
    const draw = () => {
      const q = st.query.trim().toLowerCase();
      /* A search looks through every chapter: someone looking for "dock"
         shouldn't have to know which chapter it's in. */
      const hits = [];
      for (const c of (q ? CHAPTERS : [ch])) {
        for (const t of c.topics) {
          if (!q || t.title.toLowerCase().includes(q) || t.blurb.toLowerCase().includes(q)
              || PLAIN(t.body).toLowerCase().includes(q)) hits.push([c, t]);
        }
      }
      items.innerHTML = hits.length ? hits.map(([c, t]) => `
        <button class="ng-item${t.id === st.open && c === ch ? " on" : ""}" data-ch="${esc(c.id)}"
                data-id="${esc(t.id)}" style="--ng: ${c.colour}">
          <span class="ng-item-title">${esc(t.title)}</span>
          <span class="ng-item-sub">${esc(c === ch ? t.blurb : c.name)}</span>
        </button>`).join("") : `<p class="bd-empty">Nothing in the guide mentions that.</p>`;
      items.querySelectorAll(".ng-item").forEach((b) => b.onclick = () => {
        const c = CHAPTERS.find((x) => x.id === b.dataset.ch);
        if (c !== ch) {                  // a hit from another chapter: go there
          (state[c.id] = state[c.id] || {open: b.dataset.id, query: ""}).open = b.dataset.id;
          SS.go(VIEW(c));
          return;
        }
        show(ch.topics.find((t) => t.id === b.dataset.id));
      });
    };
    host.querySelector("#ng-pdf").onclick = () => savePdf(CHAPTERS, "Neuro Guide.pdf");
    host.querySelector("#ng-q").addEventListener("input", (e) => { st.query = e.target.value; draw(); });
    draw();
    show(ch.topics.find((t) => t.id === st.open) || ch.topics[0]);
  }

  SS.NeuroGuide = {
    VIEWS: CHAPTERS.map(VIEW),
    PREFIX: "guide:",
    /** For the host's SECTIONS: the chapters are the subsections. */
    chapters: CHAPTERS.map((c) => ({key: VIEW(c), name: c.name, icon: c.icon})),
    async mount(host, view) {
      host.style.display = "";
      render(host, chapterOf(view));
    },
    _test: {CHAPTERS, NEURONET_KEYS, OMARCHY_KEYS, OPENS, SHOTS, printDoc},
  };
})();
