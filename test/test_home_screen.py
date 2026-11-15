#!/usr/bin/env python3
"""Workspace 1 as NeuroNet's home screen, and the other Omarchy integration
of 2026-09-29: the Omarchy menu (neuronet-menu), capture into Photos
(neuronet-capture). The class timer (neuronet.training) is gone (2026-09-29).

Cam: "I like A and B, however the capture staight into photos genius idea.
Workspace 1 as home screen is incredible as well (Can i have a specialized
wallpaper on workspace one which is just the Neuronet word on a black
background? ..."

  * neuronet.home: its wordmark is NeuroNet's own logo (the i-neuronet path
    in ui/index.html), and it shows on workspace 1 only;
  * the board's Today card works out bills exactly as Money does
    (money_due.js is a copy of money.js's rules -- run side by side here);
  * neuronet-menu writes a valid block into the menu file, leaves the rest
    alone, is idempotent, and every row runs something that exists;
  * the class timer is gone (retired 2026-09-29);
  * the keys, the theme hook and the menu's systemd units are in place.

The page halves are in test_omarchy_integration.js; the colours in
test_omarchy_theme.py; the workspace rule for every widget in
test_daily_cards.py.
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
import shlex
import shutil
import subprocess
import sys
import tempfile

APP = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
# the desktop layer's copy in the repo: system/ (collect.sh), not the old omarchy-plugin/ (Stage 1)
PLUG = os.path.join(APP, "system", "omarchy", "plugins")
HOME = os.path.expanduser("~")

passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print("  ok    " + name)
    else:
        failed += 1
        print("  FAIL  " + name + ("\n          " + str(detail) if detail else ""))


def read(*p):
    """A file's text, or None when it isn't there (an installed copy that's
    behind the repo is a failed check, not a crash)."""
    try:
        with open(os.path.join(*p), encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        return None


def omarchy_parse(raw):
    """What Omarchy's menu does with the file (MenuModel.js stripJsonc)."""
    s = re.sub(r"^\s*//[^\n]*(\n|$)", "", raw, flags=re.M)
    s = re.sub(r",(\s*[}\]])", r"\1", s)
    return json.loads(s)


# ---- the home screen: gone with the desktop widgets (3 Nov 2026) --------------
SN = json.loads(read(APP, "system", "omarchy", "shell.neuronet.json"))
ok("the logo and the desktop board are gone (retired, so a computer that has them sets them aside)",
   all(d in SN.get("retired", []) and not os.path.exists(os.path.join(PLUG, d))
       for d in ("neuronet.home", "neuronet.board", "neuronet.frame")) and "desktopShell" not in SN)
ok("  and no NeuroNet shortcut restarts or edits the desktop",
   "neuronet-shell" not in read(APP, "system", "hypr", "bindings.lua.block")
   and "neuronet-desk-edit" not in read(APP, "system", "hypr", "bindings.lua.block"))

# ---- the Omarchy menu --------------------------------------------------------------
tmp = tempfile.mkdtemp(prefix="nn-menu-")
menu = os.path.join(tmp, "omarchy-menu.jsonc")
with open(menu, "w") as f:
    f.write('{\n  // Cam\'s own comment\n  "personal": {"icon":"x","label":"Personal"},\n}\n')
env = dict(os.environ, NEURONET_MENU_FILE=menu)
r1 = subprocess.run([os.path.join(APP, "neuronet-menu")], env=env, capture_output=True, text=True)
text1 = read(menu)
r2 = subprocess.run([os.path.join(APP, "neuronet-menu")], env=env, capture_output=True, text=True)
ok("neuronet-menu writes its block and keeps what was already in the file",
   r1.returncode == 0 and "Cam's own comment" in text1 and '"personal"' in text1 and "// >>> NeuroNet" in text1, r1.stderr)
ok("running it again changes nothing", "(unchanged)" in r2.stdout and read(menu) == text1, r2.stdout)
try:
    items = omarchy_parse(text1)
except ValueError as e:
    items = {}
    ok("the menu file still parses the way Omarchy parses it", False, e)
ok("Omarchy reads it: the NeuroNet menu, its tools, and Cam's own row",
   "neuronet" in items and "neuronet.tools.notes" in items and "personal" in items)
ok("every NeuroNet tool is a row (the 12 sections + the whole app)",
   len([k for k in items if k.startswith("neuronet.tools.")]) == 13)
missing = []
for k, v in items.items():
    if k.startswith("neuronet") and v.get("action"):
        exe = shlex.split(v["action"])[0]
        if not (os.path.isabs(exe) and os.access(exe, os.X_OK)) and not shutil.which(exe):
            missing.append(k + ": " + exe)
