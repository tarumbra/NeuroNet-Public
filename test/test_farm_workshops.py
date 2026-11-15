"""NeuroFarm's Workshops page, clicked (2026-10-09).

Cam: "i would like the workshops page to be similar to the one in neuropets as
well, so everything has a click interface, i want this game to have a homeley
chill vibe." A yard of workshops; click one and its sheet opens: click a
recipe to make it (one you can't make says why), a finished thing to collect
it, Esc or the backdrop to close; an unbuilt workshop offers Build. With no
room a recipe is queued (click it in the queue to take it out), and the
kitchen's extra stoves are added from the same sheet.

The real page in headless Chromium (test/farm_workshops.html) on a made-up
farm -- nothing is saved, no window opens. Skips if there's no Chromium.
"""
import os
# Never Cam's real data: since the 1.0.2 install ~/.config/neuronet/paths.json names it, and data_dir() reads that
# before anything a test patches. test_test_isolation.py checks every test does this first.
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import json
import re
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print("  ok    " + name)
    else:
        failed += 1
        print("  FAIL  " + name + (f"\n          {detail}" if detail else ""))


print("\nNeuroFarm: the Workshops page\n")
browser = next((b for b in ("chromium", "chromium-browser", "google-chrome") if shutil.which(b)), None)
if not browser:
    print("  skip  no Chromium here")
    sys.exit(0)
def run(mode):
    page = "file://" + os.path.join(HERE, "farm_workshops.html") + mode
    return subprocess.run([browser, "--headless=new", "--disable-gpu", "--allow-file-access-from-files", "--virtual-time-budget=5000",
                           "--window-size=1400,900", "--dump-dom", page], capture_output=True, text=True, timeout=90).stdout


def results(dom):
    m = re.search(r'<pre id="out">(.*?)</pre>', dom, re.S)
    try:
        return (json.loads(m.group(1).replace("&quot;", '"').replace("&amp;", "&")) if m else {}), m
    except ValueError:
        return {}, m


r, m = results(run(""))
ok("the page ran", r and "error" not in r, (r or {}).get("error") or (m.group(1)[:300] if m else "no #out"))
ok("a yard of the four workshops, no sheet until you click one",
   r.get("yard") == ["kitchen", "dairy", "loom", "mill"] and r.get("noSheetYet"), str(r.get("yard")))
ok("  the Kitchen shows what's ready; the Mill isn't built (and you could build it)", r.get("kitchenBadge") == "1" and r.get("millLine") == "Ready to build", f"{r.get('kitchenBadge')} / {r.get('millLine')}")
ok("click a workshop: its sheet, with every recipe it makes", r.get("sheet") and r.get("recipes") == r.get("kitchenRecipes"), f"{r.get('recipes')} of {r.get('kitchenRecipes')}")
ok("click a recipe: it's made (and the sheet stays open)", r.get("cooked") == 1 and r.get("sheetStaysOpen"))
ok("a recipe you can't make says why, and makes nothing", r.get("lockedSays") and r.get("lockedCooks") == 0 and r.get("lockedToast"))
ok("click a finished thing: collected", r.get("collected") == 1, str(r.get("collected")))
ok("no free stove: a recipe says Queue", r.get("fullSays") == "Queue", r.get("fullSays"))
ok("  click it: queued (what it takes comes out), and shown in the queue", r.get("queued"))
ok("  click it in the queue: taken out, everything back", r.get("unqueued"))
ok("Add a stove: one more cooking at once, and the queue's next starts on it", r.get("stove") and r.get("stoveHead"))
ok("Esc or the backdrop closes the sheet", r.get("escCloses") and r.get("backdropCloses"))
ok("an unbuilt workshop's sheet offers Build", r.get("millBuild"))
ok("the homely look: light and warm, not the old night", r.get("homely") == "light", r.get("homely"))
ok("the farm takes the whole width (no side panel); the day's summary is a strip of chips", r.get("noSidePanel") and r.get("landWide", 0) > 0.9, str(r.get("landWide")))
ok("  the tile under the pointer: a caption over the field, gone when you leave", r.get("caption") and r.get("captionHides"))
ok("  a building you click: a card over the field (one ✕), Esc closes it", r.get("floatCard") and r.get("floatCloses"))
# Cam's painted yard (2026-10-09): the same clicks on the picture's buildings and signs
print("\n  -- with the painted pictures --")
r, m = results(run("#art"))
ok("the painted yard: the picture, a click area per workshop (no cards)", r.get("painted") and r.get("yard") == ["kitchen", "dairy", "loom", "mill"], str(r.get("error") or r.get("yard")))
ok("  each says what it's up to", r.get("kitchenBadge") == "1" and r.get("millLine") == "Ready to build", str(r.get("millLine")))
ok("  click a building: its sheet; make, queue, collect and close all work the same",
   r.get("sheet") and r.get("cooked") == 1 and r.get("queued") and r.get("unqueued") and r.get("collected") == 1 and r.get("escCloses") and r.get("millBuild"))
ok("the painted farm: Close up (bigger tiles) and Whole farm", r.get("zoomWhole") and r.get("closeBigger"), f"tile {r.get('tilePx')}px")
ok("  and the strip, caption and building card there too", r.get("noSidePanel") and r.get("caption") and r.get("floatCard"))
print(f"\n  {passed} passed, {failed} failed\n")
sys.exit(1 if failed else 0)
