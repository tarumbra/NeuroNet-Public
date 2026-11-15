#!/usr/bin/env python3
"""The NeuroNet Audit (19 October 2026): code, data, every section's look and speed (a walk through a SAMPLE NeuroNet:
tools/audit/nn_sandbox.sh + nn_audit.mjs), the Training deep dive with before/after mock-ups, and the section heads' ideas.
    python3 tools/audit/build_nn_report.py <data dir> <nn walk dir> <training dir> <out dir>"""
import json, os, sys, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import charts as ch
from report import Report, tag
from html import escape as e

DATA, WALK, TR, OUT = sys.argv[1:5]
J = lambda *p: json.load(open(os.path.join(*p)))
nn, code, growth, pets = J(WALK, "nn.json"), J(DATA, "nncode.json"), J(DATA, "growth.json"), J(DATA, "pets.json")
views = nn["views"]
data_rows = [l.split() for l in open(os.path.join(DATA, "nndata.txt")).read().strip().split("\n")]
total = [r for r in data_rows if r[0] == "TOTAL"][0]
folders = [(r[0], int(r[1]), int(r[2])) for r in data_rows if r[0] != "TOTAL"]
GB = lambda b: b / 1e9
r = Report("NeuroNet Audit", "Cam's desktop and its seventeen sections: how it's built, how it looks, how it runs, and what's next",
           "19 October 2026", footer="NeuroNet Audit · 19 October 2026 · build 1.0.120")
r.meta = ["<b>For:</b> Cam (CEO), and anyone deciding on the project's AI budget",
          "<b>From:</b> the eleven section heads, led for this report by the UX and Accessibility Designer and the Software Engineer; Claude (CO) writing it up",
          "<b>Build audited:</b> NeuroNet 1.0.120 (18 October 2026)",
          "<b>Companion reports:</b> the NeuroPets Audit, the Project overview, and (after a recorded session) Performance metrics"]
secs = collections.OrderedDict()
for v in views:
    secs.setdefault(v["section"], []).append(v)
low_all = sum(v.get("lowCount", 0) for v in views)
btn_styles = collections.Counter(); sizes = collections.Counter(); fonts = collections.Counter()
for v in views:
    for k, c in (v.get("btnTop") or []): btn_styles[k] += c
    for k, c in (v.get("sizes") or {}).items(): sizes[int(k)] += c
    for k, c in (v.get("fonts") or {}).items(): fonts[k] += c
lines_total = sum(code["byLang"].values())
music = next(f for f in folders if f[0] == "chords"); photos = next(f for f in folders if f[0] == "photos")

# =====================================================================================================================
r.h1("1. Summary", "Game Developer (chair), UX and Accessibility Designer, Software Engineer")
r.p("<b>NeuroNet is one person's whole digital life in one app</b>: photos, music and films, notes and documents, training plans, recipes, money, puzzles, "
    "divination and mindfulness, a code editor and creative tools, all on a desktop built around it (widgets, a dock, shortcuts) on Omarchy Linux. "
    f"It's {lines_total:,} lines of code with {code['tests']['py'] + code['tests']['js']} test files, released {len(growth)} times since 30 September, and it runs entirely on Cam's own computer.", "lead")
r.kpis([("17", "sections"), (str(len(views)), "pages walked and measured"), (f"{lines_total / 1000:.0f}k", "lines of code"), (f"{code['tests']['checks']:,}", "automated checks"),
        (f"{len(growth)}", "releases in 19 days"), ("246", "app functions the window can call"), (f"{GB(int(total[1])):.0f} GB", "of Cam's data, in 8,679 files"), (f"{max(v['openMs'] for v in views):.0f} ms", "slowest page to open (sample)")])
r.h2("The verdict")
r.ul(["<b>It works, and it's fast.</b> On a sample copy every one of the 119 pages opened in 9–34 ms, and the dashboard idles at almost nothing (6 ms of script in 20 seconds).",
      "<b>It looks like one app, mostly.</b> One dark theme, one font, one header pattern (a title and a one-line description) on nearly every page. The Neuro Guide, Money and Settings are the best-kept pages.",
      f"<b>But it has grown many ways of drawing the same thing.</b> The walk found <b>{len(btn_styles)} button styles</b> and <b>{len(sizes)} text sizes</b>. "
      f"The secondary text colour sits at about 3.7:1 contrast, under the 4.5:1 that readable small text needs, in {low_all} places across the sections.",
      "<b>Training is the hardest to read</b>, as Cam said: seventeen tabs that don't fit, the most important numbers (sets, reps, load) in the faintest text, and a reading pane that's mostly empty. "
      "Section 6 shows a redesign with the same data."])
