"""system/install.sh on a computer without NeuroNet -- install, again, uninstall.

NeuroNet System plan, Stage 2 (2026-09-29): "one command turns a fresh
Omarchy into NeuroNet ... safe to run twice; backs up anything it replaces;
has an uninstall".

A made-up Omarchy home in a temporary folder -- Arc Dock on, the Tokyo Night
theme, the person's own shortcuts, and one of NeuroNet's keys already taken
-- and stand-ins for the commands that would change the real desktop
(omarchy, hyprctl, systemctl, omarchy-shell), which do to the made-up
home's files what the real ones would. pgrep is a stand-in too: the real one
would find the NeuroNet running on this computer, and the uninstall would
stop it. Nothing outside the temporary folder is touched.

Slow-ish (a minute): the installer draws the wallpapers, as it would on a
new computer.
"""
import os
# Never Cam's real data: since the 1.0.2 install ~/.config/neuronet/paths.json
# names it, and data_dir() reads that before anything a test patches. A file
# that can't exist means "no config" here and in every process a test starts.
# test_test_isolation.py checks every test does this first.
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import json
import os
import shutil
import re
import subprocess
import sys
import tempfile

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INSTALL = os.path.join(APP, "system", "install.sh")
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


h = tempfile.mkdtemp(prefix="nn-install-")
home, stub = os.path.join(h, "home"), os.path.join(h, "bin")
os.makedirs(stub)

# ---- the stand-ins ---------------------------------------------------------------
STUBS = {
 "omarchy": r'''#!/bin/bash
# stand-in: does to $HOME's files what Omarchy would
SJ="$HOME/.config/omarchy/shell.json"; echo "omarchy $*" >> "$HOME/../calls.log"
j() { jq "$@" "$SJ" > "$SJ.t" && mv "$SJ.t" "$SJ"; }
case "$1 $2" in
  "plugin enable")  j --arg id "$3" 'if ([.plugins[].id] | index($id)) then . else .plugins += [{id: $id}] end' ;;
  "plugin disable") j --arg id "$3" '.plugins |= map(select(.id != $id))' ;;
  "bar put")
    id="$3"; how="$4"; ref="$5"
    case "$how" in
      --section) j --arg id "$id" --arg s "$ref" '.bar.layout[$s] += [{id: $id}]' ;;
      --after|--before)
        j --arg id "$id" --arg ref "$ref" --arg how "$how" '
          .bar.layout |= with_entries(.value as $v | ([$v[].id] | index($ref)) as $i |
            if $i == null then . else .value = ($v[:($i + (if $how == "--after" then 1 else 0 end))] + [{id: $id}]
                                               + $v[($i + (if $how == "--after" then 1 else 0 end)):]) end)' ;;
    esac ;;
  "menu keybindings") printf '%s\n' "SUPER ALT + X  →  Somebody's own screenshot key" "SUPER ALT + G  →  Move active window out of group"
    # and every key bindings.lua binds now, as the real one lists them -- NeuroNet's own from a run
    # before too (NeuroArcana's Super+Alt+Y was taken out by the next update, 1 Nov 2026)
    sed -nE 's/^\s*o\.bind\("([^"]+)", "([^"]+)".*/\1  →  \2/p' "$HOME/.config/hypr/bindings.lua" 2>/dev/null \
      | sed -E 's/ \+ ([^+]* \+ )/ \1/; s/ \+ ([^+]* \+ )/ \1/' ;;
  "theme set") mkdir -p "$HOME/.local/state/omarchy/current"; echo "$3" > "$HOME/.local/state/omarchy/current/theme.name" ;;
  *) : ;;
esac
''',
 "hyprctl": '#!/bin/bash\necho "hyprctl $*" >> "$HOME/../calls.log"\n[ "$1" = configerrors ] && cat "$HOME/../hypr-errors" 2>/dev/null\nexit 0\n',
 "systemctl": r'''#!/bin/bash
echo "systemctl $*" >> "$HOME/../calls.log"
S="$HOME/../enabled"; shift   # --user
case "$1" in
  is-enabled) grep -qx "$2" "$S" 2>/dev/null ;;
  is-active) grep -qx "$2" "$S" 2>/dev/null && echo active ;;
  enable) u="${@: -1}"; echo "$u" >> "$S" ;;
  disable) u="${@: -1}"; [ -f "$S" ] && grep -vx "$u" "$S" > "$S.t"; mv "$S.t" "$S" 2>/dev/null || true ;;
  *) : ;;
esac
''',
 "omarchy-shell": '#!/bin/bash\necho "omarchy-shell $*" >> "$HOME/../calls.log"\n',
 "pgrep": '#!/bin/bash\nexit 1\n',
}
for name, body in STUBS.items():
    p = os.path.join(stub, name)
    open(p, "w").write(body)
    os.chmod(p, 0o755)

