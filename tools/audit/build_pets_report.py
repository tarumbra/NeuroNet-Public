#!/usr/bin/env python3
"""The NeuroPets Audit (19 October 2026): reads the numbers collected by collect_pets.js, pagetimes.js, the balance
simulations (tools/balance), the git history and Collaboration, and writes the report as HTML + PDF.
    python3 tools/audit/build_pets_report.py <data dir> <out dir>"""
import json, os, re, sys, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import charts as ch, similarity as sim
from report import Report, tag
from html import escape as e

DATA, OUT = sys.argv[1], sys.argv[2]
J = lambda f: json.load(open(os.path.join(DATA, f)))
pets, growth, collab = J("pets.json"), J("growth.json"), J("collab.json")
pages_real, pages_dev = J("pages-real.json"), J("pages-dev.json")
idle_house, idle_bag = J("idle-pet:house.json"), J("idle-pet:bag.json")
bal = open(os.path.join(DATA, "bal.txt")).read()
SHOTS = os.path.join(os.path.dirname(DATA), "shots")
C, A, T, K = pets["content"], pets["art"], pets["timing"], pets["code"]

# ---- the balance output, parsed --------------------------------------------------------------------------------------
gather = {}
for m in re.finditer(r"^(\w+)\s+(\{\"11\".*\})$", bal, re.M):
    gather[m.group(1)] = json.loads(m.group(2))
making = {}
for m in re.finditer(r"^(\w+)\s+recipes\s+(\d+).*?gather-hours (\{.*?\})", bal, re.M):
    making[m.group(1)] = {"recipes": int(m.group(2)), "hours": json.loads(m.group(3))}
classes = [l.split(",") for l in open(os.path.join(DATA, "classes.csv")).read().strip().split("\n")[1:]]
bosses = {}
for m in re.finditer(r"^(\w+)\s+(\w+)\s+((?:lv\d+:\d+/12\s*)+)$", bal[bal.index("===== bosses"):bal.index("===== classes")], re.M):
    bosses[m.group(2)] = [(int(a), int(b)) for a, b in re.findall(r"lv(\d+):(\d+)/12", m.group(3))]
hunt_coins = [(m.group(1), float(m.group(2))) for m in re.finditer(r"hunt (\w+) coins/kill [\d.]+ ~coins/h (\d+)", bal)]
store = re.search(r"(\d+) things for sale; (\d+) off the rule", bal)

r = Report("NeuroPets Audit", "A full review of the game: what it is, how it's built, how it plays, and where it goes next",
           "19 October 2026", footer="NeuroPets Audit · 19 October 2026 · build 1.0.120",
           logo=os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "ui", "pet", "logo.png")))
r.meta = ["<b>For:</b> Cam (CEO), and anyone deciding on the project's AI budget",
          "<b>From:</b> the NeuroPets team -- eleven section heads, with Claude (CO, AI department) writing it up",
          "<b>Build audited:</b> NeuroNet 1.0.120 (released 18 October 2026)",
          "<b>Companion reports:</b> the NeuroNet Audit, the Project overview, and (after a live recording) Performance metrics"]

tests = sum(t["checks"] for t in K["tests"])
core_lines = sum(x["lines"] for x in K["core"]); screen_lines = sum(x["lines"] for x in K["screens"])
content_kb = sum(x["bytes"] for x in K["content"]) / 1024
releases = len(growth)
first, last = growth[0]["date"], growth[-1]["date"]
pt = [d for d in collab if d["type"] == "playtest"]
pt_pass, pt_fail, pt_skip = sum(d["pass"] for d in pt), sum(d["fail"] for d in pt), sum(d["skip"] for d in pt)
overall, by_cat = sim.similarity()
shared = sim.shared()

# =====================================================================================================================
r.h1("1. Summary", "Game Developer (chair), with every section head")
r.p(f"<b>NeuroPets is a complete single-player RPG with pets at its heart, built in three weeks.</b> You raise a pet from an egg, "
    f"pick one of six classes, train {C['skills']} skills, explore a painted island and the seas beyond it, and fight bosses alone or with battle pets. "
    "It keeps playing while the app is closed. Everything in it was designed, written, painted and tested by one person working with an AI team, "
    "which is why this audit matters: it shows what that way of working has produced so far, and where more AI time would go.", "lead")
r.kpis([(f"{C['items']:,}", "items, each with a painting"), (f"{C['recipes']}", "recipes across 25 workshops"),
        (f"{C['quests']}", "quests from 21 people"), (f"{C['petLooks']}", "pet looks, all painted in 3 poses"),
        (f"{releases}", f"releases, {first[5:]} to {last[5:]}"), (f"{tests:,}", "automated checks (NeuroPets)"),
        (f"{pt_pass}", f"play-test checks passed (of {pt_pass + pt_fail + pt_skip})"), (f"{T['loadMs']:.0f} ms", "to load all the game's rules")])