r.h2("The three things to do next")
r.ol(["<b>One design system</b> (UX): four button kinds, six text sizes, and the muted colour raised to 6.6:1. Most of it is one shared stylesheet.",
      "<b>Training's redesign</b> (UX, Software Engineer): grouped navigation, sessions and circuits as clear tables, a summary panel. Its own project once Cam picks from section 6.",
      "<b>Measure the real desktop</b> (Software Engineer, Claude): the Performance metrics recording, already planned with Cam."])
r.callout("What more AI time would buy", "<p>This audit walked every page of a sample NeuroNet, measured it and photographed it automatically, then compared what it found. "
          "More AI time turns that into a nightly consistency check, so drift (a new button style, a dim text colour) is caught the day it appears, "
          "and pays for the design-system pass and the Training rebuild.</p>")

# =====================================================================================================================
r.h1("2. What NeuroNet is", "Game Developer")
r.p("Every screen in this report comes from a <b>sample</b> NeuroNet: a made-up household (Nana June, Sam, a few recipes, bills and sessions) generated by tools/make_sample_data.py "
    "in a throwaway folder. Cam's own data was never opened.")
for a, b in [("home_dashboard", "photos"), ("money_period", "training_sessions"), ("notes_vault", "guide_start")]:
    pa, pb = os.path.join(WALK, "shots", a + ".jpg"), os.path.join(WALK, "shots", b + ".jpg")
    if os.path.exists(pa) and os.path.exists(pb):
        r.imgs(pa, e(next((v["section"] + " — " + v["name"] for v in views if v["file"] == a + ".jpg"), a)), pb, e(next((v["section"] + " — " + v["name"] for v in views if v["file"] == b + ".jpg"), b)))
r.table(["Section", "What it holds", "Pages"], [[e(s), e(", ".join(v["name"] for v in vs[1:])[:150] or vs[0]["name"]), str(len(vs))] for s, vs in secs.items()], num=(2,))

# =====================================================================================================================
r.h1("3. How it's built", "Software Engineer")
r.figs(ch.donut(sorted(code["byLang"].items(), key=lambda x: -x[1]), "Lines of code by language"), f"{lines_total:,} lines. JavaScript draws the app; Python is the backend and the window; QML the desktop.",
       ch.donut([("Python tests", code["tests"]["py"]), ("JavaScript tests", code["tests"]["js"])], "Test files"), f"{code['tests']['checks']:,} checks in {code['tests']['py'] + code['tests']['js']} files.")
top = sorted(code["byArea"].items(), key=lambda x: -x[1])[:22]
r.fig(ch.bar([(k, v) for k, v in top], "Lines of code by area (largest 22)", row=18, label_w=230), "NeuroPets and the tests are the two largest areas; the desktop layer (system/) is third; Scribe and Training lead the sections.")
r.fig(ch.line({"code in the repository (MB)": [(i, g["repoBytesCode"] / 1e6) for i, g in enumerate(growth)]}, "The code base, release by release", ylabel="MB of code", height=230,
              xfmt=lambda v: growth[min(int(v), len(growth) - 1)]["date"][5:]), "From 5.5 MB at 1.0.0 (30 September) to 12.8 MB at 1.0.120: it more than doubled in 19 days.")
r.h2("Architecture")
r.ul(["<b>The window</b> is pywebview on Qt WebEngine (Chromium): neuronet.py starts it, and the page calls 246 Python functions through one bridge (api/*.py, grouped by area).",
      "<b>The page</b> is plain JavaScript, a module per section (ui/&lt;section&gt;/), sharing one stylesheet (shared.css) and one top bar; no framework, so nothing to upgrade.",
      "<b>The desktop</b> is Quickshell (QML): widgets, the dock, the frame, the home screen, each its own small service (system/).",
      "<b>Data</b> is files in one folder (JSON, the photos and music as they are), so a backup is a copy; the data folder can be moved to another drive from Settings.",
      "<b>Security</b>: a content security policy on the page (no outside scripts, no objects, no form posts); 'unsafe-eval' stays because pywebview's bridge needs it (11 October finding)."])