ok("every row runs something that exists", not missing, missing[:5])
chords = os.path.join(APP, "neuronet_data", "chords", "chords.json")
if os.path.exists(chords):
    albums = [a for a in json.load(open(chords)).get("albums", []) if a.get("files")]
    ok("every album with songs is a row", len([k for k in items if k.startswith("neuronet.albums.")]) == len(albums))
note_rows = [v for k, v in items.items() if k.startswith("neuronet.notes.")]
ok("note rows open a note through neuronet-open, by its vault path",
   all(" note " in v["action"] and v["action"].startswith(shlex.quote(os.path.join(APP, "neuronet-open"))) for v in note_rows))
ok("  and the Fleeting queue and attachments aren't listed as notes",
   not any("Fleeting" in v["action"] or "attachments" in v["action"] for v in note_rows))
with open(menu, "w") as f:
    f.write('{\n  "personal": {"icon":"x","label":"Personal"}\n}\n')
subprocess.run([os.path.join(APP, "neuronet-menu")], env=env, capture_output=True, text=True)
try:
    ok("a file whose last row has no comma still parses after the block goes in",
       "personal" in omarchy_parse(read(menu)))
except ValueError as e:
    ok("a file whose last row has no comma still parses after the block goes in", False, e)
shutil.rmtree(tmp, ignore_errors=True)

# ---- capture, open, timer: the scripts ----------------------------------------------
for name in ["neuronet-capture", "neuronet-open", "neuronet-menu"]:
    p = os.path.join(APP, name)
    ok(name + " is there and runnable", os.access(p, os.X_OK))
for name in ["neuronet-capture", "neuronet-open"]:
    r = subprocess.run(["bash", "-n", os.path.join(APP, name)], capture_output=True, text=True)
    ok(name + " is valid bash", r.returncode == 0, r.stderr)
cap = read(APP, "neuronet-capture") + read(APP, "neuronet-snip")
# 15 Nov 2026: a capture is a snip (neuronet-snip): omasnap saves into a private folder it watches
ok("capture saves into a private folder, not ~/Pictures, and hands it to NeuroNet",
   "OMASNAP_SCREENSHOT_DIR=run_dir" in cap and 'call_app("snip.add"' in cap and "neuronet-snip" in cap)

# ---- the class timer is gone ----------------------------------------------------------
# 2026-09-29, Cam: "remove the class timer in neuronet i dont use it". Its
# widget (neuronet.training), its Super+Alt+E and the Today card's Timer
# button are gone; the Training section inside NeuroNet is untouched.
ok("the class timer is retired (a computer that has it gets it set aside)",
   "neuronet.training" in SN.get("retired", [])
   and not os.path.exists(os.path.join(PLUG, "neuronet.training"))
   and "neuronet.training" not in [p["id"] for p in SN.get("plugins", [])])
ok("  no NeuroNet shortcut opens it", "neuronet.training" not in read(APP, "system", "hypr", "bindings.lua.block"))

# ---- installed on this computer ------------------------------------------------------------
binds = os.path.join(HOME, ".config/hypr/bindings.lua")
if os.path.exists(binds):
    b = read(binds)
    ok("Super+Alt+A opens the menu on NeuroNet", '"SUPER + ALT + A"' in b and "omarchy menu summon neuronet" in b)
    ok("Super+Alt+X captures into Photos", '"SUPER + ALT + X"' in b and "neuronet-capture" in b)
    ok("  and Super+Alt+E no longer opens a class timer here", "neuronet.training" not in b)
hook = os.path.join(HOME, ".config/omarchy/hooks/theme-set.d/neuronet-theme")
if os.path.isdir(os.path.dirname(hook)):
    ok("the Omarchy theme hook is installed (and matches system/omarchy/hooks/)",
       os.path.exists(hook) and read(hook) == read(APP, "system", "omarchy", "hooks", "theme-set.d", "neuronet-theme"))
    ok("  and it never starts NeuroNet, only asks a running one", "NameHasOwner" in read(hook) and "neuronet-quick" not in read(hook))
unit = os.path.join(HOME, ".config/systemd/user/neuronet-menu.path")
def rendered_unit(template):
    """The unit as neuronet-setup makes it for this computer (Stage 1): the
    template in system/templates with this computer's folders filled in."""
    try:
        conf = json.load(open(os.path.join(HOME, ".config/neuronet/paths.json")))
    except (OSError, ValueError):
        return None
    app = conf.get("app", "")
    data = conf.get("data") or os.path.join(app, "neuronet_data")
    return read(APP, "system", "templates", template).replace("@APP@", app).replace("@DATA@", data)
if os.path.isdir(os.path.dirname(unit)):
    ok("the menu refreshes itself when music, recipes or notes change (systemd path unit)",
       os.path.exists(unit) and read(unit) == rendered_unit("neuronet-menu.path.in"))
print("\n%d passed, %d failed" % (passed, failed))
sys.exit(1 if failed else 0)
