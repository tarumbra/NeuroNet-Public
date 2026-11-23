"""Lite mode (lite.py, 17 Nov 2026): the rule for when it's on, the setting file, the Chromium flag, and that every
window gets it -- NeuroNet's page, the four game windows, and NeuroTrain (whose shell/lite.js must agree with lite.py
on the same made-up computers).

Cam, on the ThinkPad: "build this lighter version as an option in neuronet settings that can be toggled. This way we
get a cross polinaton of benefits through the neuronet ecosystem." Made-up computers in a scratch folder only: never
this computer's real setting, never a window.
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
sys.path.insert(0, APP)
import lite  # noqa: E402

passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print("  ok    " + name)
    else:
        failed += 1
        print("  FAIL  " + name + (f"  ({detail})" if detail else ""))


def read(rel):
    with open(os.path.join(APP, rel), encoding="utf-8") as f:
        return f.read()


scratch = tempfile.mkdtemp(prefix="nn-lite-test-")


def computer(name, threads, ram_kb, battery=None, ac=None):
    """A made-up /proc + /sys: threads, memory, and a battery (None: a desktop) with the charger in or out."""
    root = os.path.join(scratch, name)
    os.makedirs(os.path.join(root, "proc"))
    with open(os.path.join(root, "proc", "cpuinfo"), "w") as f:
        f.write("".join(f"processor\t: {i}\nmodel name\t: Test CPU\n\n" for i in range(threads)))
    with open(os.path.join(root, "proc", "meminfo"), "w") as f:
        f.write(f"MemTotal:       {ram_kb} kB\n")
    ps = os.path.join(root, "sys", "class", "power_supply")
    os.makedirs(ps)
    if battery is not None:
        os.makedirs(os.path.join(ps, "BAT0"))
        for k, v in {"type": "Battery", "capacity": str(battery), "scope": "System"}.items():
            with open(os.path.join(ps, "BAT0", k), "w") as f:
                f.write(v + "\n")
        os.makedirs(os.path.join(ps, "AC"))
        for k, v in {"type": "Mains", "online": "1" if ac else "0"}.items():
            with open(os.path.join(ps, "AC", k), "w") as f:
                f.write(v + "\n")
        # a wireless mouse's battery never makes it a laptop
        os.makedirs(os.path.join(ps, "hidpp_battery_0"))
        for k, v in {"type": "Battery", "scope": "Device", "capacity": "50"}.items():
            with open(os.path.join(ps, "hidpp_battery_0", k), "w") as f:
                f.write(v + "\n")
    return root


try:
    print("the rule")
    thinkpad = computer("thinkpad", 4, 7_986_000, battery=88, ac=True)       # the T470s: 4 threads, 7.6 GB, charging
    pc = computer("pc", 24, 32_800_000)                                       # the PC: no battery
    asus_in = computer("asus-in", 16, 16_300_000, battery=90, ac=True)
    asus_out = computer("asus-out", 16, 16_300_000, battery=90, ac=False)
    small_ram = computer("small-ram", 8, 8_000_000)                           # 8 threads, but 8 GB

    cfg = os.path.join(scratch, "lite.json")
    env = {"NEURONET_LITE_FILE": cfg}
    st = lambda root: lite.state(env, root)                                   # noqa: E731

    ok("no setting yet is Auto", lite.read_mode(env) == "auto")
    ok("Auto: the ThinkPad is lite (a smaller computer)", st(thinkpad)["on"] and st(thinkpad)["why"] == "a smaller computer")
    ok("Auto: the PC isn't", not st(pc)["on"])
    ok("Auto: a big laptop plugged in isn't", not st(asus_in)["on"])
    ok("Auto: a big laptop on its battery is", st(asus_out)["on"] and st(asus_out)["why"] == "running on battery")
    ok("Auto: 8 GB of memory is small even with 8 threads", st(small_ram)["on"])
    m = lite.machine(thinkpad)
    ok("the machine as Settings shows it", m["threads"] == 4 and m["ram_gb"] == 7.6 and m["has_battery"]
       and not m["on_battery"] and m["battery_pct"] == 88, m)
    ok("a mouse's battery doesn't make the PC a laptop",
       not lite.machine(computer("pc-mouse", 24, 32_800_000))["has_battery"])

    lite.write_mode("on", env)
    ok("On: lite on the PC too", st(pc)["on"] and st(pc)["why"] == "switched on")
    lite.write_mode("off", env)
    ok("Off: never lite, even the ThinkPad", not st(thinkpad)["on"])
    ok("the file is just the mode", json.load(open(cfg)) == {"mode": "off"})
    try:
        lite.write_mode("turbo", env)
        ok("a made-up mode is refused", False)
    except ValueError:
        ok("a made-up mode is refused", True)
    with open(cfg, "w") as f:
        f.write("{not json")
    ok("a broken file reads as Auto", lite.read_mode(env) == "auto")
    os.remove(cfg)

    print("the Chromium flag")
    lite.write_mode("on", env)
    fenv = dict(env, QTWEBENGINE_CHROMIUM_FLAGS="--js-flags=--max-old-space-size=128")
    ok("lite asks for reduced motion", lite.apply_flags(fenv) and lite.FLAG in fenv["QTWEBENGINE_CHROMIUM_FLAGS"])
    lite.apply_flags(fenv)
    ok("only once, and the game's own flags kept", fenv["QTWEBENGINE_CHROMIUM_FLAGS"].count(lite.FLAG) == 1
       and "--max-old-space-size=128" in fenv["QTWEBENGINE_CHROMIUM_FLAGS"])
    lite.write_mode("off", env)
    oenv = dict(env)
    ok("not lite: no flag", not lite.apply_flags(oenv) and lite.FLAG not in oenv.get("QTWEBENGINE_CHROMIUM_FLAGS", ""))
    lite.write_mode("on", env)
    nenv = dict(env, NEURONET_NO_LITE="1")
    ok("NEURONET_NO_LITE turns it off (tests, measuring)", not lite.apply_flags(nenv))

    print("NeuroTrain agrees")
    nt = next((p for p in [os.path.expanduser("~/Work/NeuroTrain/shell/lite.js")] if os.path.isfile(p)), None)
    node = shutil.which("node")
    if nt and node:
        for mode in ("auto", "on", "off"):
            lite.write_mode(mode, env)
            for name, root in [("thinkpad", thinkpad), ("pc", pc), ("asus-out", asus_out), ("asus-in", asus_in)]:
                r = subprocess.run([node, nt, root], env=dict(os.environ, **env), capture_output=True, text=True, timeout=30)
                try:
                    js = json.loads(r.stdout)
                except ValueError:
                    js = {}
                py = lite.state(env, root)
                ok(f"{mode} on {name}: same answer", js.get("on") == py["on"] and js.get("why") == py["why"],
                   f"js {js.get('on')} {js.get('why')!r} / py {py['on']} {py['why']!r}")
    else:
        print("  (NeuroTrain or node not on this computer: skipped)")

    print("every window gets it")
    html = read("ui/index.html")
    ok("index.html: lite.css, and lite.js before display.js and app.js",
       'href="lite.css"' in html and html.index('src="lite.js"') < html.index('src="display.js"') < html.index('src="app.js"'))
    ok("NeuroNet's Api has the lite part", '("lite", "LiteApi")' in read("neuronet.py") and "class LiteApi" in read("api/lite.py"))
    nnpy = read("neuronet.py")
    ok("NeuroNet asks for the flag before webview starts", 0 < nnpy.index("lite.apply_flags()") < nnpy.index("        import webview\n    except ImportError"))
    for g in ("neuropets.py", "neurocafe.py", "neuroarcana.py"):
        s = read(g)
        ok(f"{g}: flag before webview, stylesheet on its window",
           "lite.apply_flags()" in s and "lite.attach(window)" in s
           and s.index("lite.apply_flags()") < s.index("import webview\n    except ImportError"))
    app = read("ui/app.js")
    ok("Settings > Lite mode", '{key: "settings:lite", name: "Lite mode"}' in app and 'lite: "Lite mode"' in app
       and "NNLite.renderSettings" in app and '"settings:lite": "i-' in app)
    css = read("ui/lite.css")
    ok("lite.css: no blur, animations end at once, no held layers",
       all(k in css for k in ("backdrop-filter: none", "animation-iteration-count: 1", "will-change: auto")))
    ok("lite.css: only under html[data-lite]", all(line.startswith(("html[data-lite]", " ", "}", "/*", "   ", "")) for line in css.splitlines()))
    ok("the clock to the minute (its own file since the music went to NeuroStream)", "!(window.NNLite && NNLite.on)" in read("ui/topbar.js"))
    ok("NeuroCafe: Balanced runs as Light", 'fx === "balanced" && lite() ? "light" : fx' in read("ui/cafe/cafe.js"))
finally:
    shutil.rmtree(scratch, ignore_errors=True)

print(f"\n{passed} passed, {failed} failed")
sys.exit(1 if failed else 0)
