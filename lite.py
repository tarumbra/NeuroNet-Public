"""Lite mode: NeuroNet made lighter for a small computer, or any laptop on battery (Cam, 17 Nov 2026).

Cam, on the ThinkPad T470s (i5-6300U: 2 cores / 4 threads, 8 GB, Intel HD 520): "We will be using this as the
benchmark for creating neuronet for less powerful compute, so we can still enjoy the full neuronet experience ...
make sure battery life and consumption is also a factor ... build this lighter version as an option in neuronet
settings that can be toggled. This way we get a cross polinaton of benefits through the neuronet ecosystem."

ONE SETTING FOR THE WHOLE ECOSYSTEM, KEPT ON THIS COMPUTER: ~/.config/neuronet/lite.json, {"mode": "auto"|"on"|"off"}.
It sits beside paths.json because it's about this machine, not about Cam's things: the PC can stay full while the
ThinkPad is lite, and a data mirror never carries it across. NeuroNet's Settings > Lite mode writes it; NeuroNet,
NeuroPets, NeuroCafe and NeuroArcana read it here; NeuroTrain reads the same file (its shell/lite.js
follows the same rule, kept in step by test_lite.py).

AUTO (the default) is on when this computer is a small one (4 threads or fewer, or 8 GB of memory or less) or when
it's running on its battery. So the ThinkPad is always lite, the PC never is, and the ASUS laptop goes lite when
it's unplugged.

WHAT IT CHANGES (all of it looks and works the same, only lighter to draw):
  * Chromium asked for reduced motion (--force-prefers-reduced-motion): every page's own "calm" styles apply.
  * html[data-lite]: no blur behind panels (the frosted ones get a solid background), animations and fades
    finish at once instead of running, no permanent GPU layers (ui/lite.css).
  * The top bar's clock to the minute (no seconds: one redraw a minute, not one a second); the music visualizer
    at 15 frames a second while a song plays instead of 60 (ui/music/chords.js).
  * The four game windows get the same stylesheet when their page loads (attach()).
The reduced-motion flag is read when a window opens, so a change reaches it at the next start; the rest
changes at once in NeuroNet and the next time a game opens.

Nothing here polls: the battery is looked at when a window starts and when NeuroNet's page comes back into view.
"""
import json
import os

MODES = ("auto", "on", "off")
SMALL_THREADS = 4          # 4 threads or fewer is a small computer (the T470s has 4)
SMALL_RAM_GB = 8.5         # 8 GB machines report ~7.6: 8.5 catches them, 16 GB ones don't
FLAG = "--force-prefers-reduced-motion"


def config_file(environ=None):
    environ = os.environ if environ is None else environ
    if environ.get("NEURONET_LITE_FILE"):              # tests
        return environ["NEURONET_LITE_FILE"]
    base = environ.get("XDG_CONFIG_HOME") or os.path.join(os.path.expanduser("~"), ".config")
    return os.path.join(base, "neuronet", "lite.json")


def read_mode(environ=None):
    try:
        with open(config_file(environ), encoding="utf-8") as f:
            m = json.load(f).get("mode")
        return m if m in MODES else "auto"
    except (OSError, ValueError, AttributeError):
        return "auto"


def write_mode(mode, environ=None):
    if mode not in MODES:
        raise ValueError(f"Lite mode is auto, on or off, not {mode!r}")
    path = config_file(environ)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump({"mode": mode}, f)
    os.replace(tmp, path)
    return mode


def _read(path):
    try:
        with open(path, encoding="utf-8") as f:
            return f.read().strip()
    except OSError:
        return ""


