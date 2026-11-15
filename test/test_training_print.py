#!/usr/bin/env python3
"""Training sheets print the way Coach Cam printed them.

Cam: "I want it to be on par with the last Coach Cam application...
allign the new KinCrux training print layout to match the print from
coach cam. It would be great if you kept the coach cam logo and name on
the print from KinCrux as well."

WHAT THIS IS GUARDING AGAINST is not a crash. The old print BUTTON
worked. It opened a page, and the page said:

    Lower Body Max Strength
    id      1788950931173-11flf3
    name    Lower Body Max Strength
    created 2026-09-09T20:48:51.173195
    notes   First heavy lower session of the block...
    Stations
      - Assault Bike
      - 90/90 Hip Switch ...

Every exercise name, and not one set, rep, load or rest. A coach takes
that to the gym floor and it tells him nothing he did not already know.
The failure had no error and no red anywhere -- which is exactly why it
needs a test that reads the OUTPUT rather than checking the call
succeeded.

So these checks are about content: the letterhead Cam asked to keep,
the six columns, the block colours that group the sheet at a glance,
and the write-on notes area. A sheet missing any of them is the
placeholder coming back.
"""
import os
# Never Cam's real data: since the 1.0.2 install ~/.config/neuronet/paths.json
# names it, and data_dir() reads that before anything a test patches. A file
# that can't exist means "no config" here and in every process a test starts.
# test_test_isolation.py checks every test does this first.
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
sys.path.insert(0, APP)
sys.path.insert(0, os.path.join(APP, "crux", "py"))

# resource_dir() follows sys.argv[0], which is neuronet.py when Cam launches
# the app. Imported from here without this, it looked for the letterhead
# logo in test/ and reported it missing -- the app was right, the test was
# not launching it the way Cam does.
sys.argv = [os.path.join(APP, "neuronet.py")]
import training_documents as docs                        # noqa: E402

PASS = 0
FAIL = 0
LINES = []


def ok(name, cond, detail=""):
    global PASS, FAIL
    if cond:
        PASS += 1
        LINES.append("  ok    " + name)
    else:
        FAIL += 1
        LINES.append("  FAIL  " + name
                     + ("\n          " + str(detail) if detail else ""))


# Cam's own session, exactly as he printed it.
SESSION = {
    "id": "1788950931173-11flf3",
    "name": "Lower Body Max Strength",
    "created": "2026-09-09T20:48:51.173195",
    "notes": "First heavy lower session of the block. Rest is long on "
             "purpose — cut it short and this becomes a hypertrophy "
             "session at a strength load.",
    "items": [
        {"block": "W1", "name": "Assault Bike", "sets": "1", "reps": "5 min",
         "load": "Easy", "rest": ""},
        {"block": "W4", "name": "Goblet Squat", "sets": "2", "reps": "8",
         "load": "Light", "rest": "45s"},
        {"block": "A1", "name": "Back Squat", "sets": "5", "reps": "3",
         "load": "85% 1RM", "rest": "3 min"},
        {"block": "B1", "name": "Romanian Deadlift (RDL)", "sets": "4",
         "reps": "6", "load": "RPE 7-8", "rest": "2 min"},
        {"block": "C1", "name": "Split Squat", "sets": "3", "reps": "8/leg",
         "load": "Rear foot elevated, RPE 7", "rest": "90s"},
        {"block": "Z1", "name": "Walking", "sets": "1", "reps": "5 min",
         "load": "Easy", "rest": ""},
    ],
    "logEntries": [],
}

page = docs.print_page(SESSION["name"], docs._session_html(SESSION), SESSION)


# ---- the letterhead Cam asked to keep ---------------------------------
# Written as the artwork writes it -- "coach cam" -- since the new mark.
ok("the sheet carries the Coaching name", "coaching" in page.lower(), "")
ok("  and the Coach Cam logo, embedded in the page itself",
   "data:image/png;base64," in page,
   "a linked image would be a broken icon: the print file is a temp "
   "file opened by the browser, with no app folder beside it")
ok("  with the session name as the heading",
   "Lower Body Max Strength" in page, "")


# ---- the table, which is the whole point ------------------------------
ok("the exercises are a TABLE, not a bullet list",
   page.count("<table") >= 1 and "<ul>" not in page.split("Post session")[0],
   "the placeholder printed exercise names as <li> and nothing else")

for column in ("Block", "Exercise", "Sets", "Reps", "Load", "Rest"):
    ok("  there is a %s column" % column, ">%s<" % column in page, "")

