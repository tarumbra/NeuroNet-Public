#!/usr/bin/env python3
"""The NeuroNet Performance Audit (3 November 2026): why the page grew to 1.8 GB in a day, every leak found and fixed, every
section's cost, the Python side and the desktop widgets, the section heads' reviews, the meeting and what's next.
    python3 tools/audit/build_perf_report.py <metrics.json> <out dir>"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import charts as ch
from report import Report, tag
from html import escape as e

M = json.load(open(sys.argv[1])); OUT = sys.argv[2]
B, A = M["before"], M["after"]
live = M["live"]; t0 = live[0][0]
hours = (live[-1][0] - t0) / 3600; rate = (live[-1][2] - live[0][2]) / hours
f0 = lambda x: f"{x:,.0f}"
gb4 = B["gc"][-1]; ga4 = A["gc"][-1]; gb1 = B["gc"][1]; ga1 = A["gc"][1]

r = Report("NeuroNet Performance Audit", "Why NeuroNet grew to 1.8 GB in a day, every leak found and fixed, and what's next", "3 November 2026",
           footer="NeuroNet Performance Audit · 3 November 2026")
r.meta = ["Measured on a sample NeuroNet (the made-up household, tools/make_sample_data.py) -- never Cam's own data -- and, read-only, on Cam's running NeuroNet",
          "The team: the Software Engineer (chair) and the UX & Accessibility Designer, with every section head"]

# ---------------------------------------------------------------------------------------------------------------------
r.h1("1. Summary")
r.p("Cam saw NeuroNet's page grow to 1.8 GB over a working day and asked for the same work-over NeuroArcana had: memory leaks, the data "
    "structures and algorithms, every section, the whole of NeuroNet. We walked all 120 views of a sample NeuroNet hundreds of times, "
    "watched Cam's own running NeuroNet (only reading its memory), found five leaks, fixed them, and measured again.", "lead")
r.kpis([(f"{f0(rate)} MB/h", "how fast Cam's NeuroNet grew, sitting still (measured live)"),
        ("0 MB/h", "the same, after the fix, while NeuroNet is tucked away"),
        ("5", "leaks found and fixed (three pages, the clock, a Python timer)"),
        ("3 → 0", "test files that could reach Cam's real data")])
r.callout("The cause, in one line",
          "<p>The top bar's clock. Once a second it formatted the date with <code>toLocaleString</code>, which builds a new formatter every call, "
          "and in NeuroNet's browser engine each one left about 47 KB behind -- hidden or not, all day: about 160 MB an hour, 1.8 GB by evening. "
          "Now the formatters are made once, and the second hand only ticks while NeuroNet is the window in front.</p>")
r.h2("What we fixed")
r.ul(["<b>The clock</b> (music/chords.js, games/cranium.js): formatters made once; seconds only while NeuroNet is in front, otherwise the minutes, once a minute.",
      "<b>The picture loader</b> (app.js SS.Art.lazy): its watchers now stop when their list leaves the page -- a whole Music library (~760 elements) "
      "and a Photos grid used to stay in memory after every visit.",
      "<b>Training's tag filter</b> (training/app.js): one window listener instead of a new one per visit.",
      "<b>Drag-select</b> (app.js sweepSelect): an old list's document listeners go as soon as a newer list is wired.",
      "<b>Music's playlists panel</b>: one data subscription, not one per visit (each change redrew it once for every visit since NeuroNet opened).",
      "<b>The visualizer page</b>: the quiet motion of silence at 4 frames a second, then still after a minute.",
      "<b>The desktop music card</b> (neuronet.board/MusicCard.qml): no frames when nothing plays (it drew 12 a second of silence, all day).",
      "<b>Desktop widget requests</b> (mpris.py, neuronet.py): the 45-second timeout thread goes when the answer comes; pywebview's leftover per-call entries are dropped.",
      "<b>Test safety</b>: three test files (arcana_lan, arcana_store, ship_collab) now point NeuroNet away from Cam's real data first, like the other 250."])
r.callout("What needs Cam", "<p>The fixes are in NeuroNet's code but not running yet: NeuroNet needs a restart (close it, then a NeuroNet key), and the "
          "desktop music card needs its widgets reinstalled and restarted (Super+Alt+W). Then the play test, PT73, checks the memory over a day.</p>", "warn")

# ---------------------------------------------------------------------------------------------------------------------
r.h1("2. How we measured")
r.p("The October audit's sandbox (tools/audit/nn_sandbox.sh) copies NeuroNet's code -- never neuronet_data -- into a throwaway folder with its own home, "
    "fills it with the sample household, and starts it off-screen on a private D-Bus, so the real NeuroNet is never touched. New walkers drive it over the "
    "DevTools protocol and refuse to run unless they see the sample household:")
r.table(["Tool", "What it does"],
        [["nn_perf.mjs", "every one of the 120 views: open time, DOM, listeners, heap, endless animations, three seconds' idle cost; four rounds of every view with garbage collection between; a minute idle"],
         ["nn_leak.mjs / nn_grow.mjs", "each view opened and left 4 times, then 8 more: a cache stops growing, a leak keeps going"],
         ["nn_listen.mjs", "every event listener on the window, the document and every element, before and after -- the new ones printed with their file and line"],
         ["nn_retain.mjs", "a heap snapshot; for each detached element, what still holds it"],
         ["nn_idleview.mjs", "a view left alone for minutes: the renderer's memory, heap, DOM and work every 30 s (with switches to silence the clock, or its formatting)"],
         ["nn_bridge.mjs / nn_dbus.mjs", "thousands of page-to-Python calls, and the desktop widgets' D-Bus requests on the sandbox's own private bus"],
         ["live sampler", "Cam's running NeuroNet's processes, their memory once a minute, read from /proc only"]])

# ---------------------------------------------------------------------------------------------------------------------
r.h1("3. The big one: the clock")
r.fig(ch.line({"Page (renderer)": [((s[0] - t0) / 60, s[2]) for s in live], "Python + browser side": [((s[0] - t0) / 60, s[1]) for s in live],
               "Desktop widgets (qs)": [((s[0] - t0) / 60, s[4]) for s in live]},
              title="Cam's running NeuroNet, untouched, memory each minute (MB)", xlabel="minutes", ylabel="MB"),
      f"Read-only, from Cam's own machine on 3 November. The page grew {f0(live[0][2])} → {f0(live[-1][2])} MB in {hours * 60:.0f} minutes ({f0(rate)} MB an hour) "
      "while NeuroNet sat tucked away on Scribe's vault. Python and the desktop widgets stayed flat.")
idle = M["idle"]
SHORT = {"old clock (before)": "old clock", "clock silenced": "silenced", "date formatting only": "formatting only", "formatters made once": "made once",
         "fixed, in front": "fixed · in front", "fixed, behind (as when tucked away)": "fixed · behind"}
r.fig(ch.line({SHORT.get(k, k): [(p[0], p[1]) for p in v] for k, v in idle.items()}, title="A sample NeuroNet left alone on the notes vault: the page's memory (MB)",
              xlabel="seconds", ylabel="MB"),
      "Each test five minutes at most. The old clock grows; silenced, nothing grows; its date formatting alone grows just as fast; made-once formatters don't. "
      "Fixed, the clock still leaves a little per repaint while it ticks seconds in front -- so behind, it shows the minutes and repaints once a minute: flat.")
r.table(["Test", "Page memory over the test", "Layouts a second"],
        [["The old clock", f"{idle['old clock (before)'][1][1]} → {idle['old clock (before)'][-1][1]} MB in 4½ min", "1"],
         ["Clock silenced", "flat", "0"], ["Date formatting only, nothing drawn", f"{idle['date formatting only'][1][1]} → {idle['date formatting only'][-1][1]} MB in 2½ min", "0"],
         ["Formatters made once", "flat", "0"], ["Fixed, NeuroNet in front (seconds)", f"{idle['fixed, in front'][1][1]} → {idle['fixed, in front'][-1][1]} MB in 4½ min", "1"],
         ["Fixed, NeuroNet behind (minutes)", "flat", "1 a minute"]])

# ---------------------------------------------------------------------------------------------------------------------
r.h1("4. Leaks while moving around")
rounds = lambda side, k: [(i, g[k]) for i, g in enumerate(side["gc"][1:])]
r.figs(ch.line({"Before": rounds(B, "nodes"), "After": rounds(A, "nodes")}, title="DOM elements after each round of all 120 views", xlabel="round", points=True, width=420),
       f"Before: +{f0((gb4['nodes'] - gb1['nodes']) / 3)} elements a round, never coming back. After: flat at {f0(ga4['nodes'])}.",
       ch.line({"Before": rounds(B, "listeners"), "After": rounds(A, "listeners")}, title="Event listeners after each round", xlabel="round", points=True, width=420),
       f"Before: +{(gb4['listeners'] - gb1['listeners']) / 3:.0f} a round. After: flat at {ga4['listeners']}.")
gbv = M["grow_before"]
r.table(["View", "4 visits (before)", "8 more (before)", "After the fix", "What held it"],
        [["Music · Library", f"+{gbv['music:library'][0]} el, +{gbv['music:library'][1]} listeners", f"+{gbv['music:library'][2]}, +{gbv['music:library'][3]}", "0", "the picture loader's observers (SS.Art.lazy), never disconnected"],
         ["Photos", f"+{gbv['photos'][0]}, +{gbv['photos'][1]}", f"+{gbv['photos'][2]}, +{gbv['photos'][3]}", "0", "the same observers, and the drag-select's document listeners"],
         ["Training · Sessions", f"+{gbv['training:sessions'][0]}, +{gbv['training:sessions'][1]}", f"+{gbv['training:sessions'][2]}, +{gbv['training:sessions'][3]}", "0", "a once-only window resize listener per visit"],
         ["The other 117 views", "0 (or a one-off cache)", "0", "0", "--"]])
r.p("The heap snapshot (nn_retain.mjs) showed the culprit by name: the old track list's <code>div.ch-slice</code> kept by an object's <code>root</code> -- the "
    "picture loader, whose two IntersectionObservers were rooted on the long-lived page and never let go. Several 'growing' views turned out to be "
    "caches that stop (Divination's shell keeps its last page; Puzzles keeps its last game) -- bounded, not leaks.")
r.callout("Not leaks after all", "<p>The JavaScript heap itself never grew (4-10 MB throughout), the bridge between the page and Python is clean "
          "(2,000 round trips, flat), and no section runs an endless animation.</p>")

# ---------------------------------------------------------------------------------------------------------------------
r.h1("5. Every section")
V = {v["key"]: v for v in A["views"]}
heavy = sorted(A["views"], key=lambda v: -v["nodes"])[:14]
r.fig(ch.bar([(v["key"], v["nodes"]) for v in heavy], title="Elements in memory just after opening each view (the sample household)", width=640, label_w=190),
      "The page plus anything not yet tidied away, so a rough size, not an exact one. Training heads the list because its whole app stays built while "
      "you're anywhere in it (36-46 thousand elements); outside Training the heaviest are I Ching, the Oracle and Stuff. A big page is slower to open and "
      "scroll and holds more memory while it's open; all of them are taken down when you leave the section.")
slow = sorted(A["views"], key=lambda v: -v["openMs"])[:12]
r.fig(ch.bar([(v["key"], v["openMs"]) for v in slow], title="The slowest to open (ms, until the page is drawn)", width=640, label_w=190),
      f"Every one of the 120 views opens in under {max(v['openMs'] for v in A['views']):.0f} ms -- quick everywhere.")
viz_b = next((v for v in B["views"] if v["key"] == "music:visualizer"), None)
r.p(f"Sitting still, every view costs the same small amount (the clock), except the Music visualizer, which drew {viz_b['idle']['paints'] if viz_b else '--'} frames "
    f"in three seconds of silence ({viz_b['idle']['taskMs'] if viz_b else '--'} ms of work) -- now 4 frames a second, then still.")

# ---------------------------------------------------------------------------------------------------------------------
r.h1("6. The Python side and the desktop widgets")
d = M["dbus"]
r.fig(ch.columns([(l, {"Before": d["before"][i], "After": d["after"][i]}) for i, l in enumerate(d["labels"])], title="NeuroNet's Python process during 1,500 desktop-widget requests (MB)",
                 series=["Before", "After"], grouped=True),
      "Each request (org.neuronet.App.Do, as the desktop board's cards send them) left a 45-second timeout thread running and an entry in pywebview's "
      "table. After: flat. At the widgets' normal pace this was small; in a burst it added up.")
r.table(["Background work", "How often", "Verdict"],
        [["Python: the Hyprland watcher (quick_watch.py)", "waits on Hyprland's socket", tag("low") + " good: event-driven"],
         ["Python: the bookshelf (bookshelf.py)", "every 20 s, writes only on change", tag("low") + " good"],
         ["Page: usage stats", "a tick every 5 s, saved once a minute", tag("low") + " fine"],
         ["Page: Training heartbeat", "every 10 s", tag("low") + " fine"],
         ["Page: Puzzles clock", "every 10 s", tag("low") + " fixed (formatters)"],
         ["Desktop: the music card's visualizer", "12 frames a second in silence", tag("high") + " fixed: none in silence"],
         ["Desktop: card widgets re-making their click area", "every 4 s while shown", tag("med") + " watch: 21,600 rebuilds a day each"],
         ["Desktop: the photo frame", "its own pace", tag("low") + " fine"]])

# ---------------------------------------------------------------------------------------------------------------------
r.h1("7. Data, code and tests")
r.table(["Cam's NeuroNet data (sizes only)", "Size"], [["Music (chords)", "87 GB"], ["Photos", "3.4 GB"], ["Card art", "2.6 GB"], ["Everything else", "under 400 MB"], ["Total", "93 GB"]])
r.table(["Code", "Size"], [["The page (ui/, JavaScript)", "8.7 MB, every section loaded at start"], ["Styles", "1.1 MB"], ["Python", "42 files, 0.9 MB"]])
r.table(["Tests run after the fixes", "Result"],
        [["test_perf.js, test_shell.js, test_music_memory.js, test_visualizers.js", "84 passed, 0 failed"],
         ["test_mpris.py, test_music_fixes.py, test_visualizers.py, test_picture_urls.py, test_merge.py, test_card_settings.py", "144 passed, 0 failed"],
         ["test_test_isolation.py (no test may reach Cam's data)", "3 failed → all passed (three files fixed)"],
         ["test_arcana_lan.py, test_arcana_store.py, test_ship_collab.py", "all passed"]])

# ---------------------------------------------------------------------------------------------------------------------
r.h1("8. The team's reviews")
TEAM = [
 ("Software Engineer (chair)", "The headline is the clock: one line of code costing 160 MB an hour. It wasn't our code being wasteful so much as the engine "
  "not letting go of what toLocaleString made -- but the lesson is ours: anything on a timer must reuse what it builds. The leak hunting is now tooling "
  "(nn_perf, nn_grow, nn_listen, nn_retain, nn_idleview), so the next one takes minutes. Next: a nightly 'grow' check in the test suite, and "
  "NeuroNet telling the page when it's tucked away, so every timer can rest."),
 ("UX & Accessibility Designer", "Nothing you see changed, which is the point: the clock still ticks seconds while you're looking. The biggest pages "
  "(Training, which keeps its whole app built -- 36-46 thousand elements in memory -- then I Ching, the Oracle and Stuff at roughly 26-31 thousand) are where scrolling will feel heaviest on a slower computer -- "
  "drawing only what's on screen there is the next comfort win."),
 ("Music & Stuff", "The library was the worst leak -- 760 elements a visit, and Music is where Cam spends hours. Fixed at the shared picture loader, "
  "so Albums, Stuff's media and Photos are covered by the same change. The playlists panel no longer redraws itself once per visit, and the visualizer rests in silence."),
 ("Photos", "Our grid leaked through the same loader and through drag-select's document listeners, which only let go when the mouse moved. Both fixed; "
  "the photo library's caching (thumbnails by address) was already right."),
 ("Training", "One small listener per visit to Sessions, holding the whole page until the window was resized. Fixed. Groups is our heaviest page; we'd "
  "like it paged or drawn on demand."),
 ("Scribe", "Our vault was simply where NeuroNet was sitting while the clock leaked -- nothing in Notes or Collaboration grew. Collaboration's pictures and "
  "notes are small (14 MB and 23 MB)."),
 ("Home & the desktop", "The music card drew frames of silence all day; fixed, but it needs the widgets restarted. Our card widgets re-make their click area "
  "every 4 seconds while shown -- no leak measured yet, but worth doing only when something moves."),
 ("Divination & Mindfulness", "Our pages look like they grow but don't: the shell keeps its last page, by design, so going back is instant. I Ching and "
  "the Oracle are big pages (all 64 hexagrams, every card) and would benefit most from drawing on demand."),
 ("Puzzles", "Our clock had the same formatting habit as the top bar, every 10 seconds; fixed the same way."),
 ("Kitchen & Money", "Nothing found: both open in milliseconds and leave nothing behind."),
 ("Creative & Code", "Nothing found. The vector studio is one of the slower pages to open (27 ms) -- still quick.")]
for who, txt in TEAM:
    r.h3(who); r.p(txt)

# ---------------------------------------------------------------------------------------------------------------------
r.h1("9. The meeting")
r.p("<b>3 November 2026.</b> The chair, the UX & Accessibility Designer and every section head. Agenda: the clock, the leaks, the widgets, what next.", "lead")
r.ol(["<b>The clock.</b> Agreed: formatters made once everywhere a timer formats dates; the second hand only while NeuroNet is in front. A seconds switch "
      "in Settings if Cam ever wants it everywhere.",
      "<b>The leaks.</b> Agreed: the fix belongs in the shared picture loader, not in each section. Any new watcher, observer or document listener must "
      "stop itself when its page leaves -- added to the review checklist.",
      "<b>The desktop.</b> Agreed: no drawing without music. The 4-second click-area rebuild stays for now and is measured over a day in PT73.",
      "<b>Big pages.</b> Training's groups, I Ching, the Oracle and Stuff draw only what's on screen -- next round, one at a time, each measured.",
      "<b>Tooling.</b> The walkers stay in tools/audit; a 'grow' test joins the suite so a leak fails a test, not Cam's evening.",
      "<b>Safety.</b> The three tests that could reach real data are fixed; test_test_isolation.py keeps guarding it."])
r.callout("Decided", "<p>Formatters once · seconds only in front · watchers stop with their page · no frames of silence · big pages next · a grow test in the suite.</p>")

# ---------------------------------------------------------------------------------------------------------------------
r.h1("10. What's next")
r.table(["Idea", "From", "What it is", "Work"],
        [["NeuroNet knows when it's tucked away", "Software Engineer", "Python tells the page when the window is shown or hidden (it already knows, for the bar widget), so every timer and animation can rest -- not only the clock.", "small"],
         ["A grow test in the suite", "Software Engineer", "nn_grow.mjs on the sample NeuroNet: any view that keeps growing fails the build.", "small"],
         ["Draw only what's on screen", "UX, Training, Divination", "Training's groups, I Ching, the Oracle, Stuff: rows drawn as you scroll.", "medium"],
         ["An App health card", "Settings", "Settings > Stats shows NeuroNet's memory now and since it started, with a Restart button.", "small"],
         ["Calmer desktop widgets", "Home & the desktop", "Click areas re-made only when a widget moves or the layout changes.", "small"],
         ["NeuroCafe's Graphics setting", "Cam (PT71 g1)", "NeuroArcana's Full / Balanced / Light, brought to NeuroCafe.", "medium"],
         ["A seconds switch", "UX", "Settings: the top-bar clock with or without seconds.", "small"]])

r.h1("Appendix: every view, after")
r.table(["View", "Open ms", "Elements", "Listeners", "Idle work (3 s)"],
        [[e(v["key"]), f"{v['openMs']:.0f}", f0(v["nodes"]), str(v["listeners"]), f"{v['idle']['taskMs']} ms"] for v in A["views"]], num=(1, 2, 3, 4))

os.makedirs(OUT, exist_ok=True)
html = r.write(os.path.join(OUT, "NeuroNet Performance Audit.html"))
r.pdf(html, os.path.join(OUT, "NeuroNet Performance Audit.pdf"))