def machine(sys_root="/"):
    """This computer, as Lite mode sees it: threads, memory, CPU name, battery (sysfs only, no programs run)."""
    p = lambda *a: os.path.join(sys_root, *a)           # noqa: E731
    threads = 0
    cpu = ""
    for line in _read(p("proc", "cpuinfo")).splitlines():
        if line.startswith("processor"):
            threads += 1
        elif line.startswith("model name") and not cpu:
            cpu = line.split(":", 1)[1].strip()
    ram_gb = 0.0
    for line in _read(p("proc", "meminfo")).splitlines():
        if line.startswith("MemTotal:"):
            ram_gb = round(int(line.split()[1]) / 1048576, 1)
            break
    has_battery = False
    on_ac = None
    battery_pct = None
    ps = p("sys", "class", "power_supply")
    try:
        names = sorted(os.listdir(ps))
    except OSError:
        names = []
    for n in names:
        kind = _read(os.path.join(ps, n, "type"))
        if kind == "Battery" and _read(os.path.join(ps, n, "scope")) != "Device":   # not a mouse's battery
            has_battery = True
            cap = _read(os.path.join(ps, n, "capacity"))
            if cap.isdigit() and battery_pct is None:
                battery_pct = int(cap)
        elif kind in ("Mains", "USB") and _read(os.path.join(ps, n, "online")) == "1":
            on_ac = True
    if has_battery and on_ac is None:
        on_ac = False
    if not threads and sys_root == "/":
        threads = os.cpu_count() or 0
    return {"cpu": cpu, "threads": threads, "ram_gb": ram_gb,
            "has_battery": has_battery, "on_battery": bool(has_battery and not on_ac), "battery_pct": battery_pct}


def small(m):
    return bool(m["threads"] and m["threads"] <= SMALL_THREADS) or bool(m["ram_gb"] and m["ram_gb"] <= SMALL_RAM_GB)


def state(environ=None, sys_root="/"):
    """{"mode", "on", "why", "machine"}: what Settings shows and what every window goes by."""
    mode = read_mode(environ)
    m = machine(sys_root)
    if mode == "on":
        on, why = True, "switched on"
    elif mode == "off":
        on, why = False, "switched off"
    elif small(m):
        on, why = True, "a smaller computer"
    elif m["on_battery"]:
        on, why = True, "running on battery"
    else:
        on, why = False, "plugged in, and a bigger computer"
    return {"mode": mode, "on": on, "why": why, "machine": m}


def apply_flags(environ=None):
    """Before Qt WebEngine starts: ask Chromium for reduced motion when lite. Returns whether it's lite."""
    environ = os.environ if environ is None else environ
    if environ.get("NEURONET_NO_LITE"):
        return False
    on = state(environ)["on"]
    flags = environ.get("QTWEBENGINE_CHROMIUM_FLAGS", "")
    if on and FLAG not in flags:
        environ["QTWEBENGINE_CHROMIUM_FLAGS"] = (flags + " " + FLAG).strip()
    return on


def css():
    try:
        with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "ui", "lite.css"), encoding="utf-8") as f:
            return f.read()
    except OSError:
        return ""


def attach(window, environ=None):
    """A game window (NeuroPets, NeuroCafe, NeuroArcana): when lite, its page gets ui/lite.css and
    html[data-lite] as it loads. (The games are served from their own folders, so they can't link ../lite.css.)"""
    environ = os.environ if environ is None else environ
    if environ.get("NEURONET_NO_LITE") or not state(environ)["on"]:
        return False
    sheet = css()

    def loaded():
        try:
            window.evaluate_js("document.documentElement.setAttribute('data-lite', ''); document.dispatchEvent(new Event('nn-lite'))")
            if sheet:
                window.load_css(sheet)
        except Exception:
            pass
    try:
        window.events.loaded += loaded
    except Exception:
        return False
    return True


class LiteApi:
    """The page's two calls, through NeuroNet's Api (its part api/lite.py). Settings > Lite mode uses them."""

    def lite_state(self):
        try:
            return state()
        except Exception as e:                          # never in the way of the page
            return {"mode": "auto", "on": False, "why": f"couldn't tell: {e}", "machine": {}}

    def lite_set(self, mode):
        try:
            write_mode(str(mode))
        except (ValueError, OSError) as e:
            return {"error": str(e)}
        return state()