# the values a coach actually needs on the gym floor
for label, value in (("the sets", ">5<"), ("the reps", ">3<"),
                     ("the load", "85% 1RM"), ("the rest", "3 min"),
                     ("a per-side rep scheme", "8/leg"),
                     ("an RPE prescription", "RPE 7-8")):
    ok("  %s is on the sheet" % label, value in page,
       "the placeholder printed the exercise NAME and nothing else")


# ---- the block colours ------------------------------------------------
# Warm-up, working blocks and cool-down each get their own fill, which is
# what lets a coach find the working set without reading every row.
fills = set(re.findall(r"background(?:-color)?:\s*#([0-9A-Fa-f]{6})", page))
ok("the rows are colour-grouped by block",
   len(fills) >= 4, "%d distinct fills found: %s" % (len(fills), sorted(fills)))
ok("  and the warm-up and the first working block differ",
   docs._color_for_block("W1") != docs._color_for_block("A1"),
   "%s vs %s" % (docs._color_for_block("W1"), docs._color_for_block("A1")))
ok("  while everything in one block shares a colour",
   docs._color_for_block("A1") == docs._color_for_block("A2"),
   "A1 and A2 are the same block and must read as one")


# ---- the write-on area ------------------------------------------------
ok("a session gets a post-session notes area",
   "Post session notes" in page, "")
ok("  with ruled lines to write on",
   page.count("border-bottom:1px solid #999") >= 4,
   "a heading with nothing under it is not a place to write")

# but a guide does not: ruled lines under a reference sheet are wasted paper
guide_page = docs.print_page("Squat Setup",
                             docs._guide_html({"name": "Squat Setup",
                                               "bodyHtml": "<p>Brace.</p>"}))
ok("a guide gets the letterhead but NO ruled lines",
   "coaching" in guide_page.lower() and "Post session notes" not in guide_page,
   "ruled lines under a reference sheet are wasted paper")


# ---- what the interface asks for --------------------------------------
# The kinds the Training module can print, checked against the engine so
# a renamed function is caught here rather than by a dead button.
for kind, fn in (("session", "_session_html"), ("circuit", "_circuit_html"),
                 ("guide", "_guide_html"), ("program", "_program_html"),
                 ("athlete", "_athlete_html"),
                 ("lessonplan", "_lessonplan_html"),
                 ("calendar", "_calendar_html"),
                 ("questionnaire", "_questionnaire_html"),
                 ("mas_sheet", "_mas_sheet_html"), ("book", "_book_html")):
    ok("%s has a renderer" % kind, callable(getattr(docs, fn, None)), fn)

# and the export builders the same three formats go through
for fn in ("build_session_docx", "build_session_xlsx", "build_session_pdf",
           "build_circuit_docx", "build_program_docx"):
    ok("  %s is there too" % fn, callable(getattr(docs, fn, None)),
       "print and export share one layout; losing one loses the match")


# ---- the placeholder must not come back -------------------------------
with open(os.path.join(APP, "ui", "training", "storage.js"),
          encoding="utf-8") as f:
    storage = f.read()
ok("the interface calls the real engine, not a local renderer",
   "training_print_document" in storage and "renderForPrint" not in storage,
   "renderForPrint was the key/value dump")


# ---- the professional refresh (2026-10-05) ------------------------------
# Cam: "program printouts do not look fleshed out like session printouts".
PROGRAM = {"name": "Six Weeks", "overview": {"objective": "Pass the PFT"},
           "mesocycles": [{"name": "Block 1",
                           "weeks": [{"weekNum": "1", "rir": "4"}, {"weekNum": "2", "rir": "3"}],
                           "sessionGroups": [{"sessions": [
                               {"name": "S1 Lower", "items": SESSION["items"][:3]},
                               {"name": "S2 Upper", "items": SESSION["items"][3:5]}]}]}],
           "sessionDetails": {"S1 Lower": {"notes": "Slow neck work.", "tags": ["Lower body"]}}}
prog = docs.print_page("Six Weeks", docs._program_html(PROGRAM), kind="program")
ok("a program prints each session on its own page", prog.count('class="nn-page-break"') == 2,
   prog.count('class="nn-page-break"'))
ok("  each with its library notes and tags, and a place to write",
   "Slow neck work." in prog and "Lower body" in prog and prog.count("Post session notes") == 2, "")
ok("  after the overview, a week-by-week table and a list of the sessions",
   "Pass the PFT" in prog and ">Week 2<" in prog and ">RIR<" in prog and 'class="index"' in prog, "")