# ---- a made-up Omarchy home ----------------------------------------------------------
hypr = os.path.join(home, ".config", "hypr")
os.makedirs(hypr)
MINE = {"bindings.lua": 'o.bind("SUPER + RETURN", "Terminal", "uwsm-app -- xdg-terminal-exec")\n',
        "autostart.lua": 'o.launch_on_start("my-own-thing")\n',
        "hyprland.lua": 'require("monitors")\n'}
for f, text in MINE.items():
    open(os.path.join(hypr, f), "w").write(text)
os.makedirs(os.path.join(home, ".config", "omarchy"))
# an older NeuroNet's class timer, retired since (2026-09-29): on and on the bar
shell = {"plugins": [{"id": "io.github.claudsondouglas.arcdock"}, {"id": "neuronet.training"}],
         "bar": {"layout": {"left": [{"id": "omarchy.menu"}, {"id": "omarchy.workspaces"}],
                            "center": [{"id": "omarchy.clock"}],
                            "right": [{"id": "omarchy.tray"}, {"id": "neuronet.training"}, {"id": "omarchy.agents"}, {"id": "omarchy.audio"}]}}}
json.dump(shell, open(os.path.join(home, ".config", "omarchy", "shell.json"), "w"), indent=2)
os.makedirs(os.path.join(home, ".config", "omarchy", "plugins", "io.github.claudsondouglas.arcdock"))
os.makedirs(os.path.join(home, ".config", "omarchy", "plugins", "neuronet.training"))
os.makedirs(os.path.join(home, ".local", "state", "omarchy", "current"))
open(os.path.join(home, ".local", "state", "omarchy", "current", "theme.name"), "w").write("tokyo-night\n")
data = os.path.join(home, "NeuroNet")

# Omarchy's own defaults, as the installer reads them: SUPER+ALT+G is one
fake_omarchy = os.path.join(home, "..", "omarchy-share")
os.makedirs(os.path.join(fake_omarchy, "default", "hypr", "bindings"))
open(os.path.join(fake_omarchy, "default", "hypr", "bindings", "tiling.lua"), "w").write(
    'o.bind("SUPER + ALT + G", "Move active window out of group", hl.dsp.window.move({ out_of_group = true }))\n')
env = dict(os.environ, HOME=home, PATH=stub + ":" + os.environ["PATH"], OMARCHY_PATH=fake_omarchy,
           XDG_CONFIG_HOME=os.path.join(home, ".config"), XDG_DATA_HOME=os.path.join(home, ".local", "share"),
           XDG_STATE_HOME=os.path.join(home, ".local", "state"))
env.pop("NEURONET_PATHS", None)


def run(*args):
    r = subprocess.run(["bash", INSTALL, *args], capture_output=True, text=True, env=env, timeout=600)
    return r.returncode, r.stdout + r.stderr


def sj():
    return json.load(open(os.path.join(home, ".config", "omarchy", "shell.json")))


