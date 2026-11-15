#!/usr/bin/env python3
"""Daily cards on the bar (neuronet.tarot, neuronet.oracle, neuronet.lenormand) and the
workspace-1 rule for every NeuroNet desktop widget.

Cam: "for the card pull, please seperate into 2 tools. Keep the current one
for tarot but also make one for both oracle and lenormand as well. This way
i can pull one of each cards each day, then present them side by side on the
desktop." and "make the desktop widegets only appear on workspace 1 and none
of the others". 2026-10-01: "Lets seperate oracle and lenormand like tarot
this will stop ambiguity when pulling a card and allow them to be handled
independtly."

Static checks always run. The behaviour check runs both services in a
throwaway Quickshell (`qs -p`) with HOME pointed at a temp folder, so Cam's
real state files are never touched and no desktop card is shown (all
desktopCard: false). It is skipped without qs or a Wayland session.
"""
import os
# Never Cam's real data: since the 1.0.2 install ~/.config/neuronet/paths.json
# names it, and data_dir() reads that before anything a test patches. A file
# that can't exist means "no config" here and in every process a test starts.
# test_test_isolation.py checks every test does this first.
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import datetime

APP = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
# the desktop layer's copy in the repo: system/ (collect.sh), not the old omarchy-plugin/ (Stage 1)
PLUG = os.path.join(APP, "system", "omarchy", "plugins")
INSTALLED = os.path.expanduser("~/.config/omarchy/plugins")
SHARED = ["Service.qml", "BarWidget.qml", "journal_add.py"]

passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print("  ok    " + name)
    else:
        failed += 1
        print("  FAIL  " + name + ("\n          " + detail if detail else ""))


