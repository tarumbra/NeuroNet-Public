#!/usr/bin/env python3
"""Claude dock: Claude Code chats tucked into the top bar (part of NeuroNet from 10 Nov 2026; first made on the PC 1 Nov).

    claude-dock toggle     the focused chat is tucked away; otherwise one comes back (one that replied first)  Super+Alt+U
    claude-dock show-all   every tucked chat comes back                                                       (right click)
    claude-dock replied    from Claude Code's Stop / Notification hooks: flags this chat if it's tucked
    claude-dock sync       just rewrites the state file

Chats are windows of class org.omarchy.agent; tucked = on the hidden workspace special:claude. Hyprland is the truth;
the state file (~/.local/state/omarchy/claude-dock.json) is what the bar widget reads (it watches the file: no polling).
Tests: CLAUDE_DOCK_CLASS, CLAUDE_DOCK_SPECIAL, CLAUDE_DOCK_STATE, CLAUDE_DOCK_TO (where chats come back to),
CLAUDE_DOCK_NOFOCUS=1.
"""
import json, os, subprocess, sys, time

CLASS = os.environ.get("CLAUDE_DOCK_CLASS", "org.omarchy.agent")
SPECIAL = os.environ.get("CLAUDE_DOCK_SPECIAL", "special:claude")
STATE = os.environ.get("CLAUDE_DOCK_STATE", os.path.join(os.environ.get("XDG_STATE_HOME", os.path.expanduser("~/.local/state")), "omarchy", "claude-dock.json"))


def hypr(*args):
    try:
        return subprocess.run(["hyprctl", *args], capture_output=True, text=True, timeout=5).stdout
    except (OSError, subprocess.SubprocessError):
        return ""


def hj(what):
    try:
        return json.loads(hypr(what, "-j") or "null")
    except ValueError:
        return None


def dispatch(lua):
    hypr("dispatch", lua)


def chats():
    return [c for c in (hj("clients") or []) if c.get("class") == CLASS or c.get("initialClass") == CLASS]


def read_state():
    try:
        with open(STATE) as f:
            s = json.load(f)
        return s if isinstance(s, dict) else {}
    except (OSError, ValueError):
        return {}


def write(state, cs=None):
    cs = chats() if cs is None else cs
    old = {t["address"]: t for t in state.get("tucked", [])}
    tucked = []
    for c in cs:
        if c["workspace"]["name"] == SPECIAL:
            tucked.append({"address": c["address"], "title": c.get("title", "Claude"), "at": old.get(c["address"], {}).get("at", time.time())})
    tucked.sort(key=lambda t: t["at"])
    here = {t["address"] for t in tucked}
    state = {"tucked": tucked, "replied": [a for a in state.get("replied", []) if a in here], "chats": len(cs)}
    os.makedirs(os.path.dirname(STATE), exist_ok=True)
    tmp = STATE + ".tmp"
    with open(tmp, "w") as f:
        json.dump(state, f)
    os.replace(tmp, STATE)
    return state


def tuck(c, state):
    dispatch(f'hl.dsp.window.move({{ window = "address:{c["address"]}", workspace = "{SPECIAL}", follow = false }})')
    state.setdefault("tucked", []).append({"address": c["address"], "title": c.get("title", ""), "at": time.time()})


def bring(addr, state):
    to = os.environ.get("CLAUDE_DOCK_TO") or (hj("activeworkspace") or {}).get("name", "1")
    dispatch(f'hl.dsp.window.move({{ window = "address:{addr}", workspace = "{to}", follow = false }})')
    if not os.environ.get("CLAUDE_DOCK_NOFOCUS"):
        dispatch(f'hl.dsp.focus({{ window = "address:{addr}" }})')
    state["replied"] = [a for a in state.get("replied", []) if a != addr]


def main(cmd):
    state = read_state()
    cs = chats()
    if cmd == "toggle":
        act = hj("activewindow") or {}
        mine = next((c for c in cs if c["address"] == act.get("address")), None)
        if mine and not mine["workspace"]["name"].startswith("special:"):
            tuck(mine, state)
        else:
            tucked = [c for c in cs if c["workspace"]["name"] == SPECIAL]
            if tucked:
                order = {t["address"]: t.get("at", 0) for t in state.get("tucked", [])}
                replied = [c for c in tucked if c["address"] in state.get("replied", [])]
                pick = (replied or sorted(tucked, key=lambda c: order.get(c["address"], 0)))[-1 if not replied else 0]
                bring(pick["address"], state)
    elif cmd == "show-all":
        for c in cs:
            if c["workspace"]["name"] == SPECIAL:
                bring(c["address"], state)
    elif cmd == "replied":
        # the hook runs under claude, which runs in the chat's terminal window: walk up to that window's process
        pids, p = set(), os.getppid()
        for _ in range(12):
            if p <= 1 or p in pids:
                break
            pids.add(p)
            try:
                with open(f"/proc/{p}/stat") as f:
                    p = int(f.read().rsplit(")", 1)[1].split()[1])
            except (OSError, ValueError, IndexError):
                break
        for c in cs:
            if c.get("pid") in pids and c["workspace"]["name"] == SPECIAL and c["address"] not in state.get("replied", []):
                state.setdefault("replied", []).append(c["address"])
        try:
            sys.stdin.read()   # the hook's JSON, not needed
        except OSError:
            pass
    elif cmd != "sync":
        sys.exit(__doc__)
    time.sleep(0.15)       # let Hyprland finish the moves before reading them back
    write(state)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "")