try:
    # ---- install ------------------------------------------------------------------
    # a computer that had the desktop widgets (before 3 Nov 2026): their own shell,
    # its service, the two commands and the board's plugin folder
    olddesk = os.path.join(home, ".config", "quickshell", "neuronet-desktop")
    os.makedirs(olddesk)
    open(os.path.join(olddesk, "shell.qml"), "w").write("// old\n")
    os.makedirs(os.path.join(home, ".config", "systemd", "user"), exist_ok=True)
    open(os.path.join(home, ".config", "systemd", "user", "neuronet-desktop.service"), "w").write("[Unit]\n")
    os.makedirs(os.path.join(home, ".local", "bin"), exist_ok=True)
    open(os.path.join(home, ".local", "bin", "neuronet-shell"), "w").write("#!/bin/sh\n")
    os.makedirs(os.path.join(home, ".config", "omarchy", "plugins", "neuronet.board"))
    # the Claude dock made by hand before NeuroNet had it (PC 1 Nov, laptop 10 Nov 2026): its
    # plugin on the bar, its key written by hand, and Claude Code's hooks beside one of the person's own
    os.makedirs(os.path.join(home, ".config", "omarchy", "plugins", "cam.claudedock"))
    s0 = sj(); s0["plugins"].append({"id": "cam.claudedock"}); s0["bar"]["layout"]["right"].insert(0, {"id": "cam.claudedock"})
    json.dump(s0, open(os.path.join(home, ".config", "omarchy", "shell.json"), "w"), indent=2)
    HAND_DOCK = 'o.bind("SUPER + ALT + U", "Claude dock: tuck the chat you\'re in, or bring one back", "claude-dock toggle")'
    open(os.path.join(hypr, "bindings.lua"), "a").write("\n" + HAND_DOCK + "\n")
    CS = os.path.join(home, ".claude", "settings.json")
    os.makedirs(os.path.dirname(CS))
    MY_HOOK = {"type": "command", "command": "notify-send done"}
    json.dump({"model": "opus", "hooks": {"Stop": [{"hooks": [MY_HOOK]},
              {"hooks": [{"type": "command", "command": "python3 ~/.config/omarchy/plugins/cam.claudedock/claudedock.py replied"}]}]}},
              open(CS, "w"))
    # a 1.0.186 computer had window snap (taken out again 17 Nov 2026): its Lua file, loaded from
    # NeuroNet's block in hyprland.lua, and the neuronet.snap outline plugin switched on
    SNAP_LINE = 'do local f = os.getenv("HOME") .. "/.config/hypr/neuronet-windowsnap.lua"; local h = io.open(f, "r"); if h then h:close(); dofile(f) end end -- NeuroNet window snap'
    open(os.path.join(hypr, "neuronet-windowsnap.lua"), "w").write("-- old snap\n")
    open(os.path.join(hypr, "hyprland.lua"), "a").write(
        "-- >>> NeuroNet desktop integration (install.sh)\n" + SNAP_LINE + "\n-- <<< NeuroNet desktop integration (install.sh)\n")
    os.makedirs(os.path.join(home, ".config", "omarchy", "plugins", "neuronet.snap"))
    s1 = sj(); s1["plugins"].append({"id": "neuronet.snap"})
    json.dump(s1, open(os.path.join(home, ".config", "omarchy", "shell.json"), "w"), indent=2)
    code, out = run("--yes", "--no-start", "--data", data)
    ok("the install runs to the end", code == 0 and "Done." in out, out)
    ok("window snap is taken out: the Lua file set aside, the block no longer loads it, the outline plugin retired",
       not os.path.exists(os.path.join(hypr, "neuronet-windowsnap.lua"))
       and "windowsnap" not in read(os.path.join(hypr, "hyprland.lua"))
       and "neuronet.snap" not in [p["id"] for p in sj()["plugins"]]
       and not os.path.exists(os.path.join(home, ".config", "omarchy", "plugins", "neuronet.snap"))
       and "Window snap taken out" in out and "Retired neuronet.snap" in out, out[-900:])
    on0, right0 = [p["id"] for p in sj()["plugins"]], [e["id"] for e in sj()["bar"]["layout"]["right"]]
    ok("the Claude dock: NeuroNet's is on and first on the right; the hand-made one is off, off the bar and set aside",
       "neuronet.claudedock" in on0 and right0[0] == "neuronet.claudedock" and "cam.claudedock" not in on0 + right0
       and not os.path.exists(os.path.join(home, ".config", "omarchy", "plugins", "cam.claudedock"))
       and "Set aside cam.claudedock" in out, [on0, right0, out[-600:]])
    b0 = read(os.path.join(hypr, "bindings.lua"))
    ok("  Super+Alt+U is bound once, in the NeuroNet block (the hand-written line is replaced, not doubled)",
       b0.count('"SUPER + ALT + U"') == 1 and HAND_DOCK not in b0 and '"claude-dock toggle"' in b0
       and "keys are taken here: SUPER + ALT + U" not in out, out[-600:])
    ok("  and the claude-dock command is in ~/.local/bin", os.access(os.path.join(home, ".local/bin/claude-dock"), os.X_OK))
    cs = json.load(open(CS))
    stop = [h for g in cs["hooks"]["Stop"] for h in g["hooks"]]
    note = [h for g in cs["hooks"]["Notification"] for h in g["hooks"]]
    ok("  Claude Code's Stop and Notification hooks run claude-dock replied, once each; the old one is gone",
       [h["command"] for h in stop].count("claude-dock replied") == 1 and [h["command"] for h in note] == ["claude-dock replied"]
       and not any("claudedock.py" in h["command"] for h in stop), cs)
    ok("  the person's own hook and settings are kept, and the file backed up",
       MY_HOOK in stop and cs.get("model") == "opus" and any(n.startswith("settings.json.bak.") for n in os.listdir(os.path.dirname(CS))), cs)
    P = os.path.join(home, ".config", "omarchy", "plugins")
    mine = sorted(d for d in os.listdir(P) if d.startswith("neuronet."))
    want = sorted(os.listdir(os.path.join(APP, "system", "omarchy", "plugins")))
    ok("every NeuroNet widget is installed", mine == want, mine)
    on = [p["id"] for p in sj()["plugins"]]
    ok("  the dock is switched on in Omarchy's shell", "neuronet.dock" in on, on)
    # the desktop widgets went on 3 Nov 2026: an old computer's are switched off and taken out
    calls0 = open(os.path.join(home, "..", "calls.log")).read() if os.path.exists(os.path.join(home, "..", "calls.log")) else ""
    ok("  the old desktop widgets are switched off and taken out (service, its shell, the commands)",
       not os.path.exists(olddesk)
       and not os.path.exists(os.path.join(home, ".config", "systemd", "user", "neuronet-desktop.service"))
       and not os.path.exists(os.path.join(home, ".local", "bin", "neuronet-shell"))
       and "systemctl --user disable --now neuronet-desktop.service" in calls0
       and "Switched off the old desktop widgets" in out, calls0[-600:])
    ok("  the board's plugin is set aside, not on in Omarchy's shell",
       "neuronet.board" not in mine and not any(x in on for x in ("neuronet.board", "neuronet.frame", "neuronet.home"))
       and "Retired neuronet.board" in out, [mine, on])
    ok("  and Arc Dock is switched off (the NeuroNet dock takes its place)",
       "io.github.claudsondouglas.arcdock" not in on, on)
    bar = sj()["bar"]["layout"]
    ok("  the bar widgets are on the bar, in their sections",
       "neuronet.launcher" in [e["id"] for e in bar["left"]]
       and all(x in [e["id"] for e in bar["right"]] for x in ("neuronet.gamemode", "neuronet.music", "neuronet.tarot")), bar)
    ok("  beside the neighbours they have on Cam's (the controller before the tray)",
       [e["id"] for e in bar["right"]].index("neuronet.gamemode") + 1 == [e["id"] for e in bar["right"]].index("omarchy.tray"),
       [e["id"] for e in bar["right"]])
    ok("the retired class timer is off, off the bar and set aside -- not deleted",
       "neuronet.training" not in on and "neuronet.training" not in json.dumps(sj()["bar"])
       and not os.path.exists(os.path.join(P, "neuronet.training"))
       and any(os.path.isdir(os.path.join(home, ".config/omarchy", d, "neuronet.training"))
               for d in os.listdir(os.path.join(home, ".config/omarchy")) if d.startswith("plugins-removed-neuronet-")))
    T = os.path.join(home, ".config", "omarchy", "themes")
    ok("NeuroNet and NeuroNet Light are installed, with their wallpapers",
       all(sorted(os.listdir(os.path.join(T, t, "backgrounds")))
           == sorted(os.listdir(os.path.join(APP, "system", "wallpapers", "photos", p)))
           for t, p in (("neuronet", "dark"), ("neuronet-light", "light"))),
       str([os.listdir(os.path.join(T, t, "backgrounds")) for t in ("neuronet", "neuronet-light")]))
    ok("  and NeuroNet is the theme in use",
       read(os.path.join(home, ".local/state/omarchy/current/theme.name")).strip() == "neuronet")
    ok("the theme hook is installed",
       os.access(os.path.join(home, ".config/omarchy/hooks/theme-set.d/neuronet-theme"), os.X_OK))
    b = read(os.path.join(hypr, "bindings.lua"))
    ok("shortcuts are in bindings.lua, in the NeuroNet block", '"neuronet-quick notes"' in b and ">>> NeuroNet" in b)
    ok("  the person's own shortcuts are kept", MINE["bindings.lua"].strip() in b)
    ok("  a NeuroNet key already taken here is left out (and said so)",
       '"SUPER + ALT + X"' not in b and "keys are taken here: SUPER + ALT + X" in out, out[-400:])
    ok("  an Omarchy DEFAULT key the block unbinds first is taken over (NeuroPets' Super+Alt+G)",
       'hl.unbind("SUPER + ALT + G")' in b and '"neuropets toggle"' in b and "SUPER + ALT + G (already" not in out, out[-400:])
    ok("  but a person's own key never is", '"SUPER + ALT + X"' not in b)
    ok("  login start and window rule too",
       'launch_on_start("neuronet-quick start")' in read(os.path.join(hypr, "autostart.lua"))
       and "special:neuronet" in read(os.path.join(hypr, "hyprland.lua")))
    ok("  and a backup of each Hyprland file it changed",
       all(any(n.startswith(f + ".bak.") for n in os.listdir(hypr)) for f in MINE))
    conf = json.load(open(os.path.join(home, ".config/neuronet/paths.json")))
    ok("paths.json points at NeuroNet, and the data at ~/NeuroNet (made)",
       conf.get("app") == os.path.realpath(APP) and conf.get("data") == data and os.path.isdir(data), conf)
    ok("  the data folder is empty -- the install writes no data", os.listdir(data) == [])
    ok("NeuroNet's commands are in ~/.local/bin",
       all(os.access(os.path.join(home, ".local/bin", c), os.X_OK) for c in ("neuronet-quick", "neuronet-path")))
    ok("  and neuronet-dev, linked to this checkout's (a copied one went stale on the laptop, 1 Nov 2026)",
       os.path.realpath(os.path.join(home, ".local/bin/neuronet-dev")) == os.path.realpath(os.path.join(APP, "system/bin/neuronet-dev")))
    ok("the Omarchy-menu indexer is switched on", "neuronet-menu.path" in read(os.path.join(h, "enabled")))
    rec = json.load(open(os.path.join(home, ".local/state/neuronet/install.json")))
    ok("the record keeps what it switched off and the theme before",
       rec.get("disabled") == ["io.github.claudsondouglas.arcdock"] and rec.get("themeBefore") == "tokyo-night", rec)

    # ---- again -----------------------------------------------------------------------
    code, out = run("--check")
    ok("a check afterwards: nothing to change", code == 0 and "Nothing to change" in out, out)
    baks = sorted(n for n in os.listdir(hypr) if ".bak." in n)
    block_keys = re.findall(r'o\.bind\("([^"]+)", "Neuro', read(os.path.join(APP, "system", "hypr", "bindings.lua.block")))
    b1 = read(os.path.join(hypr, "bindings.lua"))
    code, out = run("--yes", "--no-start")
    b2 = read(os.path.join(hypr, "bindings.lua"))
    ok("  every NeuroNet key from the first run is still there after the second (NeuroArcana's Super+Alt+Y was dropped)",
       '"SUPER + ALT + Y", "NeuroArcana' in b2 and all(('"%s"' % k in b2) == ('"%s"' % k in b1) for k in block_keys)
       and "keys are taken here: SUPER + ALT + Y" not in out, out[-400:])
    ok("installing again changes nothing", code == 0 and "Installed" not in out and "updated" not in out, out)
    ok("  and makes no new backups", sorted(n for n in os.listdir(hypr) if ".bak." in n) == baks)

    # ---- Hyprland errors: its files put back ------------------------------------------
    open(os.path.join(h, "hypr-errors"), "w").write("bindings.lua: something is wrong\n")
    b_before = read(os.path.join(hypr, "bindings.lua"))
    open(os.path.join(hypr, "bindings.lua"), "w").write(MINE["bindings.lua"])      # NeuroNet's block gone
    code, out = run("--yes", "--no-start")
    ok("if Hyprland reports errors, its files are put back as they were",
       "put back as they were" in out and read(os.path.join(hypr, "bindings.lua")) == MINE["bindings.lua"], out[-500:])
    os.remove(os.path.join(h, "hypr-errors"))
    run("--yes", "--no-start")
    ok("  and the next install puts the block in", read(os.path.join(hypr, "bindings.lua")) == b_before)

    # ---- NeuroNet lines written by hand, outside the block ------------------------------
    # Cam's desktop, 2026-10-01: his own NeuroNet keys stayed above the block,
    # so each key ran neuronet-quick twice -- the window showed, then hid at once.
    hand = ('-- NeuroNet quick access, by hand\n'
            'o.bind("SUPER + ALT + N", "NeuroNet Notes", "/somewhere/NeuroNet/neuronet-quick notes")\n'
            'o.bind("SUPER + ALT + O", "NeuroNet", "/somewhere/NeuroNet/neuronet-quick full")\n\n'
            '-- my own key\n'
            'o.bind("SUPER + ALT + Y", "NeuroNet notes, my way", "neuronet-open note Inbox")\n\n')
    open(os.path.join(hypr, "bindings.lua"), "w").write(MINE["bindings.lua"] + "\n" + hand + b_before[len(MINE["bindings.lua"]):].lstrip("\n"))
    open(os.path.join(hypr, "autostart.lua"), "a").write('\n-- by hand\no.launch_on_start("/somewhere/NeuroNet/neuronet-quick start")\n')
    code, out = run("--check")
    ok("a check sees hand-written NeuroNet lines the block would run twice",
       code == 0 and "replace a NeuroNet line outside the block" in out, out[-500:])
    code, out = run("--yes", "--no-start")
    b = read(os.path.join(hypr, "bindings.lua"))
    binds = [l for l in b.splitlines() if l.startswith("o.bind(")]
    ok("hand-written NeuroNet keys the block has are replaced: each key bound once",
       code == 0 and sum('"SUPER + ALT + N"' in l for l in binds) == 1
       and sum('"SUPER + ALT + O"' in l for l in binds) == 1 and "/somewhere" not in b
       and "quick access, by hand" not in b, b)
    ok("  a hand-written NeuroNet key the block doesn't have is kept, with its comment",
       '"SUPER + ALT + Y"' in b and "-- my own key" in b, b)
    ok("  the person's own shortcuts are kept", MINE["bindings.lua"].strip() in b)
    a = read(os.path.join(hypr, "autostart.lua"))
    ok("  the hand-written login start too: NeuroNet starts once",
       a.count("neuronet-quick start") == 1 and "/somewhere" not in a and MINE["autostart.lua"].strip() in a, a)
    ok("  and it said so", "would have run twice" in out, out[-500:])
    open(os.path.join(hypr, "bindings.lua"), "w").write(b_before)
    run("--yes", "--no-start")

    # ---- NeuroNet in / or a system folder: refused --------------------------------------
    # Cam's desktop, 2026-10-01: copied with an empty folder variable, NeuroNet
    # landed in / and paths.json said "app": "/" -- the updater would have
    # copied code over the whole system. (/tmp stands in for /: same refusal.)
    conf_before = read(os.path.join(home, ".config/neuronet/paths.json"))
    cfg = os.path.join(home, ".config/neuronet/paths.json")
    open(cfg, "w").write(json.dumps({"app": "/"}))
    q = subprocess.run([os.path.join(home, ".local/bin/neuronet-path"), "app"], capture_output=True, text=True, env=env)
    ok("neuronet-path refuses a paths.json that says NeuroNet is in /",
       q.returncode != 0 and q.stdout.strip() == "" and "can't be right" in q.stderr, q.stdout + q.stderr)
    open(os.path.join(home, ".config/neuronet/update.json"), "w").write('{"repo": "nowhere"}')
    u = subprocess.run(["bash", os.path.join(APP, "system/bin/neuronet-update")], capture_output=True, text=True,
                       env=dict(env, PATH=os.path.join(home, ".local/bin") + ":" + env["PATH"]))
    ok("  and so the updater doesn't run", u.returncode != 0 and "isn't set up" in u.stderr, u.stdout + u.stderr)
    os.remove(os.path.join(home, ".config/neuronet/update.json"))
    open(cfg, "w").write(conf_before)
    r = subprocess.run(["bash", os.path.join(APP, "system/bin/neuronet-setup"), "--app", "/tmp", "--check"],
                       capture_output=True, text=True, env=env)
    ok("neuronet-setup refuses a system folder (/tmp) as NeuroNet's folder",
       r.returncode != 0 and "can't live in /tmp" in r.stderr, r.stdout + r.stderr)
    ok("  and paths.json is as it was", read(cfg) == conf_before)

    # ---- uninstall ---------------------------------------------------------------------
    open(os.path.join(data, "my-note.md"), "w").write("mine")
    code, out = run("--uninstall", "--yes")
    ok("the uninstall runs to the end", code == 0 and "Done" in out, out)
    b = read(os.path.join(hypr, "bindings.lua"))
    ok("  the NeuroNet blocks are gone, the person's own lines kept",
       ">>> NeuroNet" not in b and MINE["bindings.lua"].strip() in b
       and ">>> NeuroNet" not in read(os.path.join(hypr, "autostart.lua")))
    ok("  NeuroNet's widgets are off and set aside",
       not [d for d in os.listdir(P) if d.startswith("neuronet.")]
       and not [p for p in sj()["plugins"] if p["id"].startswith("neuronet.")])
    ok("  Arc Dock is switched back on", "io.github.claudsondouglas.arcdock" in [p["id"] for p in sj()["plugins"]])
    ok("  the theme is back to the one before",
       read(os.path.join(home, ".local/state/omarchy/current/theme.name")).strip() == "tokyo-night")
    ok("  the commands and paths.json are gone",
       not os.path.exists(os.path.join(home, ".local/bin/neuronet-quick"))
       and not os.path.exists(os.path.join(home, ".config/neuronet/paths.json")))
    cs = json.load(open(CS))
    ok("  the Claude dock's hooks are out of Claude Code's settings, the person's own kept",
       "claude-dock replied" not in json.dumps(cs) and cs["hooks"]["Stop"] == [{"hooks": [MY_HOOK]}]
       and "Notification" not in cs["hooks"] and cs.get("model") == "opus", cs)
    ok("  NeuroNet's data is untouched", read(os.path.join(data, "my-note.md")) == "mine")
    ok("  and NeuroNet itself is where it was", os.path.exists(os.path.join(APP, "neuronet.py")))

    # ---- sent over LocalSend: no "runnable" flags, dropped in at ~/NeuroNet ------------
    # Cam, 2026-09-29: "what is the folder i need to move to the other PC
    # without NeuroNet via localsend?" -- the app folder without its data.
    # LocalSend drops the runnable flags, and ~/NeuroNet is where it's likely
    # to land, which is also where a new computer's data would go.
    shutil.rmtree(data)
    sent = os.path.join(home, "NeuroNet")
    subprocess.run(["rsync", "-a", "--exclude=neuronet_data", "--exclude=.git", "--exclude=* (2)*",
                    "--exclude=__pycache__", "--exclude=neuronet.log", APP + "/", sent + "/"], check=True)
    subprocess.run(["chmod", "-R", "a-x+X", sent], check=True)        # files lose x; folders keep it
    # --check first, as someone careful would: it restores no flags, and ran
    # neuronet-setup directly -- "Permission denied" (found in the VM test)
    r = subprocess.run(["bash", os.path.join(sent, "system", "install.sh"), "--check"],
                       capture_output=True, text=True, env=env, timeout=600)
    ok("a copy sent over LocalSend can be checked before it's installed",
       r.returncode == 0 and "would be made" in r.stdout and "Permission denied" not in r.stdout + r.stderr,
       (r.stdout + r.stderr)[-500:])
    r = subprocess.run(["bash", os.path.join(sent, "system", "install.sh"), "--yes", "--no-start"],
                       capture_output=True, text=True, env=env, timeout=600)
    ok("a copy sent over LocalSend installs, runnable flags and all",
       r.returncode == 0 and "Done." in r.stdout, (r.stdout + r.stderr)[-600:])
    conf = json.load(open(os.path.join(home, ".config/neuronet/paths.json")))
    ok("  at ~/NeuroNet, its data goes in its own neuronet_data folder, not loose among its files",
       conf.get("app") == sent and conf.get("data") == os.path.join(sent, "neuronet_data")
       and os.path.isdir(os.path.join(sent, "neuronet_data")), conf)
    q = subprocess.run([os.path.join(home, ".local/bin/neuronet-path"), "app"], capture_output=True, text=True, env=env)
    ok("  and NeuroNet's commands run from it",
       q.stdout.strip() == sent and os.access(os.path.join(sent, "neuronet-quick"), os.X_OK), q.stderr)

    # ---- --offline: the ISO's first login (Stage 5) ------------------------------
    with open(os.path.join(sent, "integration", "deps.txt"), "a") as f:
        f.write("python    nn_no_such_module             omarchy pkg aur add python-nn-no-such   (made up)\n")
    calls = os.path.join(h, "calls.log")
    open(calls, "w").close()
    r = subprocess.run(["bash", os.path.join(sent, "system", "install.sh"), "--yes", "--no-start", "--offline"],
                       capture_output=True, text=True, env=env, timeout=600)
    log = open(calls).read()
    ok("--offline: something missing is only reported, with how to add it later",
       r.returncode == 0 and "not installed (offline): nn_no_such_module" in r.stdout, (r.stdout + r.stderr)[-500:])
    ok("  nothing is downloaded or installed -- no omarchy update, no omarchy pkg",
       "omarchy update" not in log and "omarchy pkg" not in log, log[-400:])