r.table(["#", "Finding", "Severity", "Recommendation"], [
    ["SE-1", "ui/app.js is 5,400 lines: the shell, the sidebar, settings and photos together.", tag("med"), "Split it like NeuroPets' screens (parts joined at build); photos and settings first"],
    ["SE-2", "Each section draws its own buttons and lists (56 button styles, section 5).", tag("med"), "Shared components in shared.css (.btn, .btn-primary, .chip, .tab, .list-row) and a lint that flags new one-off styles"],
    ["SE-3", "Some sub-pages couldn't be opened by their menu key from a script (Kitchen's Menus, Shopping lists; Photos' Folders, Albums, Tags all show All photos).", tag("low"), "One routing table, so every page has an address (also what favourites and the Guide link to)"],
    ["SE-4", "test_portable fails on a launcher file kept in the repo; test_test_isolation flags test_ship_collab.py (both older than this release).", tag("low"), "Remove the stray file; add the isolation header"],
    ["SE-5", "Many tests read source text rather than behaviour.", tag("low"), "Grow the sample-NeuroNet walk this audit built (tools/audit/nn_audit.mjs) into behaviour tests"]])

# =====================================================================================================================
r.h1("4. Speed and data", "Software Engineer, with Claude (CO)")
r.p("Measured in the sample NeuroNet's own window (Qt WebEngine, the engine the real app uses) through its DevTools: time from asking for a page to it being drawn, the work done, "
    "and the page's memory. CPU, GPU and memory of the real running desktop are the Performance metrics report, after a recorded session with Cam.")
sec_open = [(s, max(v["openMs"] for v in vs)) for s, vs in secs.items()]
r.fig(ch.bar(sorted(sec_open, key=lambda x: -x[1]), "Slowest page to open in each section (ms, sample data)", row=19, label_w=130, marks={100: "a tenth of a second"}, color=ch.PALETTE[1]),
      "Everything opens in under 35 ms; 100 ms is where a person starts to notice.")
r.fig(ch.bar(sorted([(s, max(v["dom"] for v in vs)) for s, vs in secs.items()], key=lambda x: -x[1]), "Largest page in each section (elements)", row=19, label_w=130, color=ch.PALETTE[5]),
      "Creative (the asset library) and Code (the IDE) are the heaviest pages; all are light by web standards.")
r.kpis([(f"{nn['idle20s']['scriptMs']} ms", "script work, 20 s idle"), (f"{nn['idle20s']['layoutMs']} ms", "layout work, 20 s idle"), (f"{nn['idle20s']['heapMB']} MB", "page memory after the walk"), ("0", "errors on the walk")])
r.h2("Cam's data (sizes only)")
big = sorted(folders, key=lambda x: -x[1])
r.fig(ch.bar([(f[0].replace("chords", "music library"), round(GB(f[1]), 2)) for f in big[:10]], "Data by folder (GB)", unit=" GB", row=20, label_w=150, color=ch.PALETTE[7]),
      f"{GB(int(total[1])):.1f} GB in {int(total[2]):,} files. The music library is {GB(music[1]):.1f} GB ({music[2]:,} files); photos {GB(photos[1]):.1f} GB ({photos[2]:,} files). Everything else together is under 3.5 GB.")
r.table(["#", "Finding", "Severity", "Recommendation"], [
    ["DAT-1", f"The music library is {100 * music[1] / int(total[1]):.0f}% of the data. A whole-folder backup is dominated by it.", tag("info"), "Already handled: Export leaves music and films out by default; keep it that way and say so on the Data folder page"],
    ["DAT-2", "Photos keep a thumbnail and a frame-sized copy beside each original (photos_thumbs, photos_frame: 59 MB).", tag("low"), "Fine; rebuildable, so leave them out of backups"],
    ["PERF-1", "No measurement yet of the real desktop over a day (widgets, music, the visualizer).", tag("med"), "The Performance metrics session (planned)"]])