r.h2("The verdict")
r.ul(["<b>Ready for a wider play test.</b> Nothing found is a blocker. The Battle Re-work (14 parts, 28 play tests) is finished and released.",
      "<b>Balanced where it counts.</b> All six classes earn within ±15% of each other at almost every level (the Necromancer, the newest, is 18% ahead at level 50 when idle). "
      "Every gathering skill takes 71–76 hours to level 50. On 11 October Runecrafting was twice as fast; that's fixed.",
      "<b>Fast on a real save.</b> On a copy of Cam's own save every page draws in under 40 ms and the game's rules load in "
      f"{T['loadMs']:.0f} ms. The one heavy case is a sandbox bag holding every item in the game (section 6).",
      "<b>Painted, start to finish.</b> " + f"{A['itemsOwnPainting']} of {A['items']} items have their own painting; 4 still use pixel stand-ins. All {A['petLooks']} pet looks and all {A['monsters']} creatures are painted.",
      f"<b>Its own game.</b> Against nine well-known games NeuroPets is closest to RuneScape 3 ({overall['RuneScape 3']:.0f}%), IdleOn ({overall['IdleOn']:.0f}%) and Melvor Idle ({overall['Melvor Idle']:.0f}%). "
      "No game in the list has all of its pet systems (section 13)."])
r.h2("The three things to do next")
r.ol(["<b>Bring the balance tools up to date</b> (Mathematician, Software Engineer). The simulations can't sail yet, so nothing on the islands (Frostpeak, the Desert, the Nile) is measured. Their bosses and hunts are the late game.",
      "<b>Make the Bag page light</b> (Software Engineer, UX). With a very full bag it re-lays out the whole page every second. A two-line CSS change and a paged bag fix it.",
      "<b>Finish the story and the last paintings</b> (Narrative, Art). The Story Re-work (N2) is the largest open piece; the art left is 4 item icons and the Kit/Bank icons (N11)."])
r.callout("What more AI time would buy", "<p>Most of this audit's numbers come from tools the AI team wrote and keeps: balance simulations, a headless play harness, "
          "art cutters, and the tests behind every release. More AI time goes straight into the list above, and into an automated play-tester that plays "
          "every class nightly and flags what drifted. Section 15 has every head's ideas.</p>")

# =====================================================================================================================
r.h1("2. What NeuroPets is", "Game Developer")
r.p("A cosy, painted RPG in its own window (NeuroPets is part of NeuroNet, Cam's desktop, but runs on its own). The screens below are from a copy of Cam's real save, drawn by the audit's harness.")
if os.path.exists(os.path.join(SHOTS, "pet_house.png")):
    r.imgs(os.path.join(SHOTS, "pet_house.png"), "The House: every room is a door to a page.", os.path.join(SHOTS, "pet_world.png"), "The Map: the main island, its regions and secrets.")
    r.imgs(os.path.join(SHOTS, "pet_skills.png"), "The Character sheet: gear, class, combat.", os.path.join(SHOTS, "pet_bag.png"), "The Bag: everything you carry, as painted cards.")
r.h2("The game in numbers")
rows = [("Items", C["items"]), ("Recipes", C["recipes"]), ("Workshops", C["workshops"]), ("Skills", C["skills"]), ("Gathering spots", C["gatheringSpots"]),
        ("Creatures", C["monsters"]), ("Hunting grounds", C["huntingGrounds"]), ("Regions", C["regions"]), ("Pet species", C["species"]), ("Pet looks", C["petLooks"]),
        ("Eggs", C["eggs"]), ("People", C["people"]), ("Quests", C["quests"]), ("Story chapters", C["storyChapters"]), ("Classes", C["classes"]),
        ("Talents", C["talents"]), ("Spells", C["spells"]), ("Battle-pet moves", C["beastMoves"]), ("Battle-pet types", C["beastTypes"]), ("Ships", C["ships"])]
r.fig(ch.bar(rows, "What's in the game (18 October)", width=640, row=19, label_w=150), "Counted from the built rules (petcore.js) by collect_pets.js.")
r.fig(ch.donut(sorted(C["itemKinds"].items(), key=lambda x: -x[1]), "Items by kind"), "Most items are materials: what you gather and make, the backbone of the crafting game.")

# =====================================================================================================================
r.h1("3. How it grew", "Claude (CO), from the git history")
r.p(f"NeuroPets first shipped in NeuroNet 1.0.9 on 3 October. Since NeuroNet's first release on {first} there have been {releases} releases, "
    "each one a tagged, tested build Cam could install. The charts follow the game's built files release by release.")
pts = [(i, g["built"]["petcore.js"]) for i, g in enumerate(growth)]
r.fig(ch.line({"Rules (petcore.js)": [(i, g["built"]["petcore.js"]) for i, g in enumerate(growth)],
               "Screens (pet.js)": [(i, g["built"]["pet.js"]) for i, g in enumerate(growth)],
               "Styles (pet.css)": [(i, g["built"]["pet.css"]) for i, g in enumerate(growth)]},
              "Lines of code at each release", xlabel="release (1.0.0 → 1.0.120)", ylabel="lines", height=270,
              xfmt=lambda v: growth[min(int(v), len(growth) - 1)]["date"][5:]), "The rules grew from 2,939 lines (1.0.11) to 11,453; the screens from 1,671 to 6,753.")
r.figs(ch.line({"Painted art files": [(i, g["petArt"]) for i, g in enumerate(growth)]}, "Painted pictures shipped", height=230, xfmt=lambda v: growth[min(int(v), len(growth) - 1)]["date"][5:]),
       "From none on 7 October to 1,836: the 'one painted style' decision of 10 October.",
       ch.line({"NeuroPets test files": [(i, g["petTestFiles"]) for i, g in enumerate(growth)]}, "Test files for NeuroPets", height=230, xfmt=lambda v: growth[min(int(v), len(growth) - 1)]["date"][5:]),
       "One test file on 3 October; 71 now. Every feature ships with its test.")