ok("  the program's own exercises win over the library's",
   docs._program_session({"sessionDetails": {"S": {"items": [], "notes": "n"}}},
                         {"name": "S", "items": [1]})["items"] == [1], "")
athlete = docs._athlete_html({"name": "A", "assignments": [{"type": "program", "program": PROGRAM}]})
ok("  inside an athlete pack it stays compact (no page per session)",
   'class="nn-page-break"' not in athlete and "S2 Upper" in athlete, "")
sess_page = docs.print_page(SESSION["name"], docs._session_html(SESSION), SESSION, kind="session")
head = sess_page[sess_page.index("<body"):sess_page.index('class="nn-title-block"')]
ok("the letterhead names the kind of sheet; the title block names the session",
   "Training session" in head and SESSION["name"] not in head and 'class="nn-kicker"' in sess_page, "")
ok("  a print date at the foot", 'class="nn-foot"' in sess_page and "printed" in sess_page, "")
with open(os.path.join(APP, "ui", "training", "app.js"), encoding="utf-8") as f:
    tapp = f.read()
ok("the app sends a program's session details (by name) to print and export",
   "sessionDetails: programSessionDetails(record)" in tapp and "sessionDetails: programSessionDetails(rec)" in tapp, "")
from PIL import Image
mark = Image.open(os.path.join(APP, "icons", "coachcam-192.png")).convert("RGBA")
ok("the coaching mark is the stopwatch: transparent corners, no wordmark band",
   mark.getpixel((0, 0))[3] == 0 and mark.getpixel((mark.width - 1, mark.height - 1))[3] == 0, "")
with open(os.path.join(APP, "ui", "app.js"), encoding="utf-8") as f:
    shell = f.read()
with open(os.path.join(APP, "ui", "index.html"), encoding="utf-8") as f:
    index = f.read()
ok("  and the sidebar draws a stopwatch for Training",
   'training: {icon: "i-stopwatch"' in shell and 'id="i-stopwatch"' in index, "")


# ---- the training log (2026-10-05) ---------------------------------------
# Cam: a log from a session or program's three dots -- the lifts, a box a week for the
# weight, a guide saying the middle set is the one to record; a program uses its own length.
LOGS = dict(SESSION, logWeeks=4)
log = docs.print_page(SESSION["name"], docs._log_html(LOGS), kind="log")
ok("a session log: a box a week for each lift, warm-up and cool-down left off",
   log.count('<td class="wk">') == 4 * 3 and "Back Squat" in log and "Walking" not in log, log.count('<td class="wk">'))
ok("  a guide at the top: record the middle set", "middle set" in log and "How to use this log" in log, "")
ok("  which set that is, per lift", [docs.middle_set(n) for n in ("3", "4", "5", "1", "AMRAP")] ==
   ["Set 2", "Set 2 or 3", "Set 3", "Set 1", ""], "")
ok("  the letterhead says Training log", "Training log" in log[:log.index('class="nn-title-block"')], "")
plog = docs._log_html(dict(PROGRAM))
ok("a program log uses the program's own weeks, with each week's target under it",
   docs.program_weeks(PROGRAM) == 2 and "Week 2<small>RIR 3</small>" in plog and "S2 Upper" in plog, "")
ok("  or its months (four weeks each) when it has no blocks",
   docs.program_weeks({"durationMonths": "2", "mesocycles": []}) == 8, "")
ok("  past six weeks the page turns landscape; past ten a lift carries on below",
   "landscape" in docs._log_html(dict(SESSION, logWeeks=8)) and "Weeks 11" in docs._log_html(dict(SESSION, logWeeks=12))
   and "landscape" not in docs._log_html(dict(SESSION, logWeeks=6)), "")
wb = docs.build_log_xlsx(dict(PROGRAM, logWeeks=0))
ok("  and an Excel log to type the weights into", wb.active.title == "Log" and wb.active.max_column == 6, wb.active.max_column)
ok("the app offers Log from a session's or program's three dots",
   'label: "Log", iconName: "chart"' in tapp and 'CF.Store.printDocument("log", payload())' in tapp, "")
import neuronet as _nn
ok("  and the host knows how to print and export a log",
   "log" in _nn.Api()._training_kinds() and _nn.Api()._training_kinds()["log"][1] is docs.build_log_xlsx, "")


print("\nNeuroNet — training sheets print like Coach Cam's\n")
for line in LINES:
    print(line)
print("\n  %d passed, %d failed\n" % (PASS, FAIL))
sys.exit(1 if FAIL else 0)