# =====================================================================================================================
r.h1("5. Consistency across the sections", "UX and Accessibility Designer")
r.p(f"The walk ran a probe on every page: each visible piece of text (its font, size and colour against its background) and each button (its colour, corner, size and padding). "
    f"Across {len(views)} pages it found:")
r.kpis([(str(len(btn_styles)), "different button styles"), (str(len(sizes)), "different text sizes"), (str(len(fonts)), "font families"), (str(low_all), "text with too little contrast")])
r.fig(ch.columns([(str(k), v) for k, v in sorted(sizes.items())], "How often each text size is used (px, all pages)", height=240),
      "13 px carries most of the app. Sizes 17, 19, 26, 28 and 32 are used a handful of times each: they're one-offs.")
r.fig(ch.bar(sorted([(s, len({k for v in vs for k, _ in (v.get('btnTop') or [])})) for s, vs in secs.items()], key=lambda x: -x[1]), "Button styles found in each section", row=19, label_w=130, color=ch.PALETTE[3], marks={4: "the target"}),
      "A design system needs about four (primary, secondary, quiet, danger), plus chips and tabs.")
r.fig(ch.bar(sorted([(s, sum(v.get("lowCount", 0) for v in vs)) for s, vs in secs.items()], key=lambda x: -x[1]), "Text under the contrast minimum, by section", row=19, label_w=130, color=ch.PALETTE[5]),
      "Mostly one colour: the muted secondary text at 3.5–3.7:1. Training has the most because its lists lean on it. (About 40 low readings over pictures are left out: the probe can't see a picture's colour.)")
r.h2("What's consistent")
r.ul(["One dark theme, with a colour per section (the tab underline: Training yellow, Divination purple, Code blue) that helps you know where you are.",
      "The same page header everywhere: a title, a one-line description, then the page's own tabs.",
      "Empty states that say what to do (\"No books yet. Make one from a run of months\") with one green button.",
      "The Neuro Guide, Money and Settings: tidy grids, clear tables, the same cards."])
r.h2("What isn't")
r.table(["#", "Finding", "Severity", "Recommendation"], [
    ["UX-1", "The muted text colour is about 3.7:1 against the panels; small text needs 4.5:1. It carries counts, descriptions and every secondary line.", tag("high"), "Raise --muted to #93a094 (6.6:1 on the panels): one variable, every section at once"],
    ["UX-2", f"{len(btn_styles)} button styles.", tag("med"), "Four kinds of button, chips and tabs in shared.css; sections use those"],
    ["UX-3", f"{len(sizes)} text sizes, from 11 to 42 px.", tag("med"), "A scale of six (12, 14, 16, 20, 24, 32) and a 14 px floor for anything you read"],
    ["UX-4", "Tab bars that don't fit: Training's 17 tabs and Puzzles' 20 run off the edge.", tag("med"), "Group them (section 6) or move the long lists into a sidebar"],
    ["UX-5", "List-and-reading-pane pages leave two thirds of the screen saying \"Pick something on the left\" (13 of Training's pages, Code, Gratitude).", tag("med"), "Open the first item, or show a summary (recent, most used) instead of an empty pane"],
    ["UX-6", "Training's own Settings page runs the theme list together as one paragraph.", tag("low"), "A layout slip: give each theme its row (as Settings → Appearance does)"],
    ["UX-7", "Many puzzle pages are a title and three difficulty buttons over an empty screen until you pick.", tag("low"), "Start Medium straight away, with the choice above the board"],
    ["UX-8", "Photos, Folders, Albums and Tags are four sidebar entries for one page.", tag("low"), "One Photos entry; its own panel already lists folders, albums and tags (keep it lean)"]])
r.h2("Every page, at a glance")
rows = []
for s, vs in secs.items():
    rows.append([e(s), str(len(vs)), f"{max(v['openMs'] for v in vs):.0f}", f"{max(v['dom'] for v in vs):,}", str(len({k for v in vs for k, _ in (v.get('btnTop') or [])})),
                 str(len({int(k) for v in vs for k in (v.get('sizes') or {})})), str(sum(v.get('lowCount', 0) for v in vs))])