docs_by_day = collections.Counter(d["created"] for d in collab)
r.fig(ch.columns([(k[5:], {t: sum(1 for d in collab if d["created"] == k and d["type"] == t) for t in ("playtest", "vote", "note", "questions", "concern", "idea")}) for k in sorted(docs_by_day)],
                 "Collaboration documents a day (play tests, votes, notes, questions)", height=240, series=["playtest", "vote", "note", "questions", "concern", "idea"]),
      f"{len(collab)} documents in four days since the Collaboration desk opened on 15 October: how Cam and the team now work.")

# =====================================================================================================================
r.h1("4. Since the last audit (11 October)", "Every section head")
r.table(["Finding then", "Now", "Status"], [
    ["OPT-1: screens re-ran your whole idle time", "Checkpoint saves (1.0.106). Catch-up now costs 13 ms per idle hour, once", "Fixed"],
    ["Fighting levelled 3–4× faster than gathering", f"Hunting {int(classes[0][6])}–{max(int(c[6]) for c in classes):,} xp/h; gathering 400–2,700 xp/h by level. Gap narrowed, still ~2× early on", "Better"],
    ["Runecrafting twice as fast (72 h to 50)", f"Every gathering skill 71–76 h to 50", "Fixed"],
    ["Slow early game (~4 h to level 10)", "Still 3–4 h to level 11 in gathering (section 7)", "Open"],
    ["Adding a skill touched ~15 places", "The skill registry (core/01-a): an entry, content and art", "Fixed"],
    ["Screens in one 4,880-line file", f"{len(K['screens'])} parts in screens/, joined at build", "Fixed"],
    ["Content lived in code", f"{len(K['content'])} JSON content files ({content_kb:,.0f} KB), patched only through a reviewed list", "Fixed"],
    ["132 tests read the source text", "Still many; a real-browser harness now exists (this audit used it)", "Partly"],
    ["Two tests didn't point the data path away", "Fixed; one more found today (test_ship_collab.py)", "Open (1)"],
    ["Four visual styles", "One painted style; 4 items still pixel", "Fixed"]])
wk = [("Items", 731, C["items"]), ("Recipes", 464, C["recipes"]), ("Quests", 168, C["quests"]), ("Creatures", 66, C["monsters"]), ("Pet looks", 84, C["petLooks"]), ("Rule parts", 55, len(K["core"]))]
r.fig(ch.columns([(n, {"there on 11 Oct": a, "added since": b - a}) for n, a, b in wk], "A week's growth", height=250, series=["there on 11 Oct", "added since"]),
      "Each bar is the total on 18 October; the top part is what the week added (" + ", ".join(f"{n.lower()} +{b - a}" for n, a, b in wk) + ").")

# =====================================================================================================================
r.h1("5. Software engineering", "Software Engineer")
r.h2("5.1 How it's built")
r.table(["Layer", "Files", "Size"], [
    ["Rules: one plain script that runs in the window, in Node (tests, tools) and anywhere else", f"ui/pet/core/*.js, {len(K['core'])} parts → petcore.js", f"{core_lines:,} lines · {K['functions']} functions · {K['exports']} exports · {K['actions']} action branches"],
    ["Content: the tables (items, recipes, quests, creatures…)", f"ui/pet/content/*.json, {len(K['content'])} files", f"{content_kb:,.0f} KB"],
    ["Screens", f"ui/pet/screens/*.js, {len(K['screens'])} parts → pet.js", f"{screen_lines:,} lines · {K['innerHTML']} innerHTML redraws"],
    ["Shell, pixel fallback art, styles", "game.js, petart.js, pet.css + game.css + theme.css", f"{K['files'][3]['lines']} + {K['files'][2]['lines']:,} + {K['files'][4]['lines'] + K['files'][5]['lines'] + K['files'][6]['lines']:,} lines"],
    ["Python: the window, saves, settings", "neuropets.py, pet.py", f"{sum(p['lines'] for p in K['py']):,} lines"],
    ["Tests", f"{len(K['tests'])} NeuroPets test files", f"about {tests:,} checks"]])
big = sorted(K["core"], key=lambda x: -x["lines"])[:14]
r.fig(ch.bar([(x["f"].replace(".js", "")[:34], x["lines"]) for x in big], "The largest rule parts (lines)", label_w=250, row=19), "The action dispatcher (21-c) and the views (21-b) are the two hubs; most parts are under 300 lines.")
tbig = sorted(K["tests"], key=lambda x: -x["checks"])[:14]
r.fig(ch.bar([(x["f"], x["checks"]) for x in tbig], "Checks per test file (largest)", label_w=230, row=19, color=ch.PALETTE[2]), "test_pet.py plays the whole game from a new save; the rest each own a feature or a play test.")
r.h2("5.2 Strengths")
r.ul(["<b>Deterministic rules.</b> Every trip and fight has its own seeded dice, so the same save always plays out the same: catch-up is fair and every bug can be replayed.",
      f"<b>Saves never break.</b> {C['migrations']} numbered migrations bring any old save forward (save version {C['saveVersion']}); each has a test.",
      "<b>One source for content.</b> Content is JSON; a part may only add to earlier tables, and any change to them must be listed with a reason (tools/content_patches.json), so balance changes are visible in review.",
      "<b>Built, then checked.</b> The build has a --check mode, and the tests fail if the built files are out of date."])
