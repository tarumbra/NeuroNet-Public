#!/usr/bin/env python3
"""NeuroNet Game Mode -- stop everything of NeuroNet's, to free memory for games.

Cam: "a controller in the top bar which can turn game mode on (game mode will
close all background processes of Neuronet and the shell) This is used to save
memory so more can be allocated to gaming, then once done gaming, should be
able to turn the mode off and Neuronet returns ... Game mode will just shut
down all shortcuts specific to Neuronet keeping omarchy shortcuts."

Measured before building it (2026-09-29): NeuroNet at idle held ~9 GB, 8.2 GB
of it in one QtWebEngine renderer -- so this is worth having.

ON
  * NeuroNet itself stops (SIGTERM, then SIGKILL after a wait). Its saves are
    atomic writes (crux_store.atomic_write_json), so a stop can't leave a
    half-written file; only typing not yet saved could be lost.
  * NeuroNet's background services stop (the Omarchy-menu indexer).
  * NeuroNet's shell plugins are unloaded -- the bar widgets and their services -- by taking them out of
    ~/.config/omarchy/shell.json (the shell reloads it by itself). Kept: the
    dock (how games get launched) and this controller.
  * NeuroNet's shortcuts are unbound live (every binding whose description
    starts "NeuroNet"). Nothing in bindings.lua is edited; Omarchy's own
    shortcuts are never touched.
OFF
  Everything put back where it was: the plugins at their old places, the
  shortcuts (a Hyprland reload, from the config), the services that were
  running, and NeuroNet -- started in the background, as at login, if it was
  running when game mode began.

A reboot in game mode: at the next login the bar widget calls `boot-check`,
which turns game mode off (NeuroNet starts at login regardless, so the
half-state is never left behind).

    gamemode.py on | off | toggle | status | boot-check
"""
import json
import os
import signal
import subprocess
import sys
import time

HOME = os.path.expanduser("~")
STATE = os.path.join(HOME, ".local/state/omarchy/neuronet-gamemode.json")
SHELL_JSON = os.path.join(HOME, ".config/omarchy/shell.json")
# Where NeuroNet lives: ~/.config/neuronet/paths.json, written by neuronet-setup
# (NeuroNet System plan, Stage 1).
def _neuronet_app():
    try:
        with open(os.path.join(HOME, ".config/neuronet/paths.json")) as f:
            return json.load(f).get("app") or ""
    except (OSError, ValueError):
        return ""
NEURONET = os.environ.get("NEURONET_HOME") or _neuronet_app()
KEEP = {"neuronet.dock", "neuronet.gamemode"}
# (neuronet-desktop.service, the desktop widgets' own Quickshell, went with
# the desktop widgets, 3 Nov 2026)
UNITS = ["neuronet-menu.path", "neuronet-menu.service"]
MODS = [(64, "SUPER"), (4, "CTRL"), (8, "ALT"), (1, "SHIFT")]


def run(*cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True, **kw)


def notify(title, body=""):
    run("notify-send", "-a", "NeuroNet", "-i", "input-gaming", title, body)


def mem_available_kb():
    with open("/proc/meminfo") as f:
        for line in f:
            if line.startswith("MemAvailable:"):
                return int(line.split()[1])
    return 0


def load_state():
    try:
        with open(STATE) as f:
            return json.load(f)
    except (OSError, ValueError):
        return {"on": False}


def save_state(state):
    tmp = STATE + ".part"
    with open(tmp, "w") as f:
        json.dump(state, f, indent=2)
    os.replace(tmp, STATE)


def read_shell():
    with open(SHELL_JSON) as f:
        return json.load(f)


def write_shell(cfg):
    tmp = SHELL_JSON + ".part"
    with open(tmp, "w") as f:
        json.dump(cfg, f, indent=2)
        f.write("\n")
    os.replace(tmp, SHELL_JSON)


def is_neuronet(entry):
    pid = str((entry or {}).get("id", ""))
    return pid.startswith("neuronet.") and pid not in KEEP


# ---- NeuroNet the app ---------------------------------------------------------
def neuronet_pids():
    out = run("pgrep", "-f", r"^(/usr/bin/)?python3? [^ ]*neuronet\.py").stdout.split()
    return [int(p) for p in out if p.isdigit() and int(p) != os.getpid()]


def stop_neuronet():
    pids = neuronet_pids()
    for p in pids:
        try:
            os.kill(p, signal.SIGTERM)
        except ProcessLookupError:
            pass
    deadline = time.time() + 6
    while time.time() < deadline and any(os.path.exists(f"/proc/{p}") for p in pids):
        time.sleep(0.2)
    for p in pids:
        try:
            os.kill(p, signal.SIGKILL)
        except ProcessLookupError:
            pass
    return bool(pids)


