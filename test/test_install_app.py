"""system/install-app.sh -- NeuroNet without Omarchy (CachyOS + Hyprland, no widgets).

Cam, 2026-10-14: "Lets say i want to move to CachyOS running hyperland DE,
but i dont want any of the desktop widgets."

Made-up homes in a temporary folder -- one with a Lua Hyprland config, one
with a hyprland.conf -- and stand-ins for the commands that would change the
real computer (pacman, sudo, hyprctl, systemctl). The running "Hyprland"
already uses SUPER+ALT+X for something of the person's own. Nothing outside
the temporary folder is touched.
"""
import os
# Never Cam's real data: since the 1.0.2 install ~/.config/neuronet/paths.json
# names it, and data_dir() reads that before anything a test patches. A file
# that can't exist means "no config" here and in every process a test starts.
# test_test_isolation.py checks every test does this first.
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import glob
import json
import os
import shutil
import subprocess
import tempfile

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INSTALL = os.path.join(APP, "system", "install-app.sh")
passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print("  ok    " + name)
    else:
        failed += 1
        print("  FAIL  " + name + ("\n          " + str(detail)[-900:] if detail else ""))


def read(p):
    with open(p, encoding="utf-8") as f:
        return f.read()


h = tempfile.mkdtemp(prefix="nn-install-app-")
stub = os.path.join(h, "bin")
os.makedirs(stub)
STUBS = {
 "pacman": '#!/bin/bash\necho "pacman $*" >> "$HOME/../calls.log"\n',
 "sudo": '#!/bin/bash\necho "sudo $*" >> "$HOME/../calls.log"\nexec "$@"\n',
 "hyprctl": r'''#!/bin/bash
echo "hyprctl $*" >> "$HOME/../calls.log"
case "$1" in
  version) echo "Hyprland 0.56.2" ;;
  binds) echo '[{"modmask":72,"key":"X","arg":"my-screenshot"},{"modmask":72,"key":"N","arg":"/x/.local/bin/neuronet-quick notes"}]' ;;
  configerrors) cat "$HOME/../hypr-errors" 2>/dev/null ;;
esac
exit 0
''',
 "Hyprland": '#!/bin/bash\nexit 0\n',
 "systemctl": '#!/bin/bash\necho "systemctl $*" >> "$HOME/../calls.log"\n',
 "update-desktop-database": '#!/bin/bash\nexit 0\n',
}
for name, body in STUBS.items():
    p = os.path.join(stub, name)
    open(p, "w").write(body)
    os.chmod(p, 0o755)


def make_home(name, files):
    home = os.path.join(h, name, "home")
    hypr = os.path.join(home, ".config", "hypr")
    os.makedirs(hypr)
    for f, text in files.items():
        open(os.path.join(hypr, f), "w").write(text)
    env = dict(os.environ, HOME=home, PATH=stub + ":" + os.environ["PATH"], XDG_CURRENT_DESKTOP="Hyprland",
               XDG_CONFIG_HOME=os.path.join(home, ".config"), XDG_DATA_HOME=os.path.join(home, ".local", "share"),
               XDG_STATE_HOME=os.path.join(home, ".local", "state"))
    env.pop("NEURONET_PATHS", None)
    return home, hypr, env


def run(env, *args):
    r = subprocess.run(["bash", INSTALL, *args], capture_output=True, text=True, env=env, timeout=300)
    return r.returncode, r.stdout + r.stderr