r.h2("5.3 Findings")
r.table(["#", "Finding", "Severity", "Recommendation"], [
    ["SE-1", "The balance simulations predate the islands and ships: Frostpeak, the Desert and the Nile return no numbers; the boss sim can't reach their bosses.", tag("high"), "Give the sims a sailing helper (a caravel and the crossing) and re-run; add them to the release checklist"],
    ["SE-2", "Enchanting's levelling simulation returns no hours past level 11 (\"NaN\"), and Farming reports \"stuck\": the sim doesn't know how those skills are trained now.", tag("med"), "Teach making.js the altar route and timed crops"],
    ["SE-3", f"act() has {K['actions']} action branches in one dispatcher.", tag("low"), "An ACTIONS table (name → function) makes \"what can the game do\" one list and speeds lookups"],
    ["SE-4", "Many tests still check the source text (\"the page contains X\").", tag("med"), "Move behaviour checks to the real-browser harness this audit built (tools/audit/pagetimes.js is its seed)"],
    ["SE-5", "test_ship_collab.py doesn't point the data path away first (the isolation guard flags it).", tag("med"), "Add the guard's three-line header"],
    ["SE-6", f"{K['innerHTML']} innerHTML redraws: a page redraw rebuilds all its elements, which loses focus and costs layout on big pages.", tag("low"), "Keep; but redraw only the changed part on the biggest pages (Bag, Character)"]])

# =====================================================================================================================
r.h1("6. Performance on test copies", "Software Engineer, with Claude (CO)")
r.p("Measured in a real headless Chromium (the engine NeuroPets' window uses) on two saves: a <b>copy</b> of Cam's own save, and the sandbox save, which holds almost every item in the game. "
    "Nothing real was touched: the page got a stand-in bridge that drops every write. The live recording on Cam's desktop (CPU, GPU and memory of the running apps) is its own report, <i>Performance metrics</i>, after tomorrow's session.")
r.kpis([(f"{T['loadMs']:.0f} ms", "load every rule (Node)"), (f"{pages_real['bootMs']} ms", "open the game (real save)"), (f"{T['advanceIdleMs'] * 1000:.0f} µs", "one tick, nothing running"),
        (f"{T['playerViewMs']:.1f} ms", "work out the Character sheet"), (f"{max(p['drawMs'] for p in pages_real['pages']):.0f} ms", "slowest page (real save)"),
        (f"{pages_real['idle15s']['heapMB']} MB", "script memory in use"), (f"{pets['saves']['freshBytes'] / 1024:.1f} KB", "a new save"), (f"{A['bytes'] / 1048576:.0f} MB", "all the game's pictures")])
pr = {p["page"]: p for p in pages_real["pages"]}; pdv = {p["page"]: p for p in pages_dev["pages"]}
common = [p for p in pr if p in pdv]
r.fig(ch.columns([(p.replace("pet:", ""), {"real save": pr[p]["drawMs"], "extra with the sandbox bag": max(0, pdv[p]["drawMs"] - pr[p]["drawMs"])}) for p in common],
                 "Time to draw each page (ms)", height=270, series=["real save", "extra with the sandbox bag"], rotate=True),
      "Click to drawn on screen (two animation frames). Each bar is the sandbox time; the lower part is the time on Cam's real save.")
r.fig(ch.bar([(p.replace("pet:", ""), pdv[p]["dom"]) for p in common], "Elements on each page, sandbox save", row=19, label_w=120, color=ch.PALETTE[5], marks={1500: "a light page"}),
      "The Bag draws one card per kind of item: 9,452 elements for the sandbox bag (906 kinds) against 306 on Cam's real save.")
r.h2("6.1 OPT-A: the Bag page with a very full bag")
r.fig(ch.columns([("House, idle 15 s", {"script": idle_house["idle15s"]["scriptMs"], "layout": idle_house["idle15s"]["layoutMs"]}),
                  ("Bag, idle 15 s", {"script": idle_bag["idle15s"]["scriptMs"], "layout": idle_bag["idle15s"]["layoutMs"]}),
                  ("Bag, real save", {"script": pages_real["idle15s"]["scriptMs"], "layout": pages_real["idle15s"]["layoutMs"]})],
                 "Work done while nothing happens, 15 seconds (ms)", height=250, series=["script", "layout"]), "Sandbox save unless marked. Layout is the browser working out where everything goes.")
r.p(f"Left alone on the Bag, the sandbox save spends <b>{idle_bag['idle15s']['layoutMs']:.0f} ms of every 15 seconds on layout</b> (about 3% of one core), against {idle_house['idle15s']['layoutMs']:.0f} ms on the House. "
    "Almost no script runs, so it isn't the game's rules. The page has a small live part that changes every second (the top bar), and each change makes the browser lay out the whole page again. With 9,000 elements that's 31 ms a second. "
    "On Cam's real save it's about 2 ms a second: harmless today, but it grows with the bag.")
r.callout("Recommendation", "<p><code>contain: layout</code> on the page area and on each bag card, so a change in the top bar never re-lays the cards (two lines of CSS). "
          "Then show the bag a page of cards at a time, like the Bank's tabs, and the cost stays flat however big the bag gets.</p>")
r.h2("6.2 Catching up after time away")
cu = T["catchUp"]
r.fig(ch.line({"a gathering trip": [(c["hours"], c["ms"]) for c in cu]}, "Work to catch up a gathering trip (ms)", xlabel="hours away", ylabel="ms", points=True, height=230),
      "Straight-line: about 13 ms per idle hour. Since checkpoint saves (1.0.106) this is paid once on opening, not on every redraw.")