r.table(["Section", "Pages", "Open (ms)", "Elements", "Button styles", "Text sizes", "Low contrast"], rows, num=(1, 2, 3, 4, 5, 6))

# =====================================================================================================================
r.h1("6. Training: making sessions and circuits easy to read", "UX and Accessibility Designer, with the Software Engineer")
r.p("Cam: <i>\"Pretty much the whole UI for it. The side bar with the options and the window that displays the session.\"</i> We opened the sample session <b>Full body A</b> and the circuit "
    "<b>Ten-minute finisher</b> and read them the way a coach does between sets: what's next, how many, how heavy, how long a rest.")
if os.path.exists(os.path.join(TR, "training-session.png")):
    r.img(os.path.join(TR, "training-session.png"), "<b>Before:</b> the session today (sample data).")
r.h2("What makes it hard to read")
r.ol(["<b>The numbers are the faintest thing on the screen.</b> \"4 sets · 8 reps · 16 kg · 60s rest · Squat\" is one 12 px line in the muted colour (3.5:1) under the exercise name. It's the line a coach reads most.",
      "<b>Five facts in one line.</b> Sets, reps, load, rest and the movement pattern are joined with dots, so the eye has to parse each line; nothing lines up from one exercise to the next.",
      "<b>Blocks aren't explained.</b> \"Block A · alternate\" means a superset (A1 then A2, rest after both) but doesn't say so; the warm-up's badge is too small for its word (\"Warm-up\" spills out).",
      "<b>The header hides the summary.</b> \"6 EXERCISES\" in tiny capitals above the title; the 45-minute length is a note card below; no total sets, no equipment.",
      "<b>A third of the width is empty</b>, and there's no Start button, though the gym view and the timer exist.",
      "<b>The navigation doesn't fit.</b> Seventeen tabs in one row (\"Trainin…\" is cut off); the sidebar's lists repeat the same faint meta line."])
if os.path.exists(os.path.join(TR, "after-session.png")):
    r.img(os.path.join(TR, "after-session.png"), "<b>After (mock-up):</b> the same session. tools/audit/mockups/training-session-after.html.")
r.h2("What the redesign changes")
r.table(["Change", "Why"], [
    ["Sets × reps, load and rest in their own columns, in large type", "The numbers line up exercise to exercise; a glance between sets is enough"],
    ["The movement and a cue under the name, at readable contrast (6.6:1)", "Secondary, but still readable in a gym"],
    ["Blocks as labelled tables: \"Block A · superset, A1 then A2, rest after both\"; the warm-up gets a W", "The structure is said, not guessed"],
    ["The header carries the summary as chips (45 min, 6 exercises, 4 blocks, 17 sets, Strength) and the actions (Start, Print, Edit)", "What it is and what to do, first"],
    ["A side panel: at a glance (time, working sets, heaviest, patterns), what you'll need, notes", "Uses the empty third; answers \"what do I set up?\""],
    ["Navigation in four groups (Plan, Library, People, Tools) with Settings at the end", "Seventeen tabs become four short groups that fit"],
    ["The sidebar grouped by tag, each row with exercises, blocks and minutes", "Find a session by what it is"]])
if os.path.exists(os.path.join(TR, "training-circuit.png")) and os.path.exists(os.path.join(TR, "after-circuit.png")):
    r.img(os.path.join(TR, "training-circuit.png"), "<b>Before:</b> the circuit. \"EMOM · 10:00 time cap\" assumes you know what EMOM means.")
    r.img(os.path.join(TR, "after-circuit.png"), "<b>After (mock-up):</b> EMOM said in words, the ten minutes drawn as a strip (odd minutes swings, even pushups), totals in the side panel.")
r.callout("Next step", "<p>Cam picks what to keep from these mock-ups (all, some, or a different direction); then it's built as its own project, page by page, starting with Sessions and Circuits. "
          "The colour and type changes (UX-1, UX-3) help every section at once and can go first.</p>")