def read(*p):
    """A file's text, or None when it isn't there (an installed copy that's
    behind the repo is a failed check, not a crash)."""
    try:
        with open(os.path.join(*p), encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        return None


# ---- one file, three tools --------------------------------------------------
TOOLS = ["neuronet.tarot", "neuronet.oracle", "neuronet.lenormand"]
for f in SHARED:
    ok(f + " is the same file in all three card tools",
       all(read(PLUG, t, f) == read(PLUG, "neuronet.tarot", f) for t in TOOLS))

for t in TOOLS:
    man = json.loads(read(PLUG, t, "manifest.json"))
    ok(t + " is a service + bar widget, kept loaded",
       man["id"] == t and set(man["kinds"]) == {"service", "bar-widget"} and man.get("keepLoaded"))

svc = read(PLUG, "neuronet.tarot", "Service.qml")
ok("one kind per tool: tarot, oracle, lenormand",
   '"neuronet.tarot": { kinds: ["tarot"]' in svc
   and '"neuronet.oracle": { kinds: ["oracle"]' in svc
   and '"neuronet.lenormand": { kinds: ["lenormand"]' in svc)
ok("no daily card on the desktop any more (the desktop widgets went, 3 Nov 2026)",
   "WlrLayer.Bottom" not in svc and "DeskSpace" not in svc and "toggleWidget" not in svc
   and all(not os.path.exists(os.path.join(PLUG, t, f)) for t in TOOLS for f in ("DeskSpace.qml", "desklayout.js", "WidgetMenu.qml", "EditHandles.qml")))
ok("state names follow the migration convention (neuronet-*)",
   'state: "neuronet-tarot"' in svc and 'state: "neuronet-oracle"' in svc and 'state: "neuronet-lenormand"' in svc)

# ---- QML pitfall: a property called onXxx is a signal handler --------------
bad = []
for root, _, files in os.walk(PLUG):
    for f in files:
        if f.endswith(".qml"):
            for m in re.finditer(r"property\s+\w+\s+(on[A-Z]\w*)", read(root, f)):
                bad.append(f + ": " + m.group(1))
ok("no QML property is named on<Capital> (its binding never runs)", not bad, ", ".join(bad))

# ---- no desktop windows (the desktop widgets went, 3 Nov 2026) -------------
desk_windows = []
for root, _, files in os.walk(PLUG):
    for f in files:
        if f.endswith(".qml") and re.search(r"WlrLayer\.(Bottom|Background)", read(root, f)):
            desk_windows.append(os.path.basename(root) + "/" + f)
ok("no NeuroNet widget puts a window on the desktop", not desk_windows, str(desk_windows))
for d in ("neuronet.board", "neuronet.frame", "neuronet.home"):
    ok(d + " is gone, and retired in shell.neuronet.json", not os.path.exists(os.path.join(PLUG, d))
       and d in json.loads(read(APP, "system", "omarchy", "shell.neuronet.json"))["retired"])

# ---- the installed copies are these ----------------------------------------
if os.path.isdir(INSTALLED):
    for d in TOOLS:
        same = os.path.isdir(os.path.join(INSTALLED, d)) and all(
            read(INSTALLED, d, f) == read(PLUG, d, f) for f in os.listdir(os.path.join(PLUG, d))
            if os.path.isfile(os.path.join(PLUG, d, f)) and " (2)" not in f)
        ok(d + ": installed copy matches system/omarchy/plugins/", same)

# ---- behaviour, in a throwaway Quickshell ----------------------------------
HARNESS = r'''
import QtQuick
import Quickshell
import Quickshell.Hyprland
ShellRoot {
  id: sh
  property var tarot: null
  property var oracle: null
  property var lenormand: null
  function out(tag, v) { console.log("RESULT " + tag + " " + JSON.stringify(v)) }
  Component.onCompleted: {
    tarot = Qt.createComponent("file://@TMP@/neuronet.tarot/Service.qml").createObject(sh)
    oracle = Qt.createComponent("file://@TMP@/neuronet.oracle/Service.qml").createObject(sh)
    lenormand = Qt.createComponent("file://@TMP@/neuronet.lenormand/Service.qml").createObject(sh)
  }
  Timer { interval: 1500; running: true; onTriggered: {
    sh.out("loaded", { tarotKind: sh.tarot.st.kind, tarotToday: sh.tarot.today ? sh.tarot.today.name : null,
      tarotHistory: sh.tarot.st.history.map(function(p) { return p.kind }),
      oracleKind: sh.oracle.st.kind, oracleIpc: sh.oracle.pluginId, lenormandIpc: sh.lenormand.pluginId,
      oracleCards: sh.oracle.todayCards.map(function(c) { return c.kind }),
      lenormandAdopted: sh.lenormand.today ? sh.lenormand.today.name : null,
      lenormandHistory: sh.lenormand.st.history.map(function(p) { return p.kind }),
      lenormandDesktop: sh.lenormand.st.desktopCard,
      decks: { t: sh.tarot.decks.tarot.length, o: sh.oracle.decks.oracle.length, l: sh.lenormand.decks.lenormand.length } })
    sh.oracle.draw()
    var first = sh.lenormand.today
    sh.lenormand.draw()
    sh.out("drawn", { oracle: sh.oracle.todayCards.map(function(c) { return c.kind }),
      lenormand: sh.lenormand.todayCards.map(function(c) { return c.kind }),
      lenormandRedrawn: !!(sh.lenormand.today && first && sh.lenormand.today.at !== first.at),
      tarotCards: sh.tarot.todayCards.map(function(c) { return c.kind }) })
  } }
  Timer { interval: 3500; running: true; onTriggered: Qt.quit() }
}
'''


def behaviour():
    if not shutil.which("qs") or not os.environ.get("WAYLAND_DISPLAY"):
        print("  skip  behaviour (needs qs and a Wayland session)")
        return
    tmp = tempfile.mkdtemp(prefix="nn-daily-cards-")
    try:
        for d in TOOLS:
            shutil.copytree(os.path.join(PLUG, d), os.path.join(tmp, d))
        shell = "/usr/share/omarchy/shell"
        for d in ["Ui", "Commons"]:
            os.symlink(os.path.join(shell, d), os.path.join(tmp, d))
        with open(os.path.join(tmp, "shell.qml"), "w") as f:
            f.write(HARNESS.replace("@TMP@", tmp))   # file:// so sibling files load
        home = os.path.join(tmp, "home")
        today = datetime.date.today().isoformat()
        old_pull = {"date": today, "at": "x1", "kind": "tarot", "name": "The Magician",
                    "deckName": "D", "image": "", "reversed": False}
        # the old one-card-a-day file: last drawn from Oracle, today's card a tarot
        os.makedirs(os.path.join(home, ".local/state/neuronet-tarot"))
        old_state = {"kind": "oracle", "deckId": "any", "desktopCard": False, "today": old_pull,
                     "history": [old_pull, dict(old_pull, kind="oracle", at="x0")]}
        tarot_file = os.path.join(home, ".local/state/neuronet-tarot/state.json")
        with open(tarot_file, "w") as f:
            json.dump(old_state, f)
        # the old shared Oracle & Lenormand file, with today's Lenormand card in it
        os.makedirs(os.path.join(home, ".local/state/neuronet-oracle"))
        oracle_file = os.path.join(home, ".local/state/neuronet-oracle/state.json")
        len_pull = dict(old_pull, kind="lenormand", at="x2", name="Book")
        with open(oracle_file, "w") as f:
            json.dump({"kind": "lenormand", "desktopCard": False, "days": {"lenormand": len_pull},
                       "history": [len_pull]}, f)
        lenormand_file = os.path.join(home, ".local/state/neuronet-lenormand/state.json")
        # the decks are only READ: point the sandbox at this NeuroNet's (if it has
        # any), and keep every XDG path in the sandbox too
        data = os.path.join(APP, "neuronet_data")
        os.makedirs(os.path.join(home, ".config/neuronet"))
        with open(os.path.join(home, ".config/neuronet/paths.json"), "w") as f:
            json.dump({"app": APP, "data": data} if os.path.isdir(data) else {"app": APP}, f)
        env = dict(os.environ, HOME=home, XDG_CONFIG_HOME=home + "/.config",
                   XDG_STATE_HOME=home + "/.local/state", XDG_DATA_HOME=home + "/.local/share")
        run = subprocess.run(["qs", "-p", tmp], env=env, capture_output=True, text=True, timeout=30)
        res = {}
        for line in (run.stdout + run.stderr).splitlines():
            if "RESULT " in line:
                tag, _, js = line.split("RESULT ", 1)[1].partition(" ")
                res[tag] = json.loads(js)
        if "loaded" not in res:
            ok("harness ran", False, (run.stdout + run.stderr)[-800:])
            return
        L = res["loaded"]
        ok("lenormand tool answers IPC as neuronet.lenormand", L["lenormandIpc"] == "neuronet.lenormand")
        ok("the oracle tool doesn't show the old file's Lenormand card", L["oracleCards"] == [], str(L["oracleCards"]))
        ok("the lenormand tool takes today's card from the old shared file",
           L["lenormandAdopted"] == "Book" and L["lenormandHistory"] == ["lenormand"], str(L))
        ok("  and its desktop on/off", L["lenormandDesktop"] is False)
        with open(lenormand_file) as f:
            ok("  and saves it in its own file",   # (in the history: today's is redrawn below)
               any(h.get("at") == "x2" for h in json.load(f).get("history", [])))
        if not (L["decks"]["o"] and L["decks"]["l"]):
            print("  skip  draw checks (no oracle/lenormand decks with pictures)")
            return
        ok("old tarot state: today's tarot card kept, tool stays on tarot",
           L["tarotKind"] == "tarot" and L["tarotToday"] == "The Magician")
        ok("tarot tool's past pulls are tarot only", L["tarotHistory"] == ["tarot"], str(L["tarotHistory"]))
        ok("oracle tool answers IPC as neuronet.oracle", L["oracleIpc"] == "neuronet.oracle")
        D = res["drawn"]
        ok("each tool pulls only its own kind",
           D["oracle"] == ["oracle"] and D["lenormand"] == ["lenormand"] and D["lenormandRedrawn"], str(D))
        ok("the tarot card is untouched by the other tools", D["tarotCards"] == ["tarot"])
        with open(tarot_file) as f:
            ok("the oracle tool never writes the tarot state file", json.load(f) == old_state)
        with open(oracle_file) as f:
            saved = json.load(f)
        ok("oracle state saved with only today's oracle card (Lenormand moved out)",
           sorted(saved.get("days", {})) == ["oracle"], str(sorted(saved.get("days", {}))))
        with open(lenormand_file) as f:
            ok("lenormand state saved in its own file", sorted(json.load(f).get("days", {})) == ["lenormand"])
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


behaviour()
print("\n%d passed, %d failed" % (passed, failed))
sys.exit(1 if failed else 0)
