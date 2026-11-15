"""The letterhead every printout shares.

Cam: "Now i want Coach Cam print out to have Neuronet on the top left hand
corner and coach cam logo on the top right hand corner. If the application
can handle all printouts like this it will help keep consistency (like a
styled page header). I still want the contents of the coach cam printout to
be the same as it is now with the colors for exercise groupings."

WHY THIS IS TESTED IN PYTHON AND NOT IN JAVASCRIPT, which is the point of
the whole arrangement. The printouts are not built in one language:
Training renders its documents in Python, because the same builders also
produce its .docx, .xlsx and .pdf; Personal Effects and the rest render
theirs in JavaScript. Written twice, the letterhead would be two things
that must agree forever -- and they would stop agreeing the first time
someone nudged a colour on one side, which is the inconsistency Cam is
asking to be rid of.

So it is built once, in print_header.py, and the JavaScript asks for it
across the bridge. That means the letterhead's CONTENT is a Python
question and is settled here; the JavaScript side's job is only to ask for
it and put what comes back at the top of the page, and that is what
test_effects.js checks.

LEFT AND RIGHT ARE CHECKED BY POSITION, not by presence. "The page contains
a NeuroNet logo and a Coach Cam logo" is true of a page with both in the
wrong corners, which is precisely what Cam asked to have changed -- Coach
Cam used to be on the left.
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
APP = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(HERE)
sys.path.insert(0, APP)

import print_header as ph          # noqa: E402

passed = failed = 0
lines = []


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        lines.append("  ok    " + name)
    else:
        failed += 1
        lines.append("  FAIL  " + name + (("\n          " + detail) if detail else ""))


# ---------------------------------------------------------------- the mark
mark = ph.neuronet_mark_svg()
ok("the NeuroNet mark can be drawn", mark.startswith("<svg") and "<path" in mark,
   repr(mark[:80]))

# Pulled out rather than chained onto re.search(...).group(1). Breaking the
# sprite lookup on purpose made the mark an empty string, and this file then
# died on None.group(1) -- a traceback and NO result line at all, which a
# run that only counts "passed, failed" skips in silence. A check that
# cannot fail out loud is worse than one that fails.
mark_d = (re.search(r'd="([^"]+)"', mark) or [None, ""])[1] if mark else ""
ok("  and it is the app's own artwork, not a copy kept here",
   len(mark_d) > 3000,
   "read out of ui/index.html, so changing the logo changes the letterhead; "
   f"got {len(mark_d)} chars")

with open(os.path.join(APP, "ui", "index.html"), encoding="utf-8") as f:
    sprite = f.read()
found = re.search(r'<symbol id="i-neuronet" viewBox="[^"]+"[^>]*>\s*<path d="([^"]+)"',
                  sprite)
sprite_d = found.group(1) if found else ""
ok("  the very same path the sidebar draws",
   bool(sprite_d) and mark_d == sprite_d,
   "one logo, one home for it")

ok("Coach Cam's mark is found", ph.logo_data_uri("coachcam-192.png") is not None)
ok("  and travels inside the page as data",
   ph.logo_data_uri("coachcam-192.png").startswith("data:image/png;base64,"),
   "a printed page is a standalone file; it cannot reference icons/")
ok("a missing logo is None rather than an exception",
   ph.logo_data_uri("no-such-icon.png") is None,
   "a missing icon must never stop a printout")

# ------------------------------------------------------------- the header
head = ph.header_html("Monday — Lower", right_logo="coachcam-192.png",
                      right_name="Coach Cam")

ok("the header has all three parts", "<svg" in head and "data:image/png" in head
   and "Monday" in head)

# POSITION, not presence. .find, not .index: a missing piece must report as
# a failed check, not end the run with a ValueError and no result line at
# all. Proven by deleting the mark on purpose -- the first version died here
# and printed nothing a tally could read.
i_neuro = head.find("<svg")
i_title = head.find("Monday")
i_coach = head.find("data:image/png")
ok("NeuroNet is on the LEFT",
   i_neuro >= 0 and i_title >= 0 and i_coach >= 0 and i_neuro < i_title < i_coach,
   f"neuronet@{i_neuro} title@{i_title} coachcam@{i_coach} (-1 means absent)")
ok("Coach Cam is on the RIGHT", i_coach >= 0 and i_title >= 0 and i_coach > i_title,
   "it used to be on the left with an empty spacer opposite; the swap IS "
   "the change Cam asked for")
ok("  with its name beside it", "Coach Cam" in head)
ok("the title is centred", "text-align:center" in head)
ok("the outer columns are the same width, so the middle is centred on the "
   "page", head.count("flex:0 0 190px") == 2,
   "left the right column to flex and the title centres on what is left "
   "over, which reads very slightly crooked")
ok("there is a coloured rule under it",
   "linear-gradient" in head and ph.BRAND.lstrip("#").lower() in head.lower(),
   "Cam asked for colour")
ok("everything is styled inline",
   "<style" not in head,
   "this HTML is also fed to the .docx converter and pasted into pages "
   "built elsewhere, where a <style> block arriving halfway down does "
   "nothing")

# The same header, for a screen with no mark of its own.
plain = ph.header_html("Personal Effects", subtitle="9 items", meta="26 September 2026")
ok("a section without its own logo still gets the letterhead",
   "<svg" in plain and "Personal Effects" in plain)
ok("  with the date on the right so the header still balances",
   "26 September 2026" in plain and plain.index("26 September")
   > plain.index("Personal Effects"),
   "an empty right column leaves the page looking lopsided")
ok("  and no stray logo from somewhere else", "data:image/png" not in plain)
ok("  the subtitle rides under the title",
   "9 items" in plain and plain.index("9 items") > plain.index("Personal Effects"))

# ------------------------------------------------- a logo that is line art
#
# Cam: "PFA the logo for the kitchen sub section printouts. If in your
# opinion it will be better just have the icon and omit the text under the
# camscookery logo."
#
# The icon only, with the name set as LIVE TEXT beside it -- which is what
# Coach Cam's sheets already do, so the two match. His artwork has
# "camscookery" drawn into it below the emblem; scaled so the whole logo
# fits a letterhead, that wordmark is about 11px tall, which is a smudge
# rather than a word. As text it stays crisp at any size, in the .docx
# export too, and can be read by a screen reader.
cook = ph.logo_svg("camscookery.svg")
ok("the cookery mark is line art, not a picture",
   cook.startswith("<svg") and "<path" in cook,
   repr(cook[:60]))
ok("  traced properly, not a stub", len(cook) > 8000, f"{len(cook)} chars")
ok("  and it carries no background onto white paper",
   "black" not in cook.lower() and "#000" not in cook,
   "a PNG of this logo would print a black square on a recipe")

kitchen = ph.header_html("Spaghetti Carbonara", subtitle="Serves 4",
                         right_logo="camscookery.svg", right_name="camscookery")
_n, _t, _c = (kitchen.find("<svg"), kitchen.find("Spaghetti"),
              kitchen.rfind("<svg"))
ok("a Kitchen page puts NeuroNet left and the cookery mark right",
   min(_n, _t, _c) >= 0 and _n < _t < _c,
   f"neuronet@{_n} title@{_t} cookery@{_c}")
ok("  with the name as real text beside it", "camscookery" in kitchen)
ok("  in the deep green, so it is not washy on paper",
   ph.BRAND_INK.lstrip("#").lower() in kitchen.lower())
ok("  and no picture is embedded for it",
   kitchen.count("data:image/png") == 0,
   "line art belongs in paths; a PNG would be fixed-colour and fixed-size")

# ----------------------------------------------- Coach Cam's page, intact
import importlib.util                                      # noqa: E402
spec = importlib.util.spec_from_file_location("nn", os.path.join(APP, "neuronet.py"))
nn = importlib.util.module_from_spec(spec)
sys.modules["nn"] = nn
spec.loader.exec_module(nn)
import training_documents as d                             # noqa: E402

session = {
    "name": "Monday — Lower", "notes": "Build through the top set.",
    "parts": [],
    "items": [
        {"name": "Back Squat", "block": "A1", "sets": "4", "reps": "5"},
        {"name": "Box Jump", "block": "A2", "sets": "4", "reps": "3"},
        {"name": "Romanian Deadlift", "block": "B1", "sets": "3", "reps": "10"},
        {"name": "Nordic Curl", "block": "B2", "sets": "3", "reps": "6"},
        {"name": "Farmer Carry", "block": "C1", "sets": "3", "reps": "40m"},
        {"name": "Bike", "block": "W", "sets": "1", "reps": "5min"},
    ]}
body = nn.Api()._training_kinds()["session"][3](session)
page = d.print_page("Monday — Lower", body, session)

ok("a Coach Cam session prints on the shared letterhead",
   "<svg" in page and "data:image/png" in page)
# Scoped to the body. The document's <title> also says "Monday", and it
# sits above the letterhead, so searching the whole page put the title
# "before" the mark and failed a page that was laid out correctly.
body_only = page[page.index("<body"):]
_s, _t, _c = (body_only.find("<svg"), body_only.find("Monday"),
              body_only.find("data:image/png"))
ok("  NeuroNet left, Coach Cam right",
   min(_s, _t, _c) >= 0 and _s < _t < _c,
   f"svg@{_s} title@{_t} coach@{_c} (-1 means absent)")

# Cam: "I still want the contents of the coach cam printout to be the same
# as it is now with the colors for exercise groupings."
colours = re.findall(r'<tr style="background:#([0-9A-Fa-f]{6})"', page)
ok("the exercise grouping colours are exactly as they were",
   colours == ["C6EFCE", "C6EFCE", "FFF2B8", "FFF2B8", "FFD3DC", "F2C88C"],
   str(colours) + " — A green, B yellow, C pink, W orange; the header was "
   "the only thing Cam asked to change")
ok("  the session's own title bar is still there",
   d.DOCX_HEADER_DARK in page)
ok("  and so are the table headers",
   d.DOCX_HEADER_MED in page)
ok("  and the post-session notes",
   "Post session notes" in page)

print("\ntest_print_header.py")
print("\n".join(lines))
print(f"\n  {passed} passed, {failed} failed\n")
sys.exit(1 if failed else 0)