# =====================================================================================================================
r.h1("7. Section by section", "Every section head")
notes = {
 "Photo library": "A clean grid with ratings and a side panel of folders, albums and tags. Four sidebar entries open this one page (UX-8). Counts in the side panel are muted text (UX-1).",
 "Folders": "Opens the same page as Photo library.", "Albums": "Opens the same page as Photo library.", "Tags": "Opens the same page as Photo library.",
 "Puzzles": "Twenty games and Puzzle Books in one tab row that doesn't fit (UX-4). Each game opens on a title and difficulty buttons over an empty screen (UX-7). The games themselves (2048, Simon, Peg Solitaire, Word Guess) are tidy and well sized.",
 "Divination": "Runes, I Ching and Astrology are handsome grids; Tarot, Oracle and Lenormand open on an empty state until a deck exists. Zero contrast problems: the best-kept section after the Guide.",
 "Mindfulness": "Breathwork's pattern cards and timer circle read well. Gratitude's boxed two-pane layout differs from Journal's beside it; one pattern would do.",
 "Training": "The most capable section (17 pages: sessions, circuits, programs, athletes, calendars, calculators, the gym view) and the hardest to read (section 6). Most pages are empty states on the sample, each with one clear green button.",
 "Settings": "Appearance's theme cards, the App stats charts and Export & import are clear. Sections shown is a long list of switches; group headers help it.",
 "Home": "The dashboard's blocks (today, photos, music, upcoming, fleeting, quick recipe) and the calendar are clear. Contacts are a row of small cards: room for more detail.",
 "M&T": "The music library, playlists and the visualizer work well; the media shelf's covers look good. Inventories opens on an empty state.",
 "Kitchen": "Recipes as letter tiles with tags. Its sub-pages couldn't be opened by key from the walk (SE-3); the recipe page itself is consistent.",
 "Money": "Tidy tables, clear totals in monospace, the period and fortnight views agree. Money is the model for the rest: one table style, one card style.",
 "Scribe": "Notes, Collaboration, Cells, Fleeting, Notebooks, Ebooks and Bookmarks: consistent headers and empty states. The notes editor opens on a blank \"New tab\" (UX-5).",
 "Creative": "The asset library is the heaviest page (3,200 elements) and looks good; Paper creator's controls are dense but logical. Pixel art and Vector open on empty project lists.",
 "Code": "The IDE opens on an empty editor (UX-5); Guides, Research and Data Structures are clean reading pages in the Guide's style.",
 "Neuro Guide": "The best-designed section: a searchable list, clear reading cards, tips in boxes, keyboard shortcuts as keys. Its pattern is the one to copy."}