finally:
    shutil.rmtree(h, ignore_errors=True)

# Cam's theme is his: offered on the first install only -- every update runs
# install.sh with --yes, and it used to switch him back to NeuroNet each time
# (2026-10-02, seven times by the log).
_inst = open(os.path.join(APP, "system", "install.sh"), encoding="utf-8").read()
_step = _inst.split('bold "8. Theme"', 1)[1].split("# ---", 1)[0]
ok("the theme is only offered on a first install, never on an update",
   _step.index('elif [ -n "$(record_get installed)" ]; then') < _step.index('ask "Switch to the NeuroNet theme now?"'))

# Quickshell crashed twice on 2026-10-03 (SIGSEGV, IpcHandler::updateRegistration) when the
# installer restarted the shell 0.4 s after copying plugin files it was still hot-reloading.
_inst = open(os.path.join(APP, "system", "install.sh"), encoding="utf-8").read()
_rs = _inst.split("restart_shell() {", 1)[1].split("\n}", 1)[0] if "restart_shell() {" in _inst else ""
_live = [l for l in _inst.splitlines() if "omarchy restart shell" in l and not l.lstrip().startswith("#")]
ok("the shell is restarted only after it has settled from the plugin copy (no crash mid hot-reload)",
   "sleep" in _rs and _rs.index("sleep") < _rs.index("omarchy restart shell") and len(_live) == 1 and _inst.count("restart_shell ") >= 2, _live)

print("\n%d passed, %d failed" % (passed, failed))
sys.exit(1 if failed else 0)