r.h2("6.3 Memory and data")
r.fig(ch.donut([(f["folder"], round(f["bytes"] / 1048576, 1)) for f in sorted(A["byFolder"], key=lambda x: -x["bytes"])] + [("maps and scenes (top folder)", round((A["bytes"] - sum(f["bytes"] for f in A["byFolder"])) / 1048576, 1))], "Picture weight by folder (MB)", unit=" MB"),
       f"{A['files']:,} picture files, {A['bytes'] / 1048576:.0f} MB in all, WebP. The map and region paintings are the biggest share.")
r.fig(ch.bar([("New save", pets["saves"]["freshBytes"] / 1024), ("Cam's main save", 10.6), ("Sandbox save", 16.6), ("Save limit", 256)], "Save sizes (KB)", unit=" KB", row=24, label_w=120, color=ch.PALETTE[1]),
       "Saves stay tiny: a 256 KB limit, and Cam's main save is 10.6 KB.")
r.p(f"The page's script memory sat at {pages_real['idle15s']['heapMB']}–{pages_dev['idle15s']['heapMB']} MB on both saves. The rules are built once at load; nothing grew during the 15-second idle runs.")

# =====================================================================================================================
r.h1("7. Levels, XP and pace", "Mathematician")
xp = pets["xp"]
r.fig(ch.line({"XP needed for the level": [(l, xp[l]) for l in range(2, min(len(xp), 61))]}, "The XP curve (log scale)", xlabel="level", ylabel="total xp", logy=True, height=250),
      f"Total XP to reach each level. Level 10 needs {xp[10]:,}, level 50 {xp[50]:,}: each level costs about 10% more than the last (the curve was steepened ×1.5 on 9 October).")
sk = ["foraging", "fishing", "mining", "lumbering", "digging", "runecrafting"]
r.fig(ch.line({s.title(): [(0, 0)] + [(int(l) - 1, v[0]) for l, v in sorted(gather[s].items(), key=lambda x: int(x[0]))] for s in sk if s in gather},
              "Hours of gathering to reach a level (best spot and tool at each level)", xlabel="level", ylabel="hours", height=270, points=True),
      "From tools/balance/gather.js. The six gathering skills now run together: 71–76 hours to level 50.")
r.fig(ch.bar([(s.title(), gather[s]["50"][0]) for s in sk if s in gather] + [(m.title(), float(making[m]["hours"]["50"].rstrip("h"))) for m in making if making[m]["hours"].get("50", "").rstrip("h").replace(".", "").isdigit()],
             "Hours to level 50 (gathering: hours spent; making: hours of gathering behind the materials)", unit=" h", row=19, label_w=120,
             colors=[ch.PALETTE[1]] * 6 + [ch.PALETTE[3]] * 20), "Blue: gathering skills. Orange: making skills, counted as the gathering their materials take.")
r.table(["#", "Finding", "Severity", "Recommendation"], [
    ["MATH-1", "The early game is still slow: 3–4 hours of gathering to level 11, against about an hour of hunting.", tag("med"), "A first-hours boost (double xp to level 10, as the tutorial ends) keeps the curve and helps new players"],
    ["MATH-2", "Fighting still out-earns gathering in xp: 1,500–3,600 xp/h hunting against 400–2,700 xp/h gathering by level.", tag("low"), "By design (risk and food), but keep the ratio under 2× (today about 2.3× at level 10)"],
    ["MATH-3", "Enchanting and Farming can't be measured by the levelling sim (SE-2).", tag("med"), "Fix the sim, then check both against the 71–76 h band"],
    ["MATH-4", "The Astral egg drops 1 in 200 rematches at the first rank to 1 in 40 at the last; at Apprentice that is ~70 hours of rematches for one egg.", tag("info"), "Fine for a rare chase; watch it in play tests"]])

# =====================================================================================================================
r.h1("8. Economy", "Economist")
r.fig(ch.bar(sorted([(g, c) for g, c in hunt_coins if c > 0], key=lambda x: x[1]), "Coins an hour from hunting each ground (old Berserker sim)", unit="", row=19, label_w=120, color=ch.PALETTE[7]),
      "From tools/balance/coins.js. The richest grounds are the Desert and the Hollow Crypt (about 600 coins an hour).")
lv = sorted(set(int(c[2]) for c in classes))
r.fig(ch.line({cl: [(int(c[2]), float(c[5])) for c in classes if c[0] == "idle" and c[1] == cl] for cl in ["hunter", "berserker", "arcane", "thief", "paladin", "beastmaster"]},
              "Coins an hour by class and level (idle hunting, 3-hour hunts)", xlabel="level", ylabel="coins / hour", height=270, points=True),
      "From tools/balance/classes.js: the class simulation built in the Battle Re-work. Classes stay close together; the Hunter and Thief lead slightly.")
r.p(f"<b>Store prices.</b> {store.group(1)} things are for sale in NPC shops. The rule since 17 October is a <i>floor</i>: a shop never sells for less than 2.5× the materials, or under what you'd get selling it. "
    f"All {store.group(1)} meet the floor; {store.group(2)} sit well above it, mostly on purpose (bags, eggs and crates are priced as upgrades, not goods).")
r.table(["#", "Finding", "Severity", "Recommendation"], [
    ["ECO-1", "135 items can only be sold: nothing uses them (fairystone, relic, ancient bark…).", tag("low"), "Give each a use (a recipe, a quest, a collection) or a clear \"treasure\" label"],
    ["ECO-2", "Coins pile up late: 3,000–3,900 coins an hour at level 50 with few late sinks.", tag("med"), "Late sinks: house tiers, ship upgrades, cosmetic reskins, a donation board"],
    ["ECO-3", "Larceny and the fence pay little coin by design (it's for the skill); the swag sack can't flood the economy.", tag("info"), "Keep; check the fence after a week of play"]])