for s, vs in secs.items():
    r.h3(f"{s} · {len(vs)} page{'s' if len(vs) > 1 else ''} · opens in {max(v['openMs'] for v in vs):.0f} ms · {sum(v.get('lowCount', 0) for v in vs)} low-contrast")
    r.p(e(notes.get(s, "")))
    shots = [v for v in vs if os.path.exists(os.path.join(WALK, "shots", v["file"]))]
    if s in ("Folders", "Albums", "Tags"):
        continue
    if s == "Kitchen":                                                  # (its sub-pages didn't open from the walk: one picture, not a mislabelled second)
        shots = shots[:1]
    if len(shots) >= 2:
        a, b = shots[0], shots[min(len(shots) - 1, max(1, len(shots) // 2))]
        r.imgs(os.path.join(WALK, "shots", a["file"]), e(a["name"]), os.path.join(WALK, "shots", b["file"]), e(b["name"]))
    elif shots:
        r.img(os.path.join(WALK, "shots", shots[0]["file"]), e(shots[0]["name"]))

# =====================================================================================================================
r.h1("8. Ranked fix list", "Every section head; ranked by the chair")
r.p("Ranked by how much of the app it improves for the effort. Cam picks; nothing here starts without a yes.")
r.table(["Rank", "ID", "What", "Effort", "Owner"], [
    ["1", "UX-1", "Raise the muted colour to 6.6:1", "10 minutes + a look at every theme", "UX"],
    ["2", "UX-3", "A six-step type scale and a 14 px floor", "half a day", "UX, Software Engineer"],
    ["3", "Training", "Sessions and circuits redesign (section 6), once Cam picks", "2–3 days", "UX, Software Engineer"],
    ["4", "UX-4", "Grouped tabs for Training and Puzzles", "half a day", "UX"],
    ["5", "UX-2 / SE-2", "Shared buttons, chips and tabs; a lint for one-off styles", "1–2 days", "Software Engineer"],
    ["6", "UX-5", "No empty reading panes: open the first item or a summary", "1 day", "UX"],
    ["7", "PERF-1", "The Performance metrics recording", "a 20-minute session + a report", "Claude (CO)"],
    ["8", "SE-3", "One routing table: every page has an address", "1 day", "Software Engineer"],
    ["9", "SE-1", "Split ui/app.js into parts", "1 day", "Software Engineer"],
    ["10", "UX-6/7/8", "Training settings layout, puzzles start at Medium, one Photos entry", "2 hours", "UX"],
    ["11", "SE-4", "The two old failing tests", "15 minutes", "QA"]])

# =====================================================================================================================
r.h1("9. The future: ideas from the section heads", "Every section head")
ideas = [
 ("Game Developer (chair)", ["A weekly \"your week\" page: training done, money left, photos added, puzzles solved, in one place.", "Sections that talk: a recipe's shopping list into Money's groceries; a training session onto the calendar."]),
 ("Software Engineer", ["A component library (shared.css plus a few JS helpers) every section uses.", "The sample-NeuroNet walk as a nightly test: every page opens, no errors, no new styles.", "One routing table and deep links (neuronet-open training:sessions/full-body-a)."]),
 ("UX and Accessibility Designer", ["One design system and a living style page in Settings.", "Training rebuilt from the mock-ups, then Puzzles' navigation.", "A high-contrast theme and keyboard paths through every page."]),
 ("Mathematician", ["Training calculators that learn from logged sets (estimated 1RM over time).", "Money forecasts: when a savings goal lands at the current rate."]),
 ("Economist", ["Money: a monthly review page with categories over time.", "Kitchen ↔ Money: the cost of a recipe from its ingredients."]),
 ("Combat Designer", ["Training's gym view as a proper workout player: next exercise, rest timer, a log of what you did.", "Programs with progression rules (add 2.5 kg when all sets are done)."]),
 ("Art Director", ["Section icons and empty-state illustrations in one style.", "Photo frame and widgets that follow the theme's colours."]),
 ("Narrative Designer and Story Writer", ["The Neuro Guide extended to every section, in the same voice.", "A friendly first-week tour that unlocks sections as you use them."]),
 ("QA and Play-test Lead", ["Collaboration play tests for NeuroNet, not only NeuroPets.", "A release checklist page that runs the full suite and the page walk."]),
 ("Claude (CO, AI department)", ["More AI time goes furthest on: the nightly page walk and consistency check, the design-system pass, and the Training rebuild.", "The same audit monthly, so progress is measured, not guessed."])]
for who, its in ideas:
    r.h3(who); r.ul(its)

# =====================================================================================================================
r.h1("10. How this audit was measured", "Claude (CO)")
r.ul(["<b>The walk:</b> tools/audit/nn_sandbox.sh copies NeuroNet's code (never its data) into a throwaway folder, fills an empty data folder with tools/make_sample_data.py, starts that copy off-screen with its own home folder, and runs tools/audit/nn_audit.mjs over every page. The script refuses to run unless the app holds the sample household. The copy is stopped afterwards; only its own processes.",
      "<b>The probe</b> reads each visible text's font, size and colour and works out its contrast against the background behind it (WCAG: 4.5:1 for small text, 3:1 for large). Text over pictures can't be judged this way and is left out.",
      "<b>Speed:</b> the window's own DevTools performance metrics; time from opening a page to two frames drawn.",
      "<b>Code:</b> lines counted per file in git (built files left out); tests by their checks.",
      "<b>Cam's data:</b> folder sizes and file counts only (du, find). No file was opened.",
      "<b>Mock-ups:</b> HTML in tools/audit/mockups/, drawn with NeuroNet's own theme colours and the sample data, screenshotted by Chromium.",
      "<b>Not measured here:</b> the real desktop running for a day (CPU, GPU, memory). That's the Performance metrics report."])

os.makedirs(OUT, exist_ok=True)
html = r.write(os.path.join(OUT, "NeuroNet Audit.html"))
r.pdf(html, os.path.join(OUT, "NeuroNet Audit (19 October).pdf"))