try:
    # ---- a Lua Hyprland (0.5x) -------------------------------------------------------
    MINE = 'hl.bind("SUPER + RETURN", hl.dsp.exec_cmd("kitty"))\n'
    home, hypr, env = make_home("lua", {"hyprland.lua": MINE})
    data = os.path.join(h, "lua", "Data")
    os.makedirs(data)
    open(os.path.join(data, "keep.txt"), "w").write("mine")

    code, out = run(env, "--check", "--data", data)
    ok("--check: runs", code == 0, out)
    ok("--check: changes nothing", read(os.path.join(hypr, "hyprland.lua")) == MINE
       and not os.path.exists(os.path.join(hypr, "neuronet.lua"))
       and not os.path.exists(os.path.join(home, ".config", "neuronet")), out)

    code, out = run(env, "--yes", "--data", data)
    ok("install: runs", code == 0, out)
    paths = json.load(open(os.path.join(home, ".config", "neuronet", "paths.json")))
    ok("paths.json names NeuroNet and its data", paths == {"app": APP, "data": data}, paths)
    ok("NeuroNet's commands are in ~/.local/bin",
       all(os.access(os.path.join(home, ".local", "bin", c), os.X_OK) for c in ("neuronet-quick", "neuropets", "neuronet-path")))
    apps = os.path.join(home, ".local", "share", "applications")
    ok("launcher entries for NeuroNet, NeuroPets, NeuroCafe (and NeuroFarm gone, 1.0.191)",
       all(os.path.isfile(os.path.join(apps, n + ".desktop")) for n in ("NeuroNet", "NeuroPets", "NeuroCafe"))
       and not os.path.exists(os.path.join(apps, "NeuroFarm.desktop")))
    units = os.path.join(home, ".config", "systemd", "user")
    ok("no widget shell and no Omarchy-menu indexer",
       not os.path.exists(os.path.join(units, "neuronet-desktop.service"))
       and not os.path.exists(os.path.join(units, "neuronet-menu.path")), os.listdir(units) if os.path.isdir(units) else "")
    lua = read(os.path.join(hypr, "neuronet.lua"))
    ok("shortcuts in neuronet.lua, with full paths",
       'hl.bind("SUPER + ALT + G", hl.dsp.exec_cmd("%s/.local/bin/neuropets toggle")' % home in lua
       and 'hl.bind("SUPER + ALT + O"' in lua, lua)
    ok("a key the person already uses is left out (X), NeuroNet's own isn't (N)",
       '"SUPER + ALT + X"' not in lua and '"SUPER + ALT + N"' in lua and "keys are taken here: SUPER+ALT+X" in out, out)
    ok("no Omarchy-only keys (desktop edit, widgets, Omarchy menu)",
       all(k not in lua for k in ('"SUPER + ALT + L"', '"SUPER + ALT + W"', '"SUPER + ALT + A"', "omarchy")), lua)
    ok("starts hidden at login, and its window rule",
       "neuronet-quick start" in lua and "special:neuronet silent" in lua, lua)
    main = read(os.path.join(hypr, "hyprland.lua"))
    ok("hyprland.lua keeps the person's lines and loads neuronet.lua",
       main.startswith(MINE) and "dofile(f)" in main and "neuronet.lua" in main, main)
    ok("hyprland.lua backed up", len(glob.glob(os.path.join(hypr, "hyprland.lua.bak.*"))) == 1)
    if shutil.which("luac"):
        r = subprocess.run(["luac", "-p", os.path.join(hypr, "neuronet.lua"), os.path.join(hypr, "hyprland.lua")],
                           capture_output=True, text=True)
        ok("both Lua files parse", r.returncode == 0, r.stderr)
    ok("the record is written", os.path.isfile(os.path.join(home, ".local", "state", "neuronet", "install-app.json")))

    code, out = run(env, "--yes", "--data", data)
    ok("again: changes nothing", code == 0 and "already in place" in out
       and len(glob.glob(os.path.join(hypr, "hyprland.lua.bak.*"))) == 1
       and read(os.path.join(hypr, "hyprland.lua")) == main, out)

    code, out = run(env, "--yes", "--uninstall")
    ok("uninstall: runs", code == 0, out)
    ok("uninstall: hyprland.lua is the person's again", read(os.path.join(hypr, "hyprland.lua")) == MINE,
       read(os.path.join(hypr, "hyprland.lua")))
    ok("uninstall: neuronet.lua, commands, launcher entries gone",
       not os.path.exists(os.path.join(hypr, "neuronet.lua"))
       and not os.path.exists(os.path.join(home, ".local", "bin", "neuronet-quick"))
       and not os.path.exists(os.path.join(apps, "NeuroNet.desktop")))
    ok("uninstall: the data is untouched", read(os.path.join(data, "keep.txt")) == "mine")

    # ---- Hyprland refuses it: everything put back ----------------------------------------
    open(os.path.join(h, "lua", "hypr-errors"), "w").write("neuronet.lua:3: something Hyprland didn't like\n")
    before = read(os.path.join(hypr, "hyprland.lua"))
    code, out = run(env, "--yes", "--no-packages")
    ok("errors: said, and put back as it was",
       "put back as it was" in out and read(os.path.join(hypr, "hyprland.lua")) == before
       and not os.path.exists(os.path.join(hypr, "neuronet.lua")), out)
    os.remove(os.path.join(h, "lua", "hypr-errors"))

    # ---- a hyprland.conf Hyprland ---------------------------------------------------------
    MINE_C = "bind = SUPER, RETURN, exec, kitty\n"
    home, hypr, env = make_home("conf", {"hyprland.conf": MINE_C})
    code, out = run(env, "--yes")
    ok("hyprland.conf: runs", code == 0, out)
    conf = read(os.path.join(hypr, "neuronet.conf"))
    ok("hyprland.conf: bindd lines, exec-once, window rule",
       "bindd = SUPER ALT, G, NeuroNet NeuroPets (again to tuck it away), exec, %s/.local/bin/neuropets toggle" % home in conf
       and "exec-once = %s/.local/bin/neuronet-quick start" % home in conf
       and "windowrule = match:class" in conf and "SUPER ALT, X," not in conf, conf)
    main = read(os.path.join(hypr, "hyprland.conf"))
    ok("hyprland.conf: sources it", main.startswith(MINE_C) and "source = %s" % os.path.join(hypr, "neuronet.conf") in main, main)
    paths = json.load(open(os.path.join(home, ".config", "neuronet", "paths.json")))
    ok("no --data: NeuroNet's own data folder (nothing named)", paths == {"app": APP}, paths)
    code, out = run(env, "--yes", "--uninstall")
    ok("hyprland.conf: uninstall puts it back", read(os.path.join(hypr, "hyprland.conf")) == MINE_C)

    # ---- KDE Plasma (2026-10-14: "please commence building a KDE mode") -----------------
    home, hypr, env = make_home("kde", {})
    shutil.rmtree(hypr)
    env["XDG_CURRENT_DESKTOP"] = "KDE"
    share = os.path.join(h, "kde", "usr-share")
    os.makedirs(os.path.join(share, "kglobalaccel"))
    open(os.path.join(share, "kglobalaccel", "org.kde.spectacle.desktop"), "w").write(
        "[Desktop Entry]\nName=Spectacle\nExec=spectacle\nX-KDE-Shortcuts=Print,Meta+Shift+S\nActions=RecordScreen;\n\n"
        "[Desktop Action RecordScreen]\nName=Start/Stop Screen Recording\nExec=spectacle -R screen\nX-KDE-Shortcuts=Meta+Alt+R\n")
    env["XDG_DATA_DIRS"] = share
    open(os.path.join(home, ".config", "kglobalshortcutsrc"), "w").write(
        "[kwin]\n_k_friendly_name=KWin\nSomething=Meta+Alt+Q,Meta+Alt+Q,Show something\n"
        "[plasmashell]\nUnset=none,none,Nothing\n")
    code, out = run(env, "--yes")
    ok("KDE: found by itself, runs", code == 0 and "KDE Plasma" in out, out)
    ok("KDE: Spectacle is installed for capture; grim and slurp aren't asked for",
       "spectacle" in read(os.path.join(h, "kde", "calls.log")) or shutil.which("spectacle"),
       read(os.path.join(h, "kde", "calls.log")) if os.path.exists(os.path.join(h, "kde", "calls.log")) else "")
    kfile = os.path.join(home, ".local", "share", "applications", "net.neuronet.shortcuts.desktop")
    kd = read(kfile)
    import configparser
    cp = configparser.RawConfigParser(strict=False, interpolation=None)
    cp.optionxform = str
    cp.read_string(kd)
    acts = [a for a in cp.get("Desktop Entry", "Actions").split(";") if a]
    ok("KDE: the whole app is the entry itself, Meta+Alt+O",
       cp.get("Desktop Entry", "X-KDE-Shortcuts") == "Meta+Alt+O"
       and cp.get("Desktop Entry", "Exec") == home + "/.local/bin/neuronet-quick full", kd)
    ok("KDE: every action has its section, an Exec with a full path",
       acts and all(cp.has_section("Desktop Action " + a) and cp.get("Desktop Action " + a, "Exec").startswith(home + "/.local/bin/")
                    for a in acts), kd)
    keys = {cp.get("Desktop Action " + a, "Name"): cp.get("Desktop Action " + a, "X-KDE-Shortcuts", fallback="") for a in acts}
    ok("KDE: Scribe on Meta+Alt+N, NeuroPets on Meta+Alt+G, play/pause's backslash escaped",
       keys.get("NeuroNet Scribe") == "Meta+Alt+N" and keys.get("NeuroNet NeuroPets (again to tuck it away)") == "Meta+Alt+G"
       and keys.get("NeuroNet music: play / pause") == "Meta+Alt+\\\\", keys)
    ok("KDE: a key an app already has (Spectacle's Meta+Alt+R) is left out, and named",
       keys.get("NeuroNet Kitchen") == "" and "Spectacle: Start/Stop Screen Recording" in out, out)
    ok("KDE: a key set in KDE's own settings (Meta+Alt+Q) is left out, and named",
       keys.get("NeuroNet Puzzles") == "" and "kwin: Show something" in out, out)
    ok("KDE: KDE finds it in kglobalaccel/ (a link, like Spectacle's)",
       os.readlink(os.path.join(home, ".local", "share", "kglobalaccel", "net.neuronet.shortcuts.desktop")) == kfile)
    auto = read(os.path.join(home, ".config", "autostart", "neuronet.desktop"))
    ok("KDE: NeuroNet starts hidden at login", "Exec=%s/.local/bin/neuronet-quick start" % home in auto, auto)
    ok("KDE: nothing of Hyprland's", not os.path.exists(hypr))
    code, out = run(env, "--yes")
    ok("KDE again: nothing changes", code == 0 and "shortcuts already in place" in out
       and read(kfile) == kd and not glob.glob(kfile + ".bak.*"), out)
    code, out = run(env, "--yes", "--uninstall")
    ok("KDE uninstall: the shortcuts, the link and the autostart are gone",
       code == 0 and not os.path.exists(kfile)
       and not os.path.lexists(os.path.join(home, ".local", "share", "kglobalaccel", "net.neuronet.shortcuts.desktop"))
       and not os.path.exists(os.path.join(home, ".config", "autostart", "neuronet.desktop")), out)

    calls = read(os.path.join(h, "lua", "calls.log")) + read(os.path.join(h, "conf", "calls.log"))
    ok("nothing but the stand-ins was called to change the computer", "omarchy" not in calls, calls)
finally:
    shutil.rmtree(h, ignore_errors=True)

print("\n%d passed, %d failed" % (passed, failed))
raise SystemExit(1 if failed else 0)