# =====================================================================================================================
r.h1("9. Combat and classes", "Combat Designer")
for lvl in (10, 30, 50):
    rows_ = [(c[1].title(), float(c[4])) for c in classes if c[0] == "idle" and int(c[2]) == lvl]
    if lvl == 10 or lvl == 50:
        avg = sum(v for _, v in rows_) / len(rows_)
        r.fig(ch.bar(rows_, f"Kills an hour at level {lvl} ({[c[3] for c in classes if int(c[2]) == lvl][0]}), idle", row=20, label_w=110, color=ch.PALETTE[0], marks={round(avg): "average"}),
              f"Every class within ±15% of the average is the design target. Level {lvl}: " + ", ".join(f"{n} {100 * (v / avg - 1):+.0f}%" for n, v in rows_) + ".")
r.fig(ch.line({b.title(): [(l, w / 12 * 100) for l, w in v] for b, v in bosses.items() if v}, "Boss wins out of 12, by player level (old Berserker sim, metal armour)", xlabel="player level", ylabel="% won", height=270, points=True, ymax=100),
      "From tools/balance/bosses.js. The early bosses fall in a clean 10-level band. Basilisk and Morvane aren't beaten by this old sim at all; it predates classes and talents (SE-1).")
r.p(f"<b>Scale.</b> {C['classes']} classes (plus Necromancy taught mid game), {C['talents']} talents, {C['spells']} spells, {C['mageRanks']} mage-tower ranks with rematches, and battle pets with "
    f"{C['beastMoves']} moves over {C['beastTypes']} types (Astral the newest, neutral against all).")
r.table(["#", "Finding", "Severity", "Recommendation"], [
    ["CMB-1", "The Necromancer is 18% ahead of the average at level 50 (idle). Its risen now stay for the whole hunt (PT24), which is likely why.", tag("med"), "Trim the risen's share of the damage by about 10%, then re-run classes.js"],
    ["CMB-2", "The Thief is 16% ahead at levels 10 and 20 (idle).", tag("low"), "Within reach of the band; watch it, or slow its early dagger speed a touch"],
    ["CMB-3", "The late bosses (Basilisk, Morvane, the island bosses) have no current measurements.", tag("high"), "Rebuild bosses.js on the class sim with talents and gear sets (with SE-1)"],
    ["CMB-4", "Battle pets have no measured balance yet (7 types, 84 moves, region tomes, Astral spells).", tag("med"), "A pet-battle sim: type match-ups and time-to-win per level"]])

# =====================================================================================================================
r.h1("10. Pets", "Game Developer and Combat Designer")
r.p(f"The heart of the game: {C['species']} species in {C['petLooks']} looks hatch from {C['eggs']} kinds of egg. Pets have needs, grow up, work beside you (a boost to a skill), go on expeditions, breed, "
    "and from the Battle Re-work fight as battle pets in the Beast Pen. The Astral egg (V10) adds eight planet pets with their own spells.")
petrows = [rw for rw in sim.flat() if rw[0] == "Pets"]
r.fig(ch.bar(sorted([("NeuroPets", sum(rw[2] for rw in petrows))] + [(g, sum(rw[3][i] for rw in petrows)) for i, g in enumerate(sim.GAMES)], key=lambda x: -x[1]),
             f"Pet systems each game has (of {len(petrows)}: collect, care, growth, eggs, breeding, battle, work, looks, expeditions)", row=20, label_w=140, color=ch.PALETTE[4]),
      "Scored from the feature matrix (½ for a lighter version). NeuroPets has all nine; Neopets, the pet game, about four and a half.")
r.table(["#", "Finding", "Severity", "Recommendation"], [
    ["PET-1", "Species skills, care feeding into work, and rare skilling pets (from 10 October) are still not built.", tag("low"), "Pick one for the next pet round (care feeding into work is the smallest)"],
    ["PET-2", "Battle pets and companion pets are two separate rosters (a pet can't come back from the Pen).", tag("info"), "By design (Warden Briar's rule); say so in the Pen's first talk"]])

# =====================================================================================================================
r.h1("11. Art", "Art Director")
r.fig(ch.donut([("own painting", A["itemsOwnPainting"]), ("borrows another's", A["itemsBorrowed"]), ("pixel stand-in", A["itemsPixelOnly"])], "Item art"),
       f"{A['itemsOwnPainting']} of {A['items']} items have their own painting.")
r.fig(ch.bar([("Pet looks", A["petsAllPoses"]), ("Creatures", A["monstersPainted"]), ("Icons in all", A["iconsTotal"]), ("Picture files", A["files"])], "Painted, counted", row=26, label_w=110, color=ch.PALETTE[3]),
       f"All {A['petLooks']} pet looks in three poses (portrait, walking, asleep); all {A['monsters']} creatures.")
r.p("<b>Still to paint:</b> " + ", ".join(e(x) for x in A["pixelOnly"]) + " (pixel stand-ins), the Kit and Bank icons (N11), and the Marketplace painting (a placeholder map today).")
r.table(["#", "Finding", "Severity", "Recommendation"], [
    ["ART-1", "Cam's sheets have a magenta background; painted glows came out pink until the cutter learnt to remove them (18 October).", tag("info"), "Keep !noglow for glowing pets; a neutral grey background would avoid it altogether"],
    ["ART-2", "Pictures weigh 45 MB; icons alone are 987 files.", tag("low"), "Fine for a desktop app; an icon atlas would cut file count if the game moves to the web"],
    ["ART-3", "Four items and the Kit/Bank still use pixel art.", tag("low"), "One icon sheet (N11) closes it"]])

