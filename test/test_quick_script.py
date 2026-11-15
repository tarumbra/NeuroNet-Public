"""Quick access: the script and the one-NeuroNet guard.

Cam: "a plugin that can load my tools in Neuronet and make them appear as a
popup that i can do some quick work or viewing, rather then having to open
the whole app all the time."

NeuroNet itself is the popup, which only works if there is ONE NeuroNet:
opening it again (the desktop entry, the launcher, a key while it's open)
must bring the running one forward, never start a second copy on the same
data -- two copies would each hold the library in memory and overwrite each
other's saves. Runs on a PRIVATE session bus (dbus-run-session).

The window moving itself was checked live against a throwaway window
(foot --app-id NNQuickTest, NEURONET_QUICK_CLASS=NNQuickTest): popup ->
special:neuronet, floating, 72% x 82% of the screen, centred, shown; the
same key hides it; `full` puts it back tiled on the current workspace.
"""
import os
# Never Cam's real data: since the 1.0.2 install ~/.config/neuronet/paths.json
# names it, and data_dir() reads that before anything a test patches. A file
# that can't exist means "no config" here and in every process a test starts.
# test_test_isolation.py checks every test does this first.
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
sys.path.insert(0, APP)

passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print("  ok    " + name)
    else:
        failed += 1
        print("  FAIL  " + name + ("\n          " + str(detail) if detail else ""))


if not os.environ.get("NN_QUICK_PRIVATE_BUS"):
    env = dict(os.environ, NN_QUICK_PRIVATE_BUS="1")
    env.pop("NEURONET_ALLOW_SECOND", None)
    sys.exit(subprocess.run(["dbus-run-session", "--", sys.executable, __file__],
                            env=env).returncode)

import neuronet                                          # noqa: E402

print("\nThe script\n")
script = neuronet.quick_script()
ok("neuronet-quick sits beside neuronet.py and can run",
   os.path.isfile(script) and os.access(script, os.X_OK), script)
ok("  and is valid bash", subprocess.run(["bash", "-n", script]).returncode == 0)
text = open(script, encoding="utf-8").read()
ok("  it knows Cam's tools (and Money, for Cashbox), and full / show / start / hide / toggle",
   all(w in text for w in ('full)', 'show)', 'start)', 'hide)', 'toggle)'))
   and all(t in text for t in ("photos", "mind", "money", "games", "divination",
                                "stuff", "cookery", "music", "training", "home", "notes", "code")))
keys = open(os.path.expanduser("~/.config/hypr/bindings.lua"), encoding="utf-8").read() \
    if os.path.isfile(os.path.expanduser("~/.config/hypr/bindings.lua")) else ""
ok("every tool has a key (Super+Alt+P/Z/C/Q/D/I/R/M/T/H/N/E, and O)",
   all(f'"SUPER + ALT + {k}"' in keys for k in "PZCQDIRMTHNEO"))

print("\nOne NeuroNet\n")
ok("nothing owns org.neuronet.App: NeuroNet starts", neuronet.already_running() is False)

import gi                                                # noqa: E402
gi.require_version("Gio", "2.0")
from gi.repository import Gio                            # noqa: E402
bus = Gio.bus_get_sync(Gio.BusType.SESSION, None)
Gio.bus_own_name_on_connection(bus, "org.neuronet.App", Gio.BusNameOwnerFlags.NONE, None, None)
from gi.repository import GLib                           # noqa: E402
ctx = GLib.MainContext.default()
for _ in range(50):
    ctx.iteration(False)
ok("another NeuroNet owns it: this one sees that", neuronet.already_running() is True)
os.environ["NEURONET_ALLOW_SECOND"] = "1"
ok("  NEURONET_ALLOW_SECOND=1 lets a test copy start anyway", neuronet.already_running() is False)
del os.environ["NEURONET_ALLOW_SECOND"]

calls = []
neuronet._run_quick = lambda action: calls.append(action) or {"ok": True}
import webview                                           # noqa: E402
webview.create_window = lambda *a, **k: (_ for _ in ()).throw(AssertionError("second window"))
neuronet.adopt_at_startup = lambda: calls.append("ADOPT")
try:
    neuronet.main()
    started = False
except AssertionError:
    started = True
ok("opening NeuroNet again brings the running one forward, and starts nothing",
   calls == ["show"] and not started, calls)
ok("  (and doesn't even run the start-up data steps)", "ADOPT" not in calls)

ok("the page's whole-app button runs neuronet-quick show (never hides)",
   neuronet.Api().quick_full() == {"ok": True} and calls[-1] == "show")

print(f"\n  {passed} passed, {failed} failed\n")
sys.exit(1 if failed else 0)