def start_neuronet():
    quick = os.path.join(NEURONET, "neuronet-quick")
    if os.access(quick, os.X_OK):
        subprocess.Popen([quick, "start"], start_new_session=True,
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


# ---- shortcuts ----------------------------------------------------------------
def neuronet_binds():
    try:
        binds = json.loads(run("hyprctl", "binds", "-j").stdout or "[]")
    except ValueError:
        return []
    out = []
    for b in binds:
        if not str(b.get("description", "")).startswith("NeuroNet"):
            continue
        mods = [name for bit, name in MODS if b.get("modmask", 0) & bit]
        out.append(" + ".join(mods + [b.get("key", "")]))
    return out


def unbind(keys):
    for k in keys:
        run("hyprctl", "eval", "hl.unbind(%s)" % json.dumps(k))


# ---- on / off -----------------------------------------------------------------
def on():
    state = load_state()
    if state.get("on"):
        return state
    before = mem_available_kb()

    was_running = stop_neuronet()

    units = [u for u in UNITS if run("systemctl", "--user", "is-active", u).stdout.strip() == "active"]
    for u in units:
        run("systemctl", "--user", "stop", u)

    removed = {"plugins": [], "bar": {}}
    try:
        cfg = read_shell()
        plugins = cfg.get("plugins", [])
        removed["plugins"] = [[i, e] for i, e in enumerate(plugins) if is_neuronet(e)]
        cfg["plugins"] = [e for e in plugins if not is_neuronet(e)]
        layout = cfg.get("bar", {}).get("layout", {})
        for section, items in layout.items():
            gone = [[i, e] for i, e in enumerate(items) if is_neuronet(e)]
            if gone:
                removed["bar"][section] = gone
                layout[section] = [e for e in items if not is_neuronet(e)]
        write_shell(cfg)
    except (OSError, ValueError) as e:
        print("game mode: couldn't change shell.json:", e, file=sys.stderr)

    keys = neuronet_binds()
    unbind(keys)

    state = {"on": True, "since": time.time(), "wasRunning": was_running,
             "units": units, "removed": removed, "unbound": keys}
    save_state(state)

    time.sleep(2.5)       # let the shell drop the plugins
    freed = max(0, mem_available_kb() - before) / 1048576
    notify("Game mode on", "NeuroNet is paused -- %.1f GB of memory freed." % freed)
    return state


def off():
    state = load_state()
    if not state.get("on"):
        return state
    removed = state.get("removed", {})
    try:
        cfg = read_shell()
        plugins = cfg.setdefault("plugins", [])
        have = {str(e.get("id")) for e in plugins}
        for i, e in sorted(removed.get("plugins", []), key=lambda x: x[0]):
            if str(e.get("id")) not in have:
                plugins.insert(min(i, len(plugins)), e)
        layout = cfg.setdefault("bar", {}).setdefault("layout", {})
        for section, items in removed.get("bar", {}).items():
            cur = layout.setdefault(section, [])
            have = {str(e.get("id")) for e in cur}
            for i, e in sorted(items, key=lambda x: x[0]):
                if str(e.get("id")) not in have:
                    cur.insert(min(i, len(cur)), e)
        write_shell(cfg)
    except (OSError, ValueError) as e:
        print("game mode: couldn't restore shell.json:", e, file=sys.stderr)

    run("hyprctl", "reload")                 # the shortcuts, from the config
    for u in state.get("units", []):
        run("systemctl", "--user", "start", u)
    if state.get("wasRunning") and not neuronet_pids():
        start_neuronet()

    save_state({"on": False})
    notify("Game mode off", "NeuroNet is back.")
    return {"on": False}


def boot_check():
    """Game mode left on over a reboot: put everything back."""
    state = load_state()
    if not state.get("on"):
        return state
    try:
        with open("/proc/stat") as f:
            btime = next(int(l.split()[1]) for l in f if l.startswith("btime"))
    except (OSError, StopIteration):
        return state
    if state.get("since", 0) < btime:
        state["wasRunning"] = False          # login starts NeuroNet by itself
        save_state(state)
        return off()
    return state


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "status"
    if cmd == "on":
        state = on()
    elif cmd == "off":
        state = off()
    elif cmd == "toggle":
        state = off() if load_state().get("on") else on()
    elif cmd == "boot-check":
        state = boot_check()
    else:
        state = load_state()
    print(json.dumps({"on": bool(state.get("on"))}))


if __name__ == "__main__":
    main()