# =====================================================================================================================
r.h1("12. Story, play tests and quality", "Narrative Designer, Story Writer, UX and Accessibility Designer, QA Lead")
r.h2("Story")
r.p(f"{C['people']} people give {C['quests']} quests; a main story of {C['storyChapters']} chapters gates the systems as you meet them. Three people now explain things in conversation (talks) "
    "instead of help text. The Story Re-work (N2) is planned: the conclusion of the Battle Re-work said its changes have already helped it.")
r.h2("Play tests")
r.fig(ch.columns([(d["ref"], {"pass": d["pass"], "fail": d["fail"], "skip": d["skip"]}) for d in sorted(pt, key=lambda x: int(x["ref"][2:]))],
                 "Every play test, its checks", height=270, series=["pass", "fail", "skip"], rotate=True),
      f"{len(pt)} play tests, {pt_pass} checks passed, {pt_fail} failed (each fixed and re-tested), {pt_skip} skipped. The fails cluster in PT11–PT17: the Beast Master and the Pen.")
r.fig(ch.donut(sorted(collections.Counter(d["type"] for d in collab).items(), key=lambda x: -x[1]), "Collaboration documents by kind"),
       "Play tests, votes, notes, questions, concerns and ideas: the team's working record.")
r.fig(ch.donut(sorted(collections.Counter(d["project"] or "General" for d in collab).items(), key=lambda x: -x[1]), "By project"), "The Battle Re-work dominates.")
r.h2("UX findings")
r.table(["#", "Finding", "Severity", "Recommendation"], [
    ["UX-1", "Bag cards cut off their buttons: \"Feed Pink Bunny\" shows as \"ed Pink Bunn\".", tag("med"), "Wrap or shorten the label (\"Feed\") and let the card grow"],
    ["UX-2", "The Beast Pen's sheet style (Marketplace-like) is now the best page in the game; the Bag, the Hatchery and the Character sheet still use older layouts.", tag("low"), "Bring them to the same sheet pattern, one at a time"],
    ["UX-3", "Saves page: worth a check that it copes when the save list can't be read (the audit's stand-in bridge made it throw).", tag("low"), "Show \"Couldn't read your saves\" rather than a blank page"],
    ["QA-1", "The release run found two stale tests (settings defaults, an unescaped name in the grid prototype) only at release time.", tag("low"), "Run the full suite after each round, not only at release"]])

# =====================================================================================================================
r.h1("13. How alike is it? NeuroPets beside nine games", "Game Developer, with every head scoring")
r.p(f"The team listed {len(sim.flat())} features in eight groups and scored each game 0 (absent), ½ (partly) or 1 (alike), from the sources at the back and play knowledge. "
    "<b>Similarity</b> is 100 × (1 − the average gap) over every feature, so it reads \"how close the two designs are\". "
    "<b>Shared</b> asks the other way: of NeuroPets' own features, how much each game also has.")
games = sim.GAMES
r.fig(ch.columns([(g, overall[g]) for g in games], "Similarity to NeuroPets (%)", unit="%", height=270, rotate=True),
      "Closest: RuneScape 3, IdleOn, Melvor Idle and Old School RuneScape. Furthest: FarmVille, which shares the farm and little else.")
r.fig(ch.bar(sorted([(g, shared[g]) for g in games], key=lambda x: -x[1]), "Of NeuroPets' features, the share each game also has (%)", unit="%", row=20, label_w=140, color=ch.PALETTE[2]), "")
cats = list(by_cat)
top4 = ["RuneScape 3", "Melvor Idle", "Neopets", "RPG MO", "IdleOn"]
r.fig(ch.radar(cats, {g: [by_cat[c][g] / 100 for c in cats] for g in top4}, "Similarity by part of the game", size=430),
      "RuneScape 3 is closest in skills and combat; Neopets only in pets and look; Melvor in idle play; RPG MO in its world and pets.")
rows_f = sim.flat()
for k in range(0, len(rows_f), 16):
    part = rows_f[k:k + 16]
    r.fig(ch.heat([n[:40] for _, n, _, _ in part], ["NeuroPets"] + games, [[np] + list(sc) for _, _, np, sc in part],
                  f"The feature matrix, part {k // 16 + 1} of {(len(rows_f) + 15) // 16} (dark = has it, light = partly)", cell=24, label_w=250), "")
r.h2("What makes NeuroPets different")
r.ul([f"<b>{e(n)}</b> ({e(c.lower())}): no game in the list has it in full." for c, n in sim.unique()] +
     ["<b>A RuneScape-depth skill game with Neopets-style pets that need you</b>: the pets' care, growth and colours come from Neopets; the skills, tools and bosses from RuneScape; the idle play from Melvor. No one game does all three.",
      "<b>What it doesn't have</b>, on purpose: other players, trading, PvP and a real-money shop. That's the biggest gap to every MMO in the list, and the reason it scores under 65% against any of them."])

