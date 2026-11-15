"""The daily cards' guide side (Service.qml, all three tools).

Cam (2026-10-02): "when i pull a card and flip it i want the ability to right
click and have the card flip and reveal the guide information on the card on
a purple and black gradient background, where purple takes the top of the card
and 90% down the card while near the bottom it transitions to black. This
should work on the three types of card i pull."

Source checks, then the real Service.qml (the Oracle copy) in a throwaway `qs`
with a made-up deck and today's pull (HOME in a temp folder). The reading is
never opened on screen: the turns are driven directly.
"""
import os
# Never Cam's real data: since the 1.0.2 install ~/.config/neuronet/paths.json
# names it, and data_dir() reads that before anything a test patches. A file
# that can't exist means "no config" here and in every process a test starts.
# test_test_isolation.py checks every test does this first.
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import datetime, json, re, shutil, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
PLUG = os.path.join(APP, "system", "omarchy", "plugins")
passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1; print("  ok    " + name)
    else:
        failed += 1; print("  FAIL  " + name + ("\n          " + str(detail) if detail else ""))


print("\nThe daily cards' guide side\n")
svc = open(os.path.join(PLUG, "neuronet.tarot", "Service.qml"), encoding="utf-8").read()
ok("one file for all three tools (Tarot, Oracle, Lenormand)",
   all(open(os.path.join(PLUG, d, "Service.qml"), encoding="utf-8").read() == svc for d in ("neuronet.oracle", "neuronet.lenormand")))
ok("right-click the turned card: it turns to its guide", "if (m.button === Qt.RightButton) root.toggleGuide()" in svc
   and "acceptedButtons: Qt.LeftButton | Qt.RightButton" in svc)
g = svc.split("id: guideFace", 1)[1].split("Flickable", 1)[0]
ok("purple most of the way down (to 90%), into black at the foot",
   re.search(r'position: 0\.0; color: "#5a2a9c".*position: 0\.9; color: "#3b1670".*position: 1\.0; color: "#000000"', g, re.S) is not None)
ok("the guide: name, kind / suit / deck, upright and reversed (this one marked), about",
   all(x in svc for x in ('"UPRIGHT" + (root.shown && !root.shown.reversed ? "  ·  this one" : "")', '"REVERSED"', '"ABOUT"',
                          "root.kindNames[root.shown.kind]", "guideFace.upright", "guideFace.reversedText")))
ok("a new reading, or a card drawn again, starts on the picture",
   "plainGuide()\n    viewing = null" in svc and svc.count("plainGuide()") >= 3)
ok("  it scrolls with the wheel", "guideScroll.contentY = Math.max(0, Math.min(max, guideScroll.contentY - w.angleDelta.y / 2))" in svc)

HARNESS = r'''
import QtQuick
import Quickshell
ShellRoot {
  id: sh
  property var s: null
  property var r: ({})
  Component.onCompleted: s = Qt.createComponent("file://@DIR@/neuronet.oracle/Service.qml").createObject(sh)
  Timer { interval: 1500; running: true; onTriggered: {
    sh.r.loaded = !!sh.s && !!sh.s.today
    sh.s.toggleGuide()                              // face down: nothing to read yet
    sh.r.faceDown = sh.s.guideFlip
    sh.s.flip = 1                                   // turned over
    sh.s.toggleGuide()
  } }
  Timer { interval: 2400; running: true; onTriggered: {
    sh.r.guide = sh.s.guideFlip
    sh.s.turn()                                     // a click on the guide turns back to the picture
  } }
  Timer { interval: 3200; running: true; onTriggered: {
    sh.r.back = sh.s.guideFlip
    sh.s.toggleGuide()
  } }
  Timer { interval: 4000; running: true; onTriggered: {
    sh.r.again = sh.s.guideFlip
    sh.s.plainGuide()                               // what open() and redraw() do first (open() itself would show the reading)
    sh.r.reset = sh.s.guideFlip
    console.log("RESULT r " + JSON.stringify(sh.r))
    Qt.quit()
  } }
  Timer { interval: 9000; running: true; onTriggered: Qt.quit() }
}
'''

if not shutil.which("qs") or not os.environ.get("WAYLAND_DISPLAY"):
    print("  skip  the card itself (needs qs and a Wayland session)")
else:
    d = tempfile.mkdtemp(prefix="nn-cardguide-")
    try:
        shutil.copytree(os.path.join(PLUG, "neuronet.oracle"), os.path.join(d, "neuronet.oracle"))
        for x in ["Ui", "Commons"]:
            os.symlink(os.path.join("/usr/share/omarchy/shell", x), os.path.join(d, x))
        home = os.path.join(d, "home")
        data = os.path.join(d, "data")
        os.makedirs(os.path.join(data, "cards", "images"))
        os.makedirs(os.path.join(home, ".config", "neuronet"))
        json.dump({"app": APP, "data": data}, open(os.path.join(home, ".config", "neuronet", "paths.json"), "w"))
        json.dump({"oracleDecks": [{"id": "d1", "name": "Moon deck", "cards": [
            {"id": "c1", "name": "Hoodwinks", "image": "c1.jpg", "upright": "Tricksters.", "reversed": "", "synopsis": "Mischief."}]}]},
            open(os.path.join(data, "cards", "celestial.json"), "w"))
        today = datetime.date.today().isoformat()
        st = os.path.join(home, ".local", "state", "neuronet-oracle")
        os.makedirs(st)
        json.dump({"kind": "oracle", "desktopCard": False, "days": {"oracle": {
            "date": today, "at": "2026-10-02T09:00:00Z", "kind": "oracle", "deckId": "d1", "deckName": "Moon deck",
            "cardId": "c1", "name": "Hoodwinks", "image": "c1.jpg", "reversed": True, "meaning": "", "other": "Tricksters.",
            "synopsis": "Mischief.", "saved": False}}, "history": []}, open(os.path.join(st, "state.json"), "w"))
        with open(os.path.join(d, "shell.qml"), "w") as f:
            f.write(HARNESS.replace("@DIR@", d))
        p = subprocess.Popen(["qs", "-p", d], env=dict(os.environ, HOME=home), stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        try:
            log, _ = p.communicate(timeout=40)
        except subprocess.TimeoutExpired:
            p.kill(); log, _ = p.communicate()
        res = {}
        for line in log.splitlines():
            if "RESULT " in line:
                tag, _, js = line.split("RESULT ", 1)[1].partition(" ")
                res[tag] = json.loads(js)
        errors = [l for l in log.splitlines() if "Service.qml" in l and re.search(r"error|TypeError|ReferenceError|Unable", l, re.I)]
        R = res.get("r")
        ok("the Oracle tool loads with today's card, without QML errors", R is not None and R.get("loaded") and not errors,
           errors[:3] or log[-600:])
        if R:
            ok("face down, there's no guide to turn to", R["faceDown"] == 0)
            ok("turned over, a right-click turns it to its guide", R["guide"] == 1, R)
            ok("  a click turns it back to the picture", R["back"] == 0, R)
            ok("  and right-click again, the guide again", R["again"] == 1, R)
            ok("a new reading always starts on the picture", R["reset"] == 0, R)
    finally:
        shutil.rmtree(d, ignore_errors=True)

print(f"\n  {passed} passed, {failed} failed\n")
sys.exit(1 if failed else 0)