# =====================================================================================================================
r.h1("14. Ranked fix list", "Every section head; ranked by the chair")
r.p("Ranked by what it buys the player for the effort. Cam picks; nothing here is started without a yes.")
r.table(["Rank", "ID", "What", "Effort", "Owner"], [
    ["1", "SE-1 / CMB-3", "Balance sims that can sail: measure the islands, their hunts and bosses", "1–2 days", "Software Engineer, Mathematician"],
    ["2", "OPT-A", "contain: layout + a paged Bag", "2 hours", "Software Engineer"],
    ["3", "UX-1", "Bag card buttons that fit", "1 hour", "UX"],
    ["4", "CMB-1", "Trim the Necromancer's risen ~10%", "1 hour + a sim run", "Combat Designer"],
    ["5", "MATH-1", "A first-hours xp boost to level 10", "half a day", "Mathematician"],
    ["6", "SE-2 / MATH-3", "Enchanting and Farming in the levelling sim", "half a day", "Software Engineer"],
    ["7", "CMB-4", "A battle-pet sim (types, moves, time to win)", "1 day", "Combat Designer"],
    ["8", "ECO-2", "Late coin sinks", "1–2 days", "Economist"],
    ["9", "SE-5", "Test isolation header for test_ship_collab.py", "10 minutes", "QA"],
    ["10", "ART-3", "The last icons (N11)", "one sheet", "Art Director (Cam paints)"],
    ["11", "SE-4", "Behaviour tests in the real-browser harness", "ongoing", "QA, Software Engineer"],
    ["12", "ECO-1", "Uses for the 135 sell-only items", "ongoing", "Economist, Narrative"]])

# =====================================================================================================================
r.h1("15. The future: ideas from the section heads", "Every section head")
ideas = [
 ("Game Developer (chair)", ["The grid world (prototype, PT22–23) as a second way to play the same save: walk the island, the idle game underneath.",
   "Seasons and events: a winter fair on Frostpeak, a harvest festival at the Farm, each with its own egg.", "A collection log: every item, pet and creature you've found, with rewards for sets."]),
 ("Software Engineer", ["A real-browser test suite (test/browser/) from this audit's harness, run with every release.", "An ACTIONS table and a formal content schema, so content can be checked as it's written.",
   "Make the rules a shared package so NeuroFarm and the grid world use one engine."]),
 ("Mathematician", ["A nightly balance run with a chart of what moved since the last release.", "XP and drop-rate dashboards inside the sandbox.", "An 'expected time' line on every goal (\"about 3 h to Mining 30 at this spot\")."]),
 ("Economist", ["Late-game sinks: house and estate tiers, ship refits, a cosmetic wardrobe.", "A price index page in the sandbox, so economy changes show at once.", "Traders on each island whose stock follows what you've been selling."]),
 ("Combat Designer", ["Boss phases and tells for the late bosses.", "A pet-battle ladder at the Beast Pen with weekly opponents.", "Class mastery: a second talent tree after level 50."]),
 ("Art Director", ["Animated idle sprites for pets in the house (two-frame breathing).", "Seasonal reskins for the map and the house.", "Paint the Marketplace and the last icons; then a style guide so any new artist matches."]),
 ("Narrative Designer", ["The Story Re-work (N2): chapters that introduce each system through a person.", "A quest journal grouped by person and place.", "Talks for every teacher, replacing the remaining help text."]),
 ("Story Writer", ["Short lore books in the library that pay off across islands.", "Letters from people you've helped, arriving by post.", "A recurring rival who duels you at each mage rank."]),
 ("UX and Accessibility Designer", ["One sheet pattern everywhere (the Pen's).", "Keyboard play: every action reachable without a mouse.", "A text-size setting and a high-contrast theme."]),
 ("QA and Play-test Lead", ["An automated play-tester that plays each class for a day of game time every night and files what broke.", "Play-test templates that link each check to the test that guards it.", "A public beta group once the story is in."]),
 ("Claude (CO, AI department)", ["More AI time goes furthest on three things: the automated play-tester, the balance tools, and the art pipeline (cutting, cleaning and checking Cam's paintings).",
   "Weekly audits like this one, generated from the same tools, so progress is measured, not guessed.", "A second AI seat for review: every change read by another model before it reaches Cam."])]
for who, its in ideas:
    r.h3(who); r.ul(its)

# =====================================================================================================================
r.h1("16. How this audit was measured", "Claude (CO)")
r.ul(["<b>Content and code:</b> tools/audit/collect_pets.js loads the built rules in Node and counts every table, item and test check; the git history gives the growth (every tag's built files).",
      "<b>Balance:</b> the existing simulations in tools/balance/ (gather, making, coins, gear, materials, tools, bosspace, hunt, sustain, bosses, classes, store prices), run on a scratch copy. They drive the real rules and never touch a save.",
      "<b>Performance:</b> tools/audit/pagetimes.js opens NeuroPets in a real headless Chromium with a stand-in bridge (writes dropped), visits each page and reads the DevTools performance metrics. Two saves: a copy of Cam's main save and the sandbox save.",
      "<b>Play tests:</b> counted from Collaboration (every check's pass, fail or skip).",
      "<b>Similarity:</b> tools/audit/similarity.py holds the feature matrix and the scores; change a score and re-run to see the effect.",
      "<b>Not measured here:</b> the running app on Cam's desktop (CPU, GPU, memory over time). That's the Performance metrics report, after a recorded session.",
      "<b>Privacy:</b> only counts and sizes from Cam's data; no names, notes, money or pictures."])
r.h2("Sources (the game comparison)")
r.raw('<ol class="cite">' + "".join(f"<li>{e(t)}<br>{e(u)}</li>" for t, u in sim.SOURCES) + "</ol>")

os.makedirs(OUT, exist_ok=True)
html = r.write(os.path.join(OUT, "NeuroPets Audit.html"))
r.pdf(html, os.path.join(OUT, "NeuroPets Audit (19 October).pdf"))
